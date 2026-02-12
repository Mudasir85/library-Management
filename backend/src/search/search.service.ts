import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Full-text search on books with filtering, sorting, and pagination.
   * Supports searching by title, author, ISBN, and description.
   */
  async search(query: SearchQueryDto) {
    const {
      q,
      author,
      category,
      language,
      yearFrom,
      yearTo,
      available,
      sort,
      page,
      limit,
    } = query;

    const where: Prisma.BookWhereInput = {
      isDeleted: false,
    };

    // Full-text search across multiple fields
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { author: { contains: q, mode: 'insensitive' } },
        { isbn: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Apply filters
    if (author) {
      where.author = { contains: author, mode: 'insensitive' };
    }

    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }

    if (language) {
      where.language = { equals: language, mode: 'insensitive' };
    }

    if (yearFrom !== undefined || yearTo !== undefined) {
      where.publicationYear = {};
      if (yearFrom !== undefined) {
        where.publicationYear.gte = yearFrom;
      }
      if (yearTo !== undefined) {
        where.publicationYear.lte = yearTo;
      }
    }

    if (available === true) {
      where.availableCopies = { gt: 0 };
    } else if (available === false) {
      where.availableCopies = { equals: 0 };
    }

    // Determine sort configuration
    let orderBy: Prisma.BookOrderByWithRelationInput | Prisma.BookOrderByWithRelationInput[];

    switch (sort) {
      case 'title':
        orderBy = { title: 'asc' };
        break;
      case 'author':
        orderBy = { author: 'asc' };
        break;
      case 'year':
        orderBy = { publicationYear: 'desc' };
        break;
      case 'popularity':
        orderBy = { transactions: { _count: 'desc' } };
        break;
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    const skip = (page - 1) * limit;

    const [books, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              transactions: true,
              reservations: true,
            },
          },
        },
      }),
      this.prisma.book.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      books,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Return top 10 book titles and authors matching a partial term for autocomplete.
   */
  async getSuggestions(term: string) {
    if (!term || term.trim().length === 0) {
      return { suggestions: [] };
    }

    const trimmedTerm = term.trim();

    const books = await this.prisma.book.findMany({
      where: {
        isDeleted: false,
        OR: [
          { title: { contains: trimmedTerm, mode: 'insensitive' } },
          { author: { contains: trimmedTerm, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        author: true,
      },
      take: 10,
      orderBy: { title: 'asc' },
    });

    const suggestions = books.map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
    }));

    return { suggestions };
  }

  /**
   * Group books by category with counts for browsing.
   */
  async browseByCategory() {
    const categories = await this.prisma.book.groupBy({
      by: ['category'],
      where: { isDeleted: false },
      _count: {
        _all: true,
      },
      _sum: {
        availableCopies: true,
        totalCopies: true,
      },
      orderBy: {
        category: 'asc',
      },
    });

    const result = categories.map((cat) => ({
      category: cat.category,
      totalBooks: cat._count._all,
      totalCopies: cat._sum.totalCopies || 0,
      availableCopies: cat._sum.availableCopies || 0,
    }));

    return { categories: result };
  }

  /**
   * Get the newest books ordered by creation date.
   */
  async getNewArrivals(limit: number = 10) {
    const books = await this.prisma.book.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        _count: {
          select: {
            transactions: true,
            reservations: true,
          },
        },
      },
    });

    return { books };
  }

  /**
   * Get the most popular books based on the number of transactions.
   */
  async getPopular(limit: number = 10) {
    // Group transactions by bookId and count them
    const popularBookIds = await this.prisma.transaction.groupBy({
      by: ['bookId'],
      _count: {
        bookId: true,
      },
      orderBy: {
        _count: {
          bookId: 'desc',
        },
      },
      take: limit,
    });

    if (popularBookIds.length === 0) {
      return { books: [] };
    }

    const bookIds = popularBookIds.map((entry) => entry.bookId);
    const borrowCounts = new Map(
      popularBookIds.map((entry) => [entry.bookId, entry._count.bookId]),
    );

    const books = await this.prisma.book.findMany({
      where: {
        id: { in: bookIds },
        isDeleted: false,
      },
      include: {
        _count: {
          select: {
            transactions: true,
            reservations: true,
          },
        },
      },
    });

    // Sort books in the same order as the grouped results
    const sortedBooks = books
      .map((book) => ({
        ...book,
        borrowCount: borrowCounts.get(book.id) || 0,
      }))
      .sort((a, b) => b.borrowCount - a.borrowCount);

    return { books: sortedBooks };
  }
}
