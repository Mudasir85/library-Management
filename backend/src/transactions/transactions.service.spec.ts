import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrismaService = {
  member: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  book: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  transaction: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  reservation: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  systemSetting: {
    findUnique: jest.fn(),
  },
  fine: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── issueBook ──────────────────────────────────────────────────────

  describe('issueBook', () => {
    const issueDto = {
      memberId: 'member-1',
      bookId: 'book-1',
    };
    const issuedById = 'librarian-1';

    const mockActiveMember = {
      id: 'member-1',
      fullName: 'John Doe',
      status: 'active',
      memberType: 'public',
      booksIssuedCount: 1,
      outstandingFines: new Prisma.Decimal(0),
    };

    const mockSettings = {
      memberType: 'public',
      maxBooksAllowed: 5,
      loanDurationDays: 14,
      renewalLimit: 2,
      finePerDay: new Prisma.Decimal(1),
      gracePeriodDays: 0,
    };

    const mockBook = {
      id: 'book-1',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: '978-0132350884',
      totalCopies: 3,
      availableCopies: 2,
      isDeleted: false,
    };

    it('should issue a book successfully', async () => {
      prisma.member.findUnique.mockResolvedValue(mockActiveMember);
      prisma.systemSetting.findUnique.mockResolvedValue(mockSettings);
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.transaction.findFirst.mockResolvedValue(null); // No existing transaction
      prisma.reservation.findFirst.mockResolvedValue(null); // No reservations

      const createdTransaction = {
        id: 'txn-1',
        memberId: 'member-1',
        bookId: 'book-1',
        issueDate: new Date(),
        dueDate: new Date(),
        status: 'issued',
        issuedById: 'librarian-1',
        renewalCount: 0,
        member: {
          id: 'member-1',
          fullName: 'John Doe',
          memberType: 'public',
          email: 'john@example.com',
        },
        book: {
          id: 'book-1',
          title: 'Clean Code',
          author: 'Robert C. Martin',
          isbn: '978-0132350884',
        },
        issuedBy: {
          id: 'librarian-1',
          fullName: 'Librarian Smith',
        },
      };

      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
        const tx = {
          transaction: {
            create: jest.fn().mockResolvedValue(createdTransaction),
          },
          book: {
            update: jest.fn().mockResolvedValue({}),
          },
          member: {
            update: jest.fn().mockResolvedValue({}),
          },
          reservation: {
            update: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      const result = await service.issueBook(issueDto, issuedById);

      expect(result).toEqual(createdTransaction);
      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { id: 'member-1' },
      });
      expect(prisma.systemSetting.findUnique).toHaveBeenCalledWith({
        where: { memberType: 'public' },
      });
      expect(prisma.book.findUnique).toHaveBeenCalledWith({
        where: { id: 'book-1' },
      });
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow('Member with ID "member-1" not found');
    });

    it('should throw error when member is not active', async () => {
      prisma.member.findUnique.mockResolvedValue({
        ...mockActiveMember,
        status: 'suspended',
      });

      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow(/Member account is suspended/);
    });

    it('should throw error when member exceeds book limit', async () => {
      prisma.member.findUnique.mockResolvedValue({
        ...mockActiveMember,
        booksIssuedCount: 5, // Already at max
      });
      prisma.systemSetting.findUnique.mockResolvedValue(mockSettings);

      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow(/Maximum allowed for public members is 5/);
    });

    it('should throw error when member has outstanding fines > $10', async () => {
      prisma.member.findUnique.mockResolvedValue({
        ...mockActiveMember,
        outstandingFines: new Prisma.Decimal(15.5),
      });
      prisma.systemSetting.findUnique.mockResolvedValue(mockSettings);

      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow(/outstanding fines of \$15\.50/);
    });

    it('should throw error when book is not available (no copies)', async () => {
      prisma.member.findUnique.mockResolvedValue(mockActiveMember);
      prisma.systemSetting.findUnique.mockResolvedValue(mockSettings);
      prisma.book.findUnique.mockResolvedValue({
        ...mockBook,
        availableCopies: 0,
      });

      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow(/No available copies/);
    });

    it('should throw NotFoundException when book does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(mockActiveMember);
      prisma.systemSetting.findUnique.mockResolvedValue(mockSettings);
      prisma.book.findUnique.mockResolvedValue(null);

      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow('Book with ID "book-1" not found');
    });

    it('should throw error when book is soft-deleted', async () => {
      prisma.member.findUnique.mockResolvedValue(mockActiveMember);
      prisma.systemSetting.findUnique.mockResolvedValue(mockSettings);
      prisma.book.findUnique.mockResolvedValue({
        ...mockBook,
        isDeleted: true,
      });

      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow('This book has been removed from the library catalog.');
    });

    it('should throw ConflictException when member already has this book issued', async () => {
      prisma.member.findUnique.mockResolvedValue(mockActiveMember);
      prisma.systemSetting.findUnique.mockResolvedValue(mockSettings);
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.transaction.findFirst.mockResolvedValue({
        id: 'existing-txn',
        memberId: 'member-1',
        bookId: 'book-1',
        status: 'issued',
      });

      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow(/already has an active issue/);
    });

    it('should throw ConflictException when book is reserved by another member', async () => {
      prisma.member.findUnique.mockResolvedValue(mockActiveMember);
      prisma.systemSetting.findUnique.mockResolvedValue(mockSettings);
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.transaction.findFirst.mockResolvedValue(null);
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'res-1',
        bookId: 'book-1',
        memberId: 'other-member', // Different member
        status: 'active',
      });

      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.issueBook(issueDto, issuedById),
      ).rejects.toThrow(/reserved by another member/);
    });

    it('should fulfill reservation when book is reserved by the same member', async () => {
      prisma.member.findUnique.mockResolvedValue(mockActiveMember);
      prisma.systemSetting.findUnique.mockResolvedValue(mockSettings);
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.transaction.findFirst.mockResolvedValue(null);
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'res-1',
        bookId: 'book-1',
        memberId: 'member-1', // Same member
        status: 'active',
      });

      const reservationUpdateMock = jest.fn().mockResolvedValue({});
      const createdTransaction = {
        id: 'txn-1',
        memberId: 'member-1',
        bookId: 'book-1',
        status: 'issued',
        member: { id: 'member-1', fullName: 'John Doe', memberType: 'public', email: 'john@example.com' },
        book: { id: 'book-1', title: 'Clean Code', author: 'R. Martin', isbn: '978-0132350884' },
        issuedBy: { id: 'librarian-1', fullName: 'Librarian Smith' },
      };

      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
        const tx = {
          transaction: { create: jest.fn().mockResolvedValue(createdTransaction) },
          book: { update: jest.fn().mockResolvedValue({}) },
          member: { update: jest.fn().mockResolvedValue({}) },
          reservation: { update: reservationUpdateMock },
        };
        return fn(tx);
      });

      await service.issueBook(issueDto, issuedById);

      expect(reservationUpdateMock).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: { status: 'fulfilled' },
      });
    });
  });

  // ─── returnBook ─────────────────────────────────────────────────────

  describe('returnBook', () => {
    const mockMember = {
      id: 'member-1',
      fullName: 'John Doe',
      memberType: 'public',
      email: 'john@example.com',
      booksIssuedCount: 1,
    };

    const mockBook = {
      id: 'book-1',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: '978-0132350884',
      price: new Prisma.Decimal(40),
    };

    const mockSettings = {
      memberType: 'public',
      maxBooksAllowed: 5,
      loanDurationDays: 14,
      renewalLimit: 2,
      finePerDay: new Prisma.Decimal(1),
      gracePeriodDays: 2,
    };

    it('should return a book with no fine when on time', async () => {
      // Create a transaction that is NOT overdue (due date in the future)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // Due in 7 days

      const mockTransaction = {
        id: 'txn-1',
        memberId: 'member-1',
        bookId: 'book-1',
        issueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        dueDate: futureDate,
        status: 'issued',
        renewalCount: 0,
        member: mockMember,
        book: mockBook,
      };

      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      prisma.systemSetting.findUnique.mockResolvedValue(mockSettings);

      const updatedTransaction = {
        ...mockTransaction,
        returnDate: new Date(),
        status: 'returned',
        fineAmount: new Prisma.Decimal(0),
        member: mockMember,
        book: { id: 'book-1', title: 'Clean Code', author: 'Robert C. Martin', isbn: '978-0132350884' },
        issuedBy: { id: 'librarian-1', fullName: 'Librarian Smith' },
        returnedTo: { id: 'librarian-2', fullName: 'Librarian Jones' },
        fines: [],
      };

      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
        const tx = {
          fine: { create: jest.fn() },
          transaction: { update: jest.fn().mockResolvedValue(updatedTransaction) },
          book: { update: jest.fn().mockResolvedValue({}) },
          member: {
            update: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          reservation: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        };
        return fn(tx);
      });

      const result = await service.returnBook(
        { transactionId: 'txn-1' },
        'librarian-2',
      );

      expect(result.fineApplied).toBe(false);
      expect(result.overdueDays).toBe(0);
    });

    it('should calculate fine correctly for overdue return', async () => {
      // Create a transaction that is overdue (due date was 10 days ago)
      const pastDueDate = new Date();
      pastDueDate.setDate(pastDueDate.getDate() - 10); // Due 10 days ago

      const mockTransaction = {
        id: 'txn-1',
        memberId: 'member-1',
        bookId: 'book-1',
        issueDate: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000),
        dueDate: pastDueDate,
        status: 'issued',
        renewalCount: 0,
        member: mockMember,
        book: mockBook,
      };

      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      prisma.systemSetting.findUnique.mockResolvedValue(mockSettings);

      const fineCreateMock = jest.fn().mockResolvedValue({
        id: 'fine-1',
        amount: new Prisma.Decimal(8),
      });

      const updatedTransaction = {
        ...mockTransaction,
        returnDate: new Date(),
        status: 'returned',
        fineAmount: new Prisma.Decimal(8), // 10 days overdue - 2 grace = 8 days * $1/day
        member: mockMember,
        book: { id: 'book-1', title: 'Clean Code', author: 'R. Martin', isbn: '978-0132350884' },
        issuedBy: { id: 'librarian-1', fullName: 'Librarian Smith' },
        returnedTo: { id: 'librarian-2', fullName: 'Librarian Jones' },
        fines: [{ id: 'fine-1', amount: new Prisma.Decimal(8) }],
      };

      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
        const tx = {
          fine: { create: fineCreateMock },
          transaction: { update: jest.fn().mockResolvedValue(updatedTransaction) },
          book: { update: jest.fn().mockResolvedValue({}) },
          member: {
            update: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          reservation: {
            findMany: jest.fn().mockResolvedValue([]),
          },
        };
        return fn(tx);
      });

      const result = await service.returnBook(
        { transactionId: 'txn-1' },
        'librarian-2',
      );

      // The fine should have been created (overdue days > grace period)
      expect(result.fineApplied).toBe(true);
      expect(result.overdueDays).toBeGreaterThan(0);
      expect(fineCreateMock).toHaveBeenCalled();
    });

    it('should throw NotFoundException when transaction not found', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);

      await expect(
        service.returnBook({ transactionId: 'nonexistent' }, 'librarian-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when transaction is already returned', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-1',
        status: 'returned',
        member: mockMember,
        book: mockBook,
      });

      await expect(
        service.returnBook({ transactionId: 'txn-1' }, 'librarian-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.returnBook({ transactionId: 'txn-1' }, 'librarian-1'),
      ).rejects.toThrow('This transaction has already been returned.');
    });

    it('should throw BadRequestException when neither transactionId nor bookId+memberId is provided', async () => {
      await expect(
        service.returnBook({}, 'librarian-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.returnBook({}, 'librarian-1'),
      ).rejects.toThrow(
        'Either transactionId or both bookId and memberId are required',
      );
    });

    it('should find transaction by bookId and memberId when transactionId is not provided', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const mockTransaction = {
        id: 'txn-1',
        memberId: 'member-1',
        bookId: 'book-1',
        dueDate: futureDate,
        status: 'issued',
        member: mockMember,
        book: mockBook,
      };

      prisma.transaction.findFirst.mockResolvedValue(mockTransaction);
      prisma.systemSetting.findUnique.mockResolvedValue(mockSettings);

      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
        const tx = {
          fine: { create: jest.fn() },
          transaction: {
            update: jest.fn().mockResolvedValue({
              ...mockTransaction,
              returnDate: new Date(),
              status: 'returned',
              fineAmount: new Prisma.Decimal(0),
              issuedBy: null,
              returnedTo: { id: 'librarian-1', fullName: 'Librarian' },
              fines: [],
            }),
          },
          book: { update: jest.fn().mockResolvedValue({}) },
          member: {
            update: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn().mockResolvedValue({}),
          },
          reservation: { findMany: jest.fn().mockResolvedValue([]) },
        };
        return fn(tx);
      });

      await service.returnBook(
        { bookId: 'book-1', memberId: 'member-1' },
        'librarian-1',
      );

      expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
        where: {
          bookId: 'book-1',
          memberId: 'member-1',
          status: { in: ['issued', 'overdue'] },
        },
        include: {
          member: true,
          book: true,
        },
      });
    });
  });

  // ─── renewBook ──────────────────────────────────────────────────────

  describe('renewBook', () => {
    const mockMember = {
      id: 'member-1',
      fullName: 'John Doe',
      memberType: 'public',
      email: 'john@example.com',
    };

    const mockSettings = {
      memberType: 'public',
      maxBooksAllowed: 5,
      loanDurationDays: 14,
      renewalLimit: 2,
      finePerDay: new Prisma.Decimal(1),
      gracePeriodDays: 2,
    };

    it('should renew a book successfully', async () => {
      const currentDueDate = new Date('2024-02-15');

      const mockTransaction = {
        id: 'txn-1',
        memberId: 'member-1',
        bookId: 'book-1',
        dueDate: currentDueDate,
        status: 'issued',
        renewalCount: 0,
        member: { ...mockMember },
        book: { id: 'book-1', title: 'Clean Code' },
      };

      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      prisma.systemSetting.findUnique.mockResolvedValue(mockSettings);
      prisma.reservation.findFirst.mockResolvedValue(null); // No reservations by others

      const updatedTransaction = {
        ...mockTransaction,
        renewalCount: 1,
        dueDate: new Date('2024-02-29'), // extended by 14 days
        member: {
          id: 'member-1',
          fullName: 'John Doe',
          memberType: 'public',
          email: 'john@example.com',
        },
        book: {
          id: 'book-1',
          title: 'Clean Code',
          author: 'Robert C. Martin',
          isbn: '978-0132350884',
        },
        issuedBy: { id: 'librarian-1', fullName: 'Librarian Smith' },
      };

      prisma.transaction.update.mockResolvedValue(updatedTransaction);

      const result = await service.renewBook(
        { transactionId: 'txn-1' },
        'user-1',
      );

      expect(result.renewalsRemaining).toBe(1); // 2 - 1 = 1
      expect(result.previousDueDate).toEqual(currentDueDate);
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'txn-1' },
        data: {
          dueDate: expect.any(Date),
          renewalCount: { increment: 1 },
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException for non-existent transaction', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);

      await expect(
        service.renewBook({ transactionId: 'nonexistent' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when transaction is not in issued status', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-1',
        status: 'returned',
        member: mockMember,
        book: { id: 'book-1', title: 'Clean Code' },
      });

      await expect(
        service.renewBook({ transactionId: 'txn-1' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.renewBook({ transactionId: 'txn-1' }, 'user-1'),
      ).rejects.toThrow(/Only issued transactions can be renewed/);
    });

    it('should throw error when renewal limit reached', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-1',
        status: 'issued',
        renewalCount: 2, // Already at limit
        dueDate: new Date(),
        memberId: 'member-1',
        bookId: 'book-1',
        member: { ...mockMember },
        book: { id: 'book-1', title: 'Clean Code' },
      });
      prisma.systemSetting.findUnique.mockResolvedValue(mockSettings);

      await expect(
        service.renewBook({ transactionId: 'txn-1' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.renewBook({ transactionId: 'txn-1' }, 'user-1'),
      ).rejects.toThrow(/Maximum renewal limit of 2 reached/);
    });

    it('should throw ConflictException when book has reservation by another member', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-1',
        status: 'issued',
        renewalCount: 0,
        dueDate: new Date(),
        memberId: 'member-1',
        bookId: 'book-1',
        member: { ...mockMember },
        book: { id: 'book-1', title: 'Clean Code' },
      });
      prisma.systemSetting.findUnique.mockResolvedValue(mockSettings);
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'res-1',
        bookId: 'book-1',
        memberId: 'other-member', // Different member
        status: 'active',
      });

      await expect(
        service.renewBook({ transactionId: 'txn-1' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.renewBook({ transactionId: 'txn-1' }, 'user-1'),
      ).rejects.toThrow(/reserved by another member/);
    });

    it('should throw BadRequestException when system settings are not configured', async () => {
      prisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-1',
        status: 'issued',
        renewalCount: 0,
        dueDate: new Date(),
        memberId: 'member-1',
        bookId: 'book-1',
        member: { ...mockMember },
        book: { id: 'book-1', title: 'Clean Code' },
      });
      prisma.systemSetting.findUnique.mockResolvedValue(null);

      await expect(
        service.renewBook({ transactionId: 'txn-1' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.renewBook({ transactionId: 'txn-1' }, 'user-1'),
      ).rejects.toThrow(/System settings not configured/);
    });
  });

  // ─── findAll ────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should retrieve paginated transactions', async () => {
      const mockTransactions = [
        {
          id: 'txn-1',
          memberId: 'member-1',
          bookId: 'book-1',
          status: 'issued',
          member: { id: 'member-1', fullName: 'John Doe', memberType: 'public', email: 'john@example.com' },
          book: { id: 'book-1', title: 'Clean Code', author: 'R. Martin', isbn: '978-0132350884' },
          issuedBy: { id: 'librarian-1', fullName: 'Librarian Smith' },
          returnedTo: null,
          fines: [],
        },
      ];

      prisma.transaction.findMany.mockResolvedValue(mockTransactions);
      prisma.transaction.count.mockResolvedValue(1);

      const query = {
        page: 1,
        limit: 20,
        sortOrder: 'desc' as const,
        skip: 0,
      };

      const result = await service.findAll(query as any);

      expect(result.transactions).toEqual(mockTransactions);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should apply status filter', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      const query = {
        page: 1,
        limit: 20,
        sortOrder: 'desc' as const,
        status: 'issued',
        skip: 0,
      };

      await service.findAll(query as any);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'issued',
          }),
        }),
      );
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should retrieve a single transaction by ID', async () => {
      const mockTransaction = {
        id: 'txn-1',
        memberId: 'member-1',
        bookId: 'book-1',
        status: 'issued',
        member: { id: 'member-1', fullName: 'John Doe' },
        book: { id: 'book-1', title: 'Clean Code' },
        issuedBy: { id: 'librarian-1', fullName: 'Librarian Smith' },
        returnedTo: null,
        fines: [],
      };

      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);

      const result = await service.findOne('txn-1');

      expect(result).toEqual(mockTransaction);
      expect(prisma.transaction.findUnique).toHaveBeenCalledWith({
        where: { id: 'txn-1' },
        include: expect.objectContaining({
          member: expect.any(Object),
          book: expect.any(Object),
          issuedBy: expect.any(Object),
          returnedTo: expect.any(Object),
          fines: true,
        }),
      });
    });

    it('should throw NotFoundException for non-existent transaction', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Transaction with ID "nonexistent" not found.',
      );
    });
  });
});
