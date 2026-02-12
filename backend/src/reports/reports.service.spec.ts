import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '@/prisma/prisma.service';

const mockPrismaService = {
  book: {
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  member: {
    count: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  transaction: {
    count: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  fine: {
    aggregate: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
};

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── getDashboardStats ─────────────────────────────────────────────

  describe('getDashboardStats', () => {
    it('should return comprehensive dashboard statistics', async () => {
      // Mock the 11 parallel queries in Promise.all
      prisma.book.count.mockResolvedValue(150); // totalBooks
      prisma.book.aggregate
        .mockResolvedValueOnce({ _sum: { availableCopies: 300 } }) // availableBooksResult
        .mockResolvedValueOnce({ _sum: { totalCopies: 500 } }); // totalBooksSum (called after Promise.all)
      prisma.member.count
        .mockResolvedValueOnce(200) // totalMembers
        .mockResolvedValueOnce(180) // activeMembers
        .mockResolvedValueOnce(15); // newMembersThisMonth
      prisma.transaction.count
        .mockResolvedValueOnce(12) // overdueBooks
        .mockResolvedValueOnce(8) // todayIssues
        .mockResolvedValueOnce(5); // todayReturns
      prisma.fine.aggregate.mockResolvedValue({
        _sum: { amount: 125.5 },
      }); // totalFinesOutstandingResult
      prisma.book.groupBy.mockResolvedValue([
        { category: 'Fiction', _count: { _all: 50 } },
        { category: 'Science', _count: { _all: 30 } },
      ]); // popularCategories
      prisma.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          status: 'issued',
          member: { id: 'm-1', fullName: 'John Doe', memberType: 'student' },
          book: { id: 'b-1', title: 'Test Book', author: 'Author', isbn: '123' },
          issuedBy: { id: 'u-1', fullName: 'Librarian' },
        },
      ]); // recentActivities

      const result = await service.getDashboardStats();

      expect(result).toEqual(
        expect.objectContaining({
          totalBooks: 150,
          totalCopies: 500,
          availableBooks: 300,
          issuedBooks: 200,
          totalMembers: 200,
          activeMembers: 180,
          overdueBooks: 12,
          totalFinesOutstanding: 125.5,
          todayIssues: 8,
          todayReturns: 5,
          newMembersThisMonth: 15,
        }),
      );

      expect(result.popularCategories).toEqual([
        { category: 'Fiction', count: 50 },
        { category: 'Science', count: 30 },
      ]);

      expect(result.recentActivities).toHaveLength(1);
    });

    it('should handle zero/null aggregation values gracefully', async () => {
      prisma.book.count.mockResolvedValue(0);
      prisma.book.aggregate
        .mockResolvedValueOnce({ _sum: { availableCopies: null } })
        .mockResolvedValueOnce({ _sum: { totalCopies: null } });
      prisma.member.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prisma.transaction.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prisma.fine.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });
      prisma.book.groupBy.mockResolvedValue([]);
      prisma.transaction.findMany.mockResolvedValue([]);

      const result = await service.getDashboardStats();

      expect(result.totalBooks).toBe(0);
      expect(result.totalCopies).toBe(0);
      expect(result.availableBooks).toBe(0);
      expect(result.issuedBooks).toBe(0);
      expect(result.totalFinesOutstanding).toBe(0);
      expect(result.popularCategories).toEqual([]);
      expect(result.recentActivities).toEqual([]);
    });
  });

  // ─── getPopularBooks ───────────────────────────────────────────────

  describe('getPopularBooks', () => {
    it('should return popular books ranked by borrow count', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { bookId: 'book-1', _count: { bookId: 25 } },
        { bookId: 'book-2', _count: { bookId: 15 } },
      ]);

      prisma.book.findMany.mockResolvedValue([
        {
          id: 'book-1',
          title: 'Popular Book 1',
          author: 'Author 1',
          isbn: '111',
          category: 'Fiction',
          totalCopies: 10,
          availableCopies: 3,
          _count: { transactions: 25 },
        },
        {
          id: 'book-2',
          title: 'Popular Book 2',
          author: 'Author 2',
          isbn: '222',
          category: 'Science',
          totalCopies: 5,
          availableCopies: 1,
          _count: { transactions: 15 },
        },
      ]);

      const result = await service.getPopularBooks(10);

      expect(result.books).toHaveLength(2);
      expect(result.books[0].borrowCount).toBe(25);
      expect(result.books[1].borrowCount).toBe(15);
      // Verify sorted by borrowCount descending
      expect(result.books[0].borrowCount).toBeGreaterThan(
        result.books[1].borrowCount,
      );
    });

    it('should return empty books array when no transactions exist', async () => {
      prisma.transaction.groupBy.mockResolvedValue([]);

      const result = await service.getPopularBooks();

      expect(result).toEqual({ books: [] });
      expect(prisma.book.findMany).not.toHaveBeenCalled();
    });

    it('should use default limit of 10', async () => {
      prisma.transaction.groupBy.mockResolvedValue([]);

      await service.getPopularBooks();

      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });

    it('should respect custom limit parameter', async () => {
      prisma.transaction.groupBy.mockResolvedValue([]);

      await service.getPopularBooks(5);

      expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        }),
      );
    });

    it('should handle books that were deleted after being borrowed', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { bookId: 'book-1', _count: { bookId: 25 } },
        { bookId: 'book-deleted', _count: { bookId: 20 } },
      ]);

      // Only book-1 is returned (book-deleted is filtered out by isDeleted: false)
      prisma.book.findMany.mockResolvedValue([
        {
          id: 'book-1',
          title: 'Existing Book',
          author: 'Author',
          isbn: '111',
          category: 'Fiction',
          totalCopies: 10,
          availableCopies: 5,
          _count: { transactions: 25 },
        },
      ]);

      const result = await service.getPopularBooks();

      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe('book-1');
    });
  });

  // ─── getOverdueReport ──────────────────────────────────────────────

  describe('getOverdueReport', () => {
    it('should return overdue transactions with daysOverdue', async () => {
      const now = new Date();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      prisma.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          status: 'issued',
          issueDate: new Date('2024-12-01'),
          dueDate: fiveDaysAgo,
          returnDate: null,
          member: {
            id: 'm-1',
            fullName: 'John Doe',
            email: 'john@test.com',
            phone: '123-456-7890',
            memberType: 'student',
          },
          book: {
            id: 'b-1',
            title: 'Overdue Book 1',
            author: 'Author 1',
            isbn: '111',
          },
          issuedBy: {
            id: 'u-1',
            fullName: 'Librarian',
          },
        },
        {
          id: 'tx-2',
          status: 'issued',
          issueDate: new Date('2024-11-20'),
          dueDate: tenDaysAgo,
          returnDate: null,
          member: {
            id: 'm-2',
            fullName: 'Jane Smith',
            email: 'jane@test.com',
            phone: '987-654-3210',
            memberType: 'faculty',
          },
          book: {
            id: 'b-2',
            title: 'Overdue Book 2',
            author: 'Author 2',
            isbn: '222',
          },
          issuedBy: {
            id: 'u-1',
            fullName: 'Librarian',
          },
        },
      ]);

      const result = await service.getOverdueReport();

      expect(result.overdueCount).toBe(2);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].daysOverdue).toBeGreaterThanOrEqual(4);
      expect(result.transactions[0].daysOverdue).toBeLessThanOrEqual(6);
      expect(result.transactions[1].daysOverdue).toBeGreaterThanOrEqual(9);
      expect(result.transactions[1].daysOverdue).toBeLessThanOrEqual(11);
    });

    it('should return empty result when no overdue transactions exist', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);

      const result = await service.getOverdueReport();

      expect(result).toEqual({
        overdueCount: 0,
        transactions: [],
      });
    });

    it('should query only issued transactions past due date', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);

      await service.getOverdueReport();

      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: {
          status: 'issued',
          dueDate: { lt: expect.any(Date) },
        },
        orderBy: { dueDate: 'asc' },
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              memberType: true,
            },
          },
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              isbn: true,
            },
          },
          issuedBy: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });
    });

    it('should calculate daysOverdue correctly', async () => {
      const now = new Date();
      const exactlyThreeDaysAgo = new Date(
        now.getTime() - 3 * 24 * 60 * 60 * 1000,
      );

      prisma.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          status: 'issued',
          issueDate: new Date('2024-12-01'),
          dueDate: exactlyThreeDaysAgo,
          returnDate: null,
          member: {
            id: 'm-1',
            fullName: 'Test Member',
            email: 'test@test.com',
            phone: '000',
            memberType: 'public',
          },
          book: {
            id: 'b-1',
            title: 'Test Book',
            author: 'Author',
            isbn: '000',
          },
          issuedBy: {
            id: 'u-1',
            fullName: 'Admin',
          },
        },
      ]);

      const result = await service.getOverdueReport();

      expect(result.transactions[0].daysOverdue).toBe(3);
    });
  });

  // ─── getMemberStats ────────────────────────────────────────────────

  describe('getMemberStats', () => {
    it('should return member statistics', async () => {
      prisma.member.groupBy
        .mockResolvedValueOnce([
          { memberType: 'student', _count: { _all: 100 } },
          { memberType: 'faculty', _count: { _all: 50 } },
          { memberType: 'public', _count: { _all: 30 } },
        ]) // byType
        .mockResolvedValueOnce([
          { status: 'active', _count: { _all: 160 } },
          { status: 'inactive', _count: { _all: 20 } },
        ]); // byStatus

      prisma.member.count
        .mockResolvedValueOnce(180) // totalMembers
        .mockResolvedValueOnce(12); // membersWithFines

      prisma.member.findMany.mockResolvedValue([
        {
          id: 'm-1',
          fullName: 'Top Borrower',
          email: 'top@test.com',
          memberType: 'student',
          booksIssuedCount: 50,
          status: 'active',
          _count: { transactions: 75 },
        },
        {
          id: 'm-2',
          fullName: 'Second Borrower',
          email: 'second@test.com',
          memberType: 'faculty',
          booksIssuedCount: 35,
          status: 'active',
          _count: { transactions: 40 },
        },
      ]); // topBorrowers

      const result = await service.getMemberStats();

      expect(result.totalMembers).toBe(180);
      expect(result.membersWithFines).toBe(12);

      expect(result.byType).toEqual([
        { memberType: 'student', count: 100 },
        { memberType: 'faculty', count: 50 },
        { memberType: 'public', count: 30 },
      ]);

      expect(result.byStatus).toEqual([
        { status: 'active', count: 160 },
        { status: 'inactive', count: 20 },
      ]);

      expect(result.topBorrowers).toHaveLength(2);
      expect(result.topBorrowers[0]).toEqual({
        id: 'm-1',
        fullName: 'Top Borrower',
        email: 'top@test.com',
        memberType: 'student',
        booksIssuedCount: 50,
        totalTransactions: 75,
        status: 'active',
      });
    });

    it('should handle empty member data', async () => {
      prisma.member.groupBy
        .mockResolvedValueOnce([]) // byType
        .mockResolvedValueOnce([]); // byStatus
      prisma.member.count
        .mockResolvedValueOnce(0) // totalMembers
        .mockResolvedValueOnce(0); // membersWithFines
      prisma.member.findMany.mockResolvedValue([]); // topBorrowers

      const result = await service.getMemberStats();

      expect(result.totalMembers).toBe(0);
      expect(result.membersWithFines).toBe(0);
      expect(result.byType).toEqual([]);
      expect(result.byStatus).toEqual([]);
      expect(result.topBorrowers).toEqual([]);
    });
  });

  // ─── exportToCsv ───────────────────────────────────────────────────

  describe('exportToCsv', () => {
    it('should export popular-books report to CSV', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { bookId: 'book-1', _count: { bookId: 10 } },
      ]);

      prisma.book.findMany.mockResolvedValue([
        {
          id: 'book-1',
          title: 'Test Book',
          author: 'Test Author',
          isbn: '978-0-123456-78-9',
          category: 'Fiction',
          totalCopies: 5,
          availableCopies: 2,
          _count: { transactions: 10 },
        },
      ]);

      const csv = await service.exportToCsv('popular-books', { limit: 10 });

      expect(csv).toContain(
        'Title,Author,ISBN,Category,Total Copies,Available Copies,Borrow Count',
      );
      expect(csv).toContain('Test Book');
      expect(csv).toContain('Test Author');
      expect(csv).toContain('978-0-123456-78-9');
    });

    it('should export overdue report to CSV', async () => {
      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      prisma.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          status: 'issued',
          issueDate: new Date('2024-12-01'),
          dueDate: twoDaysAgo,
          returnDate: null,
          member: {
            id: 'm-1',
            fullName: 'John Doe',
            email: 'john@test.com',
            phone: '555-0100',
            memberType: 'student',
          },
          book: {
            id: 'b-1',
            title: 'Overdue Book',
            author: 'Some Author',
            isbn: '111-222',
          },
          issuedBy: {
            id: 'u-1',
            fullName: 'Librarian',
          },
        },
      ]);

      const csv = await service.exportToCsv('overdue');

      expect(csv).toContain(
        'Transaction ID,Member Name,Member Email,Member Phone,Book Title,Book Author,ISBN,Issue Date,Due Date,Days Overdue',
      );
      expect(csv).toContain('tx-1');
      expect(csv).toContain('John Doe');
      expect(csv).toContain('Overdue Book');
    });

    it('should export member-stats report to CSV', async () => {
      prisma.member.findMany.mockResolvedValue([
        {
          id: 'm-1',
          fullName: 'John Doe',
          email: 'john@test.com',
          memberType: 'student',
          status: 'active',
          booksIssuedCount: 3,
          outstandingFines: 5.5,
          registrationDate: new Date('2024-01-15'),
          expiryDate: new Date('2025-01-15'),
        },
      ]);

      const csv = await service.exportToCsv('member-stats');

      expect(csv).toContain(
        'Member ID,Full Name,Email,Member Type,Status,Books Issued,Outstanding Fines,Registration Date,Expiry Date',
      );
      expect(csv).toContain('m-1');
      expect(csv).toContain('John Doe');
      expect(csv).toContain('student');
    });

    it('should return error message for unknown report type', async () => {
      const result = await service.exportToCsv('unknown-type');

      expect(result).toBe('Error: Unknown report type');
    });

    it('should export inventory report to CSV', async () => {
      prisma.book.findMany.mockResolvedValue([
        {
          title: 'Inventory Book',
          author: 'Author',
          isbn: '999',
          category: 'Science',
          language: 'English',
          condition: 'good',
          totalCopies: 10,
          availableCopies: 7,
          shelfLocation: 'A-1',
          callNumber: 'SC-001',
        },
      ]);

      const csv = await service.exportToCsv('inventory');

      expect(csv).toContain(
        'Title,Author,ISBN,Category,Language,Condition,Total Copies,Available Copies,Shelf Location,Call Number',
      );
      expect(csv).toContain('Inventory Book');
      expect(csv).toContain('SC-001');
    });

    it('should handle CSV fields that contain commas by quoting them', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { bookId: 'book-1', _count: { bookId: 5 } },
      ]);

      prisma.book.findMany.mockResolvedValue([
        {
          id: 'book-1',
          title: 'Book, With Comma',
          author: 'Last, First',
          isbn: '123',
          category: 'Fiction',
          totalCopies: 3,
          availableCopies: 1,
          _count: { transactions: 5 },
        },
      ]);

      const csv = await service.exportToCsv('popular-books');

      expect(csv).toContain('"Book, With Comma"');
      expect(csv).toContain('"Last, First"');
    });

    it('should export transactions report to CSV with date params', async () => {
      prisma.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          issueDate: new Date('2024-12-01'),
          dueDate: new Date('2024-12-15'),
          returnDate: new Date('2024-12-14'),
          status: 'returned',
          fineAmount: 0,
          renewalCount: 1,
          member: {
            id: 'm-1',
            fullName: 'Member Name',
            memberType: 'student',
          },
          book: {
            id: 'b-1',
            title: 'A Book',
            author: 'Author',
            isbn: '123',
          },
          issuedBy: { id: 'u-1', fullName: 'Admin' },
          returnedTo: { id: 'u-2', fullName: 'Librarian' },
        },
      ]);
      prisma.transaction.count.mockResolvedValue(1);
      prisma.transaction.groupBy.mockResolvedValue([
        { status: 'returned', _count: { _all: 1 } },
      ]);

      const csv = await service.exportToCsv('transactions', {
        fromDate: '2024-12-01',
        toDate: '2024-12-31',
      });

      expect(csv).toContain(
        'Transaction ID,Member Name,Member Type,Book Title,Author,ISBN,Issue Date,Due Date,Return Date,Status,Fine Amount,Renewal Count',
      );
      expect(csv).toContain('tx-1');
      expect(csv).toContain('returned');
    });

    it('should export financial report to CSV', async () => {
      prisma.fine.findMany.mockResolvedValue([
        {
          id: 'fine-1',
          fineType: 'overdue',
          amount: 10.0,
          paidAmount: 10.0,
          status: 'paid',
          createdAt: new Date('2024-12-10'),
          member: {
            id: 'm-1',
            fullName: 'John Doe',
            memberType: 'student',
          },
          transaction: {
            id: 'tx-1',
            issueDate: new Date('2024-12-01'),
            dueDate: new Date('2024-12-08'),
            book: {
              id: 'b-1',
              title: 'Fined Book',
              author: 'Author',
            },
          },
        },
      ]);
      prisma.fine.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 10.0 } }) // totalFinesAgg
        .mockResolvedValueOnce({ _sum: { amount: 10.0, paidAmount: 10.0 } }) // paidFinesAgg
        .mockResolvedValueOnce({ _sum: { amount: 0 } }) // waivedFinesAgg
        .mockResolvedValueOnce({ _sum: { amount: 0 } }); // pendingFinesAgg
      prisma.fine.groupBy
        .mockResolvedValueOnce([
          {
            fineType: 'overdue',
            _count: { _all: 1 },
            _sum: { amount: 10.0, paidAmount: 10.0 },
          },
        ]) // byType
        .mockResolvedValueOnce([
          { status: 'paid', _count: { _all: 1 }, _sum: { amount: 10.0 } },
        ]); // byStatus

      const csv = await service.exportToCsv('financial', {
        fromDate: '2024-12-01',
        toDate: '2024-12-31',
      });

      expect(csv).toContain(
        'Fine ID,Member Name,Member Type,Fine Type,Amount,Paid Amount,Status,Book Title,Issue Date,Due Date,Created At',
      );
      expect(csv).toContain('fine-1');
      expect(csv).toContain('Fined Book');
    });
  });
});
