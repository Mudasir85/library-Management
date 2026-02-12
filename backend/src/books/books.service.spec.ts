import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateBookDto, BookCondition } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';

const mockPrismaService = {
  book: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  transaction: {
    count: jest.fn(),
  },
  reservation: {
    updateMany: jest.fn(),
  },
};

describe('BooksService', () => {
  let service: BooksService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<BooksService>(BooksService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── create ─────────────────────────────────────────────────────────

  describe('create', () => {
    const createBookDto: CreateBookDto = {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: '978-0132350884',
      publisher: 'Prentice Hall',
      publicationYear: 2008,
      category: 'Computer Science',
      shelfLocation: 'A3-S2-R4',
      callNumber: 'QA76.73.J38 M37 2008',
      totalCopies: 3,
      availableCopies: 2,
      condition: BookCondition.GOOD,
    };

    const createdBook = {
      id: 'book-1',
      ...createBookDto,
      language: 'English',
      pages: null,
      edition: null,
      purchaseDate: null,
      price: null,
      description: null,
      coverImageUrl: null,
      isDeleted: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    it('should create a book successfully', async () => {
      prisma.book.findUnique.mockResolvedValue(null); // No duplicate ISBN
      prisma.book.create.mockResolvedValue(createdBook);

      const result = await service.create(createBookDto);

      expect(result).toEqual(createdBook);
      expect(prisma.book.findUnique).toHaveBeenCalledWith({
        where: { isbn: '978-0132350884' },
      });
      expect(prisma.book.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Clean Code',
          author: 'Robert C. Martin',
          isbn: '978-0132350884',
          totalCopies: 3,
          availableCopies: 2,
        }),
      });
    });

    it('should throw ConflictException for duplicate ISBN', async () => {
      prisma.book.findUnique.mockResolvedValue({
        id: 'existing-book',
        isbn: '978-0132350884',
      });

      await expect(service.create(createBookDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createBookDto)).rejects.toThrow(
        'A book with ISBN "978-0132350884" already exists',
      );

      expect(prisma.book.create).not.toHaveBeenCalled();
    });

    it('should validate available copies <= total copies', async () => {
      const invalidDto: CreateBookDto = {
        ...createBookDto,
        totalCopies: 2,
        availableCopies: 5, // exceeds totalCopies
      };

      prisma.book.findUnique.mockResolvedValue(null);

      await expect(service.create(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(invalidDto)).rejects.toThrow(
        'Available copies cannot exceed total copies',
      );

      expect(prisma.book.create).not.toHaveBeenCalled();
    });

    it('should set default language to English when not provided', async () => {
      const dtoWithoutLanguage: CreateBookDto = {
        ...createBookDto,
        language: undefined,
      };

      prisma.book.findUnique.mockResolvedValue(null);
      prisma.book.create.mockResolvedValue({
        ...createdBook,
        language: 'English',
      });

      await service.create(dtoWithoutLanguage);

      expect(prisma.book.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          language: 'English',
        }),
      });
    });
  });

  // ─── findAll ────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should find all books with pagination', async () => {
      const mockBooks = [
        {
          id: 'book-1',
          title: 'Clean Code',
          author: 'Robert C. Martin',
          isbn: '978-0132350884',
          publisher: 'Prentice Hall',
          publicationYear: 2008,
          edition: null,
          category: 'Computer Science',
          language: 'English',
          pages: 464,
          shelfLocation: 'A3-S2-R4',
          callNumber: 'QA76.73.J38 M37',
          totalCopies: 3,
          availableCopies: 2,
          condition: 'good',
          price: null,
          coverImageUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.book.findMany.mockResolvedValue(mockBooks);
      prisma.book.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20, sortOrder: 'desc' } as any);

      expect(result).toEqual({
        data: mockBooks,
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isDeleted: false },
          skip: 0,
          take: 20,
        }),
      );
      expect(prisma.book.count).toHaveBeenCalled();
    });

    it('should apply search filter across title, author, and isbn', async () => {
      prisma.book.findMany.mockResolvedValue([]);
      prisma.book.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 20,
        search: 'clean',
        sortOrder: 'desc',
      } as any);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isDeleted: false,
            OR: [
              { title: { contains: 'clean', mode: 'insensitive' } },
              { author: { contains: 'clean', mode: 'insensitive' } },
              { isbn: { contains: 'clean', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should apply category filter', async () => {
      prisma.book.findMany.mockResolvedValue([]);
      prisma.book.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 20,
        category: 'Fiction',
        sortOrder: 'desc',
      } as any);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { equals: 'Fiction', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should apply availability filter for available books', async () => {
      prisma.book.findMany.mockResolvedValue([]);
      prisma.book.count.mockResolvedValue(0);

      await service.findAll({
        page: 1,
        limit: 20,
        available: true,
        sortOrder: 'desc',
      } as any);

      expect(prisma.book.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            availableCopies: { gt: 0 },
          }),
        }),
      );
    });

    it('should calculate pagination metadata correctly', async () => {
      prisma.book.findMany.mockResolvedValue([]);
      prisma.book.count.mockResolvedValue(55);

      const result = await service.findAll({
        page: 2,
        limit: 20,
        sortOrder: 'desc',
      } as any);

      expect(result.meta).toEqual({
        total: 55,
        page: 2,
        limit: 20,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should find one book by ID', async () => {
      const mockBook = {
        id: 'book-1',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '978-0132350884',
        isDeleted: false,
        _count: {
          reservations: 2,
        },
      };

      prisma.book.findFirst.mockResolvedValue(mockBook);

      const result = await service.findOne('book-1');

      expect(result).toEqual({
        id: 'book-1',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '978-0132350884',
        isDeleted: false,
        activeReservationCount: 2,
      });

      expect(prisma.book.findFirst).toHaveBeenCalledWith({
        where: { id: 'book-1', isDeleted: false },
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
    });

    it('should throw NotFoundException for non-existent book', async () => {
      prisma.book.findFirst.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Book with ID "nonexistent" not found',
      );
    });
  });

  // ─── update ─────────────────────────────────────────────────────────

  describe('update', () => {
    const existingBook = {
      id: 'book-1',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: '978-0132350884',
      totalCopies: 3,
      availableCopies: 2,
      isDeleted: false,
    };

    it('should update a book successfully', async () => {
      prisma.book.findFirst.mockResolvedValue(existingBook);

      const updateDto: UpdateBookDto = { title: 'Clean Code 2nd Edition' };
      const updatedBook = { ...existingBook, ...updateDto };
      prisma.book.update.mockResolvedValue(updatedBook);

      const result = await service.update('book-1', updateDto);

      expect(result).toEqual(updatedBook);
      expect(prisma.book.update).toHaveBeenCalledWith({
        where: { id: 'book-1' },
        data: { title: 'Clean Code 2nd Edition' },
      });
    });

    it('should throw NotFoundException for updating non-existent book', async () => {
      prisma.book.findFirst.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { title: 'New Title' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when changing ISBN to existing ISBN', async () => {
      prisma.book.findFirst.mockResolvedValue(existingBook);
      prisma.book.findUnique.mockResolvedValue({
        id: 'other-book',
        isbn: '978-0000000000',
      });

      await expect(
        service.update('book-1', { isbn: '978-0000000000' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when available copies exceed total copies after update', async () => {
      prisma.book.findFirst.mockResolvedValue(existingBook);

      // Trying to set totalCopies to 1 while existing availableCopies is 2
      await expect(
        service.update('book-1', { totalCopies: 1 }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update('book-1', { totalCopies: 1 }),
      ).rejects.toThrow('Available copies cannot exceed total copies');
    });
  });

  // ─── remove (soft delete) ──────────────────────────────────────────

  describe('remove', () => {
    const existingBook = {
      id: 'book-1',
      title: 'Clean Code',
      isDeleted: false,
    };

    it('should soft delete a book', async () => {
      prisma.book.findFirst.mockResolvedValue(existingBook);
      prisma.transaction.count.mockResolvedValue(0); // No active transactions
      prisma.reservation.updateMany.mockResolvedValue({ count: 0 });
      prisma.book.update.mockResolvedValue({
        ...existingBook,
        isDeleted: true,
      });

      const result = await service.remove('book-1');

      expect(result).toEqual({
        message: 'Book "Clean Code" has been deleted successfully',
        id: 'book-1',
      });

      expect(prisma.book.update).toHaveBeenCalledWith({
        where: { id: 'book-1' },
        data: { isDeleted: true },
      });
    });

    it('should throw NotFoundException for deleting non-existent book', async () => {
      prisma.book.findFirst.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when book has active transactions', async () => {
      prisma.book.findFirst.mockResolvedValue(existingBook);
      prisma.transaction.count.mockResolvedValue(2); // 2 active transactions

      await expect(service.remove('book-1')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.remove('book-1')).rejects.toThrow(
        /Cannot delete book .* because it has 2 active transaction/,
      );
    });

    it('should cancel active reservations before soft deleting', async () => {
      prisma.book.findFirst.mockResolvedValue(existingBook);
      prisma.transaction.count.mockResolvedValue(0);
      prisma.reservation.updateMany.mockResolvedValue({ count: 3 });
      prisma.book.update.mockResolvedValue({
        ...existingBook,
        isDeleted: true,
      });

      await service.remove('book-1');

      expect(prisma.reservation.updateMany).toHaveBeenCalledWith({
        where: {
          bookId: 'book-1',
          status: 'active',
        },
        data: {
          status: 'cancelled',
        },
      });
    });
  });

  // ─── findByIsbn ────────────────────────────────────────────────────

  describe('findByIsbn', () => {
    it('should find a book by ISBN', async () => {
      const mockBook = {
        id: 'book-1',
        title: 'Clean Code',
        isbn: '978-0132350884',
        isDeleted: false,
      };

      prisma.book.findFirst.mockResolvedValue(mockBook);

      const result = await service.findByIsbn('978-0132350884');

      expect(result).toEqual(mockBook);
      expect(prisma.book.findFirst).toHaveBeenCalledWith({
        where: { isbn: '978-0132350884', isDeleted: false },
      });
    });

    it('should throw NotFoundException for non-existent ISBN', async () => {
      prisma.book.findFirst.mockResolvedValue(null);

      await expect(service.findByIsbn('000-0000000000')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── getCategories ─────────────────────────────────────────────────

  describe('getCategories', () => {
    it('should return distinct categories', async () => {
      prisma.book.findMany.mockResolvedValue([
        { category: 'Computer Science' },
        { category: 'Fiction' },
        { category: 'Mathematics' },
      ]);

      const result = await service.getCategories();

      expect(result).toEqual(['Computer Science', 'Fiction', 'Mathematics']);
      expect(prisma.book.findMany).toHaveBeenCalledWith({
        where: { isDeleted: false },
        select: { category: true },
        distinct: ['category'],
        orderBy: { category: 'asc' },
      });
    });
  });
});
