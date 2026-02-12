import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '@/prisma/prisma.service';
import { SearchQueryDto } from './dto/search-query.dto';

const mockPrismaService = {
  book: {
    findMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  transaction: {
    groupBy: jest.fn(),
  },
};

describe('SearchService', () => {
  let service: SearchService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── search ─────────────────────────────────────────────────────────

  describe('search', () => {
    const mockBooks = [
      {
        id: 'book-1',
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        isbn: '978-0743273565',
        description: 'A novel about the American dream',
        category: 'Fiction',
        language: 'English',
        publicationYear: 1925,
        totalCopies: 5,
        availableCopies: 3,
        isDeleted: false,
        createdAt: new Date('2024-01-01'),
        _count: { transactions: 10, reservations: 2 },
      },
      {
        id: 'book-2',
        title: 'To Kill a Mockingbird',
        author: 'Harper Lee',
        isbn: '978-0061120084',
        description: 'A novel about racial injustice',
        category: 'Fiction',
        language: 'English',
        publicationYear: 1960,
        totalCopies: 3,
        availableCopies: 1,
        isDeleted: false,
        createdAt: new Date('2024-02-01'),
        _count: { transactions: 8, reservations: 1 },
      },
    ];

    it('should return books with default pagination when no filters are applied', async () => {
      const query: SearchQueryDto = { page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue(mockBooks);
      prisma.book.count.mockResolvedValue(2);

      const result = await service.search(query);

      expect(result).toEqual({
        books: mockBooks,
        pagination: {
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });

      expect(prisma.book.findMany).toHaveBeenCalledWith({
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
        include: {
          _count: {
            select: {
              transactions: true,
              reservations: true,
            },
          },
        },
      });

      expect(prisma.book.count).toHaveBeenCalledWith({
        where: { isDeleted: false },
      });
    });

    it('should apply full-text search across title, author, isbn, and description when q is provided', async () => {
      const query: SearchQueryDto = { q: 'gatsby', page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue([mockBooks[0]]);
      prisma.book.count.mockResolvedValue(1);

      const result = await service.search(query);

      expect(result.books).toHaveLength(1);
      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isDeleted: false,
            OR: [
              { title: { contains: 'gatsby', mode: 'insensitive' } },
              { author: { contains: 'gatsby', mode: 'insensitive' } },
              { isbn: { contains: 'gatsby', mode: 'insensitive' } },
              { description: { contains: 'gatsby', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('should filter by author when author is provided', async () => {
      const query: SearchQueryDto = { author: 'Fitzgerald', page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue([mockBooks[0]]);
      prisma.book.count.mockResolvedValue(1);

      await service.search(query);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            author: { contains: 'Fitzgerald', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should filter by category when category is provided', async () => {
      const query: SearchQueryDto = { category: 'Fiction', page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue(mockBooks);
      prisma.book.count.mockResolvedValue(2);

      await service.search(query);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { contains: 'Fiction', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should filter by language when language is provided', async () => {
      const query: SearchQueryDto = { language: 'English', page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue(mockBooks);
      prisma.book.count.mockResolvedValue(2);

      await service.search(query);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            language: { equals: 'English', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should filter by yearFrom when yearFrom is provided', async () => {
      const query: SearchQueryDto = { yearFrom: 1950, page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue([mockBooks[1]]);
      prisma.book.count.mockResolvedValue(1);

      await service.search(query);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            publicationYear: { gte: 1950 },
          }),
        }),
      );
    });

    it('should filter by yearTo when yearTo is provided', async () => {
      const query: SearchQueryDto = { yearTo: 1950, page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue([mockBooks[0]]);
      prisma.book.count.mockResolvedValue(1);

      await service.search(query);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            publicationYear: { lte: 1950 },
          }),
        }),
      );
    });

    it('should filter by both yearFrom and yearTo when both are provided', async () => {
      const query: SearchQueryDto = { yearFrom: 1920, yearTo: 1960, page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue(mockBooks);
      prisma.book.count.mockResolvedValue(2);

      await service.search(query);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            publicationYear: { gte: 1920, lte: 1960 },
          }),
        }),
      );
    });

    it('should filter for available books when available is true', async () => {
      const query: SearchQueryDto = { available: true, page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue(mockBooks);
      prisma.book.count.mockResolvedValue(2);

      await service.search(query);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            availableCopies: { gt: 0 },
          }),
        }),
      );
    });

    it('should filter for unavailable books when available is false', async () => {
      const query: SearchQueryDto = { available: false, page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue([]);
      prisma.book.count.mockResolvedValue(0);

      await service.search(query);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            availableCopies: { equals: 0 },
          }),
        }),
      );
    });

    it('should not add availableCopies filter when available is undefined', async () => {
      const query: SearchQueryDto = { page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue(mockBooks);
      prisma.book.count.mockResolvedValue(2);

      await service.search(query);

      const calledWhere = prisma.book.findMany.mock.calls[0][0].where;
      expect(calledWhere).not.toHaveProperty('availableCopies');
    });

    it('should apply multiple filters simultaneously', async () => {
      const query: SearchQueryDto = {
        q: 'novel',
        author: 'Lee',
        category: 'Fiction',
        language: 'English',
        yearFrom: 1950,
        yearTo: 1970,
        available: true,
        page: 1,
        limit: 20,
      };

      prisma.book.findMany.mockResolvedValue([mockBooks[1]]);
      prisma.book.count.mockResolvedValue(1);

      await service.search(query);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isDeleted: false,
            OR: [
              { title: { contains: 'novel', mode: 'insensitive' } },
              { author: { contains: 'novel', mode: 'insensitive' } },
              { isbn: { contains: 'novel', mode: 'insensitive' } },
              { description: { contains: 'novel', mode: 'insensitive' } },
            ],
            author: { contains: 'Lee', mode: 'insensitive' },
            category: { contains: 'Fiction', mode: 'insensitive' },
            language: { equals: 'English', mode: 'insensitive' },
            publicationYear: { gte: 1950, lte: 1970 },
            availableCopies: { gt: 0 },
          },
        }),
      );
    });

    // ─── sorting ──────────────────────────────────────────────────────

    it('should sort by title ascending when sort is "title"', async () => {
      const query: SearchQueryDto = { sort: 'title', page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue(mockBooks);
      prisma.book.count.mockResolvedValue(2);

      await service.search(query);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { title: 'asc' },
        }),
      );
    });

    it('should sort by author ascending when sort is "author"', async () => {
      const query: SearchQueryDto = { sort: 'author', page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue(mockBooks);
      prisma.book.count.mockResolvedValue(2);

      await service.search(query);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { author: 'asc' },
        }),
      );
    });

    it('should sort by publication year descending when sort is "year"', async () => {
      const query: SearchQueryDto = { sort: 'year', page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue(mockBooks);
      prisma.book.count.mockResolvedValue(2);

      await service.search(query);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { publicationYear: 'desc' },
        }),
      );
    });

    it('should sort by popularity (transaction count descending) when sort is "popularity"', async () => {
      const query: SearchQueryDto = { sort: 'popularity', page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue(mockBooks);
      prisma.book.count.mockResolvedValue(2);

      await service.search(query);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { transactions: { _count: 'desc' } },
        }),
      );
    });

    it('should sort by createdAt descending by default when no sort is specified', async () => {
      const query: SearchQueryDto = { page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue(mockBooks);
      prisma.book.count.mockResolvedValue(2);

      await service.search(query);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    // ─── pagination ───────────────────────────────────────────────────

    it('should calculate correct skip value for pagination', async () => {
      const query: SearchQueryDto = { page: 3, limit: 10 };

      prisma.book.findMany.mockResolvedValue([]);
      prisma.book.count.mockResolvedValue(25);

      const result = await service.search(query);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );

      expect(result.pagination).toEqual({
        total: 25,
        page: 3,
        limit: 10,
        totalPages: 3,
        hasNextPage: false,
        hasPreviousPage: true,
      });
    });

    it('should set hasNextPage to true when there are more pages', async () => {
      const query: SearchQueryDto = { page: 1, limit: 10 };

      prisma.book.findMany.mockResolvedValue(mockBooks);
      prisma.book.count.mockResolvedValue(25);

      const result = await service.search(query);

      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(false);
      expect(result.pagination.totalPages).toBe(3);
    });

    it('should set hasPreviousPage to true when on page > 1', async () => {
      const query: SearchQueryDto = { page: 2, limit: 10 };

      prisma.book.findMany.mockResolvedValue(mockBooks);
      prisma.book.count.mockResolvedValue(25);

      const result = await service.search(query);

      expect(result.pagination.hasPreviousPage).toBe(true);
      expect(result.pagination.hasNextPage).toBe(true);
    });

    it('should handle empty results with correct pagination', async () => {
      const query: SearchQueryDto = { q: 'nonexistent', page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue([]);
      prisma.book.count.mockResolvedValue(0);

      const result = await service.search(query);

      expect(result).toEqual({
        books: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });

    it('should calculate totalPages correctly with ceiling division', async () => {
      const query: SearchQueryDto = { page: 1, limit: 10 };

      prisma.book.findMany.mockResolvedValue(mockBooks);
      prisma.book.count.mockResolvedValue(21);

      const result = await service.search(query);

      expect(result.pagination.totalPages).toBe(3);
    });

    it('should call findMany and count in parallel via Promise.all', async () => {
      const query: SearchQueryDto = { page: 1, limit: 20 };

      prisma.book.findMany.mockResolvedValue(mockBooks);
      prisma.book.count.mockResolvedValue(2);

      await service.search(query);

      expect(prisma.book.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.book.count).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getSuggestions ─────────────────────────────────────────────────

  describe('getSuggestions', () => {
    const mockSuggestionBooks = [
      { id: 'book-1', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
      { id: 'book-2', title: 'Great Expectations', author: 'Charles Dickens' },
    ];

    it('should return top 10 autocomplete suggestions matching the term', async () => {
      prisma.book.findMany.mockResolvedValue(mockSuggestionBooks);

      const result = await service.getSuggestions('great');

      expect(result).toEqual({
        suggestions: [
          { id: 'book-1', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
          { id: 'book-2', title: 'Great Expectations', author: 'Charles Dickens' },
        ],
      });

      expect(prisma.book.findMany).toHaveBeenCalledWith({
        where: {
          isDeleted: false,
          OR: [
            { title: { contains: 'great', mode: 'insensitive' } },
            { author: { contains: 'great', mode: 'insensitive' } },
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
    });

    it('should return empty suggestions for an empty string', async () => {
      const result = await service.getSuggestions('');

      expect(result).toEqual({ suggestions: [] });
      expect(prisma.book.findMany).not.toHaveBeenCalled();
    });

    it('should return empty suggestions for a whitespace-only string', async () => {
      const result = await service.getSuggestions('   ');

      expect(result).toEqual({ suggestions: [] });
      expect(prisma.book.findMany).not.toHaveBeenCalled();
    });

    it('should return empty suggestions for null/undefined term', async () => {
      const result = await service.getSuggestions(null as unknown as string);

      expect(result).toEqual({ suggestions: [] });
      expect(prisma.book.findMany).not.toHaveBeenCalled();
    });

    it('should trim the search term before querying', async () => {
      prisma.book.findMany.mockResolvedValue([]);

      await service.getSuggestions('  gatsby  ');

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: 'gatsby', mode: 'insensitive' } },
              { author: { contains: 'gatsby', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should return empty array when no books match the term', async () => {
      prisma.book.findMany.mockResolvedValue([]);

      const result = await service.getSuggestions('zzzznonexistent');

      expect(result).toEqual({ suggestions: [] });
    });

    it('should limit results to 10 suggestions', async () => {
      prisma.book.findMany.mockResolvedValue(mockSuggestionBooks);

      await service.getSuggestions('some term');

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });

    it('should only select id, title, and author fields', async () => {
      prisma.book.findMany.mockResolvedValue(mockSuggestionBooks);

      await service.getSuggestions('test');

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            title: true,
            author: true,
          },
        }),
      );
    });
  });

  // ─── browseByCategory ──────────────────────────────────────────────

  describe('browseByCategory', () => {
    it('should return categories with book counts and copy sums', async () => {
      const mockGroupByResult = [
        {
          category: 'Fiction',
          _count: { _all: 15 },
          _sum: { availableCopies: 25, totalCopies: 40 },
        },
        {
          category: 'Science',
          _count: { _all: 8 },
          _sum: { availableCopies: 12, totalCopies: 20 },
        },
      ];

      prisma.book.groupBy.mockResolvedValue(mockGroupByResult);

      const result = await service.browseByCategory();

      expect(result).toEqual({
        categories: [
          { category: 'Fiction', totalBooks: 15, totalCopies: 40, availableCopies: 25 },
          { category: 'Science', totalBooks: 8, totalCopies: 20, availableCopies: 12 },
        ],
      });

      expect(prisma.book.groupBy).toHaveBeenCalledWith({
        by: ['category'],
        where: { isDeleted: false },
        _count: { _all: true },
        _sum: { availableCopies: true, totalCopies: true },
        orderBy: { category: 'asc' },
      });
    });

    it('should return empty categories when no books exist', async () => {
      prisma.book.groupBy.mockResolvedValue([]);

      const result = await service.browseByCategory();

      expect(result).toEqual({ categories: [] });
    });

    it('should handle null sum values by defaulting to 0', async () => {
      const mockGroupByResult = [
        {
          category: 'Empty Category',
          _count: { _all: 0 },
          _sum: { availableCopies: null, totalCopies: null },
        },
      ];

      prisma.book.groupBy.mockResolvedValue(mockGroupByResult);

      const result = await service.browseByCategory();

      expect(result).toEqual({
        categories: [
          { category: 'Empty Category', totalBooks: 0, totalCopies: 0, availableCopies: 0 },
        ],
      });
    });

    it('should only group non-deleted books', async () => {
      prisma.book.groupBy.mockResolvedValue([]);

      await service.browseByCategory();

      expect(prisma.book.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isDeleted: false },
        }),
      );
    });

    it('should order categories alphabetically', async () => {
      prisma.book.groupBy.mockResolvedValue([]);

      await service.browseByCategory();

      expect(prisma.book.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { category: 'asc' },
        }),
      );
    });
  });

  // ─── getNewArrivals ────────────────────────────────────────────────

  describe('getNewArrivals', () => {
    const mockNewBooks = [
      {
        id: 'book-3',
        title: 'New Book',
        author: 'New Author',
        createdAt: new Date('2024-06-01'),
        isDeleted: false,
        _count: { transactions: 0, reservations: 0 },
      },
      {
        id: 'book-2',
        title: 'Recent Book',
        author: 'Recent Author',
        createdAt: new Date('2024-05-01'),
        isDeleted: false,
        _count: { transactions: 2, reservations: 1 },
      },
    ];

    it('should return newest books ordered by creation date', async () => {
      prisma.book.findMany.mockResolvedValue(mockNewBooks);

      const result = await service.getNewArrivals();

      expect(result).toEqual({ books: mockNewBooks });

      expect(prisma.book.findMany).toHaveBeenCalledWith({
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          _count: {
            select: {
              transactions: true,
              reservations: true,
            },
          },
        },
      });
    });

    it('should use default limit of 10 when no limit is provided', async () => {
      prisma.book.findMany.mockResolvedValue([]);

      await service.getNewArrivals();

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });

    it('should use custom limit when provided', async () => {
      prisma.book.findMany.mockResolvedValue([]);

      await service.getNewArrivals(5);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        }),
      );
    });

    it('should only return non-deleted books', async () => {
      prisma.book.findMany.mockResolvedValue([]);

      await service.getNewArrivals();

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isDeleted: false },
        }),
      );
    });

    it('should return empty books array when no books exist', async () => {
      prisma.book.findMany.mockResolvedValue([]);

      const result = await service.getNewArrivals();

      expect(result).toEqual({ books: [] });
    });

    it('should include transaction and reservation counts', async () => {
      prisma.book.findMany.mockResolvedValue(mockNewBooks);

      await service.getNewArrivals();

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            _count: {
              select: {
                transactions: true,
                reservations: true,
              },
            },
          },
        }),
      );
    });
  });

  // ─── getPopular ────────────────────────────────────────────────────

  describe('getPopular', () => {
    const mockPopularGroupBy = [
      { bookId: 'book-1', _count: { bookId: 25 } },
      { bookId: 'book-2', _count: { bookId: 18 } },
      { bookId: 'book-3', _count: { bookId: 10 } },
    ];

    const mockPopularBooks = [
      {
        id: 'book-2',
        title: 'Second Most Popular',
        author: 'Author B',
        isDeleted: false,
        _count: { transactions: 18, reservations: 3 },
      },
      {
        id: 'book-1',
        title: 'Most Popular',
        author: 'Author A',
        isDeleted: false,
        _count: { transactions: 25, reservations: 5 },
      },
      {
        id: 'book-3',
        title: 'Third Most Popular',
        author: 'Author C',
        isDeleted: false,
        _count: { transactions: 10, reservations: 1 },
      },
    ];

    it('should return most popular books sorted by transaction count descending', async () => {
      prisma.transaction.groupBy.mockResolvedValue(mockPopularGroupBy);
      prisma.book.findMany.mockResolvedValue(mockPopularBooks);

      const result = await service.getPopular();

      expect(result.books).toHaveLength(3);
      // Verify sorted order: book-1 (25), book-2 (18), book-3 (10)
      expect(result.books[0].id).toBe('book-1');
      expect(result.books[0].borrowCount).toBe(25);
      expect(result.books[1].id).toBe('book-2');
      expect(result.books[1].borrowCount).toBe(18);
      expect(result.books[2].id).toBe('book-3');
      expect(result.books[2].borrowCount).toBe(10);
    });

    it('should group transactions by bookId and count them', async () => {
      prisma.transaction.groupBy.mockResolvedValue(mockPopularGroupBy);
      prisma.book.findMany.mockResolvedValue(mockPopularBooks);

      await service.getPopular();

      expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
        by: ['bookId'],
        _count: { bookId: true },
        orderBy: { _count: { bookId: 'desc' } },
        take: 10,
      });
    });

    it('should fetch books by the grouped bookIds', async () => {
      prisma.transaction.groupBy.mockResolvedValue(mockPopularGroupBy);
      prisma.book.findMany.mockResolvedValue(mockPopularBooks);

      await service.getPopular();

      expect(prisma.book.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['book-1', 'book-2', 'book-3'] },
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
    });

    it('should return empty books array when no transactions exist', async () => {
      prisma.transaction.groupBy.mockResolvedValue([]);

      const result = await service.getPopular();

      expect(result).toEqual({ books: [] });
      expect(prisma.book.findMany).not.toHaveBeenCalled();
    });

    it('should use default limit of 10 when no limit is provided', async () => {
      prisma.transaction.groupBy.mockResolvedValue([]);

      await service.getPopular();

      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });

    it('should use custom limit when provided', async () => {
      prisma.transaction.groupBy.mockResolvedValue([]);

      await service.getPopular(5);

      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        }),
      );
    });

    it('should add borrowCount to each book from the transaction groupBy', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { bookId: 'book-1', _count: { bookId: 42 } },
      ]);
      prisma.book.findMany.mockResolvedValue([
        {
          id: 'book-1',
          title: 'Popular Book',
          author: 'Author',
          isDeleted: false,
          _count: { transactions: 42, reservations: 5 },
        },
      ]);

      const result = await service.getPopular();

      expect(result.books[0]).toHaveProperty('borrowCount', 42);
    });

    it('should default borrowCount to 0 if bookId is not found in the count map', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { bookId: 'book-1', _count: { bookId: 10 } },
      ]);
      // Return a book that was not in the groupBy results (edge case)
      prisma.book.findMany.mockResolvedValue([
        {
          id: 'book-unknown',
          title: 'Unknown Book',
          author: 'Author',
          isDeleted: false,
          _count: { transactions: 0, reservations: 0 },
        },
      ]);

      const result = await service.getPopular();

      expect(result.books[0].borrowCount).toBe(0);
    });

    it('should sort books in descending order by borrowCount', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { bookId: 'book-a', _count: { bookId: 5 } },
        { bookId: 'book-b', _count: { bookId: 50 } },
      ]);
      // Prisma returns them in a different order than the groupBy
      prisma.book.findMany.mockResolvedValue([
        {
          id: 'book-a',
          title: 'Less Popular',
          author: 'Author A',
          isDeleted: false,
          _count: { transactions: 5, reservations: 0 },
        },
        {
          id: 'book-b',
          title: 'More Popular',
          author: 'Author B',
          isDeleted: false,
          _count: { transactions: 50, reservations: 3 },
        },
      ]);

      const result = await service.getPopular();

      expect(result.books[0].id).toBe('book-b');
      expect(result.books[0].borrowCount).toBe(50);
      expect(result.books[1].id).toBe('book-a');
      expect(result.books[1].borrowCount).toBe(5);
    });

    it('should only fetch non-deleted books', async () => {
      prisma.transaction.groupBy.mockResolvedValue(mockPopularGroupBy);
      prisma.book.findMany.mockResolvedValue(mockPopularBooks);

      await service.getPopular();

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isDeleted: false,
          }),
        }),
      );
    });
  });
});
