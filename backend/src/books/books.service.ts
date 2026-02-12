import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookQueryDto } from './dto/book-query.dto';

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

  private static readonly ALLOWED_SORT_FIELDS: Record<string, string> = {
    title: 'title',
    author: 'author',
    publicationYear: 'publicationYear',
    category: 'category',
    language: 'language',
    pages: 'pages',
    totalCopies: 'totalCopies',
    availableCopies: 'availableCopies',
    price: 'price',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  };

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: BookQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy,
      sortOrder = 'desc',
      category,
      language,
      available,
      yearFrom,
      yearTo,
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.BookWhereInput = {
      isDeleted: false,
    };

    // Search across title, author, and isbn
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { isbn: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }

    // Language filter
    if (language) {
      where.language = { equals: language, mode: 'insensitive' };
    }

    // Availability filter
    if (available === true) {
      where.availableCopies = { gt: 0 };
    } else if (available === false) {
      where.availableCopies = { equals: 0 };
    }

    // Publication year range filter
    if (yearFrom !== undefined || yearTo !== undefined) {
      where.publicationYear = {};
      if (yearFrom !== undefined) {
        where.publicationYear.gte = yearFrom;
      }
      if (yearTo !== undefined) {
        where.publicationYear.lte = yearTo;
      }
    }

    // Build sort order - validate sortBy field to prevent injection
    const resolvedSortField =
      sortBy && BooksService.ALLOWED_SORT_FIELDS[sortBy]
        ? BooksService.ALLOWED_SORT_FIELDS[sortBy]
        : 'createdAt';

    const orderBy: Prisma.BookOrderByWithRelationInput = {
      [resolvedSortField]: sortOrder,
    };

    const [books, total] = await Promise.all([
      this.prisma.book.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          author: true,
          isbn: true,
          publisher: true,
          publicationYear: true,
          edition: true,
          category: true,
          language: true,
          pages: true,
          shelfLocation: true,
          callNumber: true,
          totalCopies: true,
          availableCopies: true,
          condition: true,
          price: true,
          coverImageUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.book.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: books,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const book = await this.prisma.book.findFirst({
      where: { id, isDeleted: false },
      include: {
        _count: {
          select: {
            reservations: {
              where: { status: 'active' },
            },
          },
        },
      },
    });

    if (!book) {
      throw new NotFoundException(`Book with ID "${id}" not found`);
    }

    const { _count, ...bookData } = book;

    return {
      ...bookData,
      activeReservationCount: _count.reservations,
    };
  }

  async create(dto: CreateBookDto) {
    // Validate ISBN uniqueness
    const existingBook = await this.prisma.book.findUnique({
      where: { isbn: dto.isbn },
    });

    if (existingBook) {
      throw new ConflictException(
        `A book with ISBN "${dto.isbn}" already exists`,
      );
    }

    // Validate availableCopies does not exceed totalCopies
    if (dto.availableCopies > dto.totalCopies) {
      throw new BadRequestException(
        'Available copies cannot exceed total copies',
      );
    }

    const data: Prisma.BookCreateInput = {
      title: dto.title,
      author: dto.author,
      isbn: dto.isbn,
      publisher: dto.publisher,
      publicationYear: dto.publicationYear,
      edition: dto.edition,
      category: dto.category,
      language: dto.language ?? 'English',
      pages: dto.pages,
      shelfLocation: dto.shelfLocation,
      callNumber: dto.callNumber,
      totalCopies: dto.totalCopies,
      availableCopies: dto.availableCopies,
      condition: dto.condition,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
      price: dto.price !== undefined ? dto.price : undefined,
      description: dto.description,
      coverImageUrl: dto.coverImageUrl,
    };

    const book = await this.prisma.book.create({ data });

    this.logger.log(`Book created: "${book.title}" (ID: ${book.id})`);

    return book;
  }

  async update(id: string, dto: UpdateBookDto) {
    const existingBook = await this.prisma.book.findFirst({
      where: { id, isDeleted: false },
    });

    if (!existingBook) {
      throw new NotFoundException(`Book with ID "${id}" not found`);
    }

    // If ISBN is being changed, check for uniqueness
    if (dto.isbn && dto.isbn !== existingBook.isbn) {
      const isbnConflict = await this.prisma.book.findUnique({
        where: { isbn: dto.isbn },
      });

      if (isbnConflict) {
        throw new ConflictException(
          `A book with ISBN "${dto.isbn}" already exists`,
        );
      }
    }

    // Validate availableCopies vs totalCopies
    const finalTotalCopies = dto.totalCopies ?? existingBook.totalCopies;
    const finalAvailableCopies =
      dto.availableCopies ?? existingBook.availableCopies;

    if (finalAvailableCopies > finalTotalCopies) {
      throw new BadRequestException(
        'Available copies cannot exceed total copies',
      );
    }

    const data: Prisma.BookUpdateInput = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.author !== undefined) data.author = dto.author;
    if (dto.isbn !== undefined) data.isbn = dto.isbn;
    if (dto.publisher !== undefined) data.publisher = dto.publisher;
    if (dto.publicationYear !== undefined)
      data.publicationYear = dto.publicationYear;
    if (dto.edition !== undefined) data.edition = dto.edition;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.language !== undefined) data.language = dto.language;
    if (dto.pages !== undefined) data.pages = dto.pages;
    if (dto.shelfLocation !== undefined)
      data.shelfLocation = dto.shelfLocation;
    if (dto.callNumber !== undefined) data.callNumber = dto.callNumber;
    if (dto.totalCopies !== undefined) data.totalCopies = dto.totalCopies;
    if (dto.availableCopies !== undefined)
      data.availableCopies = dto.availableCopies;
    if (dto.condition !== undefined) data.condition = dto.condition;
    if (dto.purchaseDate !== undefined)
      data.purchaseDate = dto.purchaseDate ? new Date(dto.purchaseDate) : null;
    if (dto.price !== undefined) data.price = dto.price;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.coverImageUrl !== undefined)
      data.coverImageUrl = dto.coverImageUrl;

    const book = await this.prisma.book.update({
      where: { id },
      data,
    });

    this.logger.log(`Book updated: "${book.title}" (ID: ${book.id})`);

    return book;
  }

  async remove(id: string) {
    const book = await this.prisma.book.findFirst({
      where: { id, isDeleted: false },
    });

    if (!book) {
      throw new NotFoundException(`Book with ID "${id}" not found`);
    }

    // Check for active transactions before soft-deleting
    const activeTransactions = await this.prisma.transaction.count({
      where: {
        bookId: id,
        status: 'issued',
      },
    });

    if (activeTransactions > 0) {
      throw new ConflictException(
        `Cannot delete book "${book.title}" because it has ${activeTransactions} active transaction(s). Return all copies first.`,
      );
    }

    // Cancel any active reservations for this book
    await this.prisma.reservation.updateMany({
      where: {
        bookId: id,
        status: 'active',
      },
      data: {
        status: 'cancelled',
      },
    });

    const deletedBook = await this.prisma.book.update({
      where: { id },
      data: { isDeleted: true },
    });

    this.logger.log(
      `Book soft-deleted: "${deletedBook.title}" (ID: ${deletedBook.id})`,
    );

    return {
      message: `Book "${deletedBook.title}" has been deleted successfully`,
      id: deletedBook.id,
    };
  }

  async bulkImport(records: Record<string, string>[]) {
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as { row: number; isbn: string; error: string }[],
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      try {
        const isbn = record.isbn?.trim();

        if (!isbn) {
          results.errors.push({
            row: i + 1,
            isbn: isbn || 'N/A',
            error: 'ISBN is required',
          });
          results.skipped++;
          continue;
        }

        // Check for duplicate ISBN
        const existing = await this.prisma.book.findUnique({
          where: { isbn },
        });

        if (existing) {
          results.errors.push({
            row: i + 1,
            isbn,
            error: 'A book with this ISBN already exists',
          });
          results.skipped++;
          continue;
        }

        // Validate required fields
        const title = record.title?.trim();
        const author = record.author?.trim();
        const category = record.category?.trim();
        const shelfLocation = record.shelfLocation?.trim();
        const callNumber = record.callNumber?.trim();

        if (!title || !author || !category || !shelfLocation || !callNumber) {
          results.errors.push({
            row: i + 1,
            isbn,
            error:
              'Missing required fields: title, author, category, shelfLocation, or callNumber',
          });
          results.skipped++;
          continue;
        }

        const totalCopies = parseInt(record.totalCopies, 10) || 1;
        const availableCopies =
          parseInt(record.availableCopies, 10) || totalCopies;

        if (availableCopies > totalCopies) {
          results.errors.push({
            row: i + 1,
            isbn,
            error: 'Available copies cannot exceed total copies',
          });
          results.skipped++;
          continue;
        }

        const publicationYear = record.publicationYear
          ? parseInt(record.publicationYear, 10)
          : undefined;
        const pages = record.pages ? parseInt(record.pages, 10) : undefined;
        const price = record.price ? parseFloat(record.price) : undefined;

        // Validate condition value
        const validConditions = ['excellent', 'good', 'fair', 'poor'];
        const condition = record.condition?.trim().toLowerCase();
        const resolvedCondition =
          condition && validConditions.includes(condition)
            ? (condition as 'excellent' | 'good' | 'fair' | 'poor')
            : 'good';

        await this.prisma.book.create({
          data: {
            title,
            author,
            isbn,
            publisher: record.publisher?.trim() || null,
            publicationYear:
              publicationYear && !isNaN(publicationYear)
                ? publicationYear
                : null,
            edition: record.edition?.trim() || null,
            category,
            language: record.language?.trim() || 'English',
            pages: pages && !isNaN(pages) ? pages : null,
            shelfLocation,
            callNumber,
            totalCopies,
            availableCopies,
            condition: resolvedCondition,
            purchaseDate: record.purchaseDate
              ? new Date(record.purchaseDate)
              : null,
            price: price && !isNaN(price) ? price : null,
            description: record.description?.trim() || null,
            coverImageUrl: record.coverImageUrl?.trim() || null,
          },
        });

        results.imported++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        results.errors.push({
          row: i + 1,
          isbn: record.isbn || 'N/A',
          error: errorMessage,
        });
        results.skipped++;
      }
    }

    this.logger.log(
      `Bulk import completed: ${results.imported} imported, ${results.skipped} skipped`,
    );

    return results;
  }

  async findByIsbn(isbn: string) {
    const book = await this.prisma.book.findFirst({
      where: { isbn, isDeleted: false },
    });

    if (!book) {
      throw new NotFoundException(`Book with ISBN "${isbn}" not found`);
    }

    return book;
  }

  async getCategories() {
    const categories = await this.prisma.book.findMany({
      where: { isDeleted: false },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    return categories.map((c) => c.category);
  }
}
