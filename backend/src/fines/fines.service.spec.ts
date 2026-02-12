import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FinesService } from './fines.service';
import { PrismaService } from '@/prisma/prisma.service';
import { FineQueryDto, FineStatusFilter, FineTypeFilter } from './dto/fine-query.dto';
import { PayFineDto, PaymentMethod } from './dto/pay-fine.dto';
import { LostBookDto } from './dto/lost-book.dto';
import { DamageFineDto } from './dto/damage-fine.dto';

// Mock Prisma.Decimal so the service can construct Decimal instances
jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');

  class MockDecimal {
    private value: number;

    constructor(val: string | number) {
      this.value = typeof val === 'string' ? parseFloat(val) : val;
    }

    plus(other: MockDecimal): MockDecimal {
      return new MockDecimal(this.value + other.value);
    }

    minus(other: MockDecimal): MockDecimal {
      return new MockDecimal(this.value - other.value);
    }

    times(other: MockDecimal): MockDecimal {
      return new MockDecimal(this.value * other.value);
    }

    dividedBy(other: number | MockDecimal): MockDecimal {
      const divisor = other instanceof MockDecimal ? other.value : other;
      return new MockDecimal(this.value / divisor);
    }

    greaterThan(other: MockDecimal | number): boolean {
      const otherVal = other instanceof MockDecimal ? other.value : other;
      return this.value > otherVal;
    }

    greaterThanOrEqualTo(other: MockDecimal): boolean {
      return this.value >= other.value;
    }

    toFixed(dp: number): string {
      return this.value.toFixed(dp);
    }

    toString(): string {
      return this.value.toString();
    }

    toNumber(): number {
      return this.value;
    }
  }

  return {
    ...actual,
    Prisma: {
      ...actual.Prisma,
      Decimal: MockDecimal,
    },
  };
});

// Helper to create a mock Decimal-like value (simulates what Prisma returns from DB)
function mockDecimal(value: number) {
  return {
    toString: () => value.toString(),
    toFixed: (dp: number) => value.toFixed(dp),
    toNumber: () => value,
  };
}

const mockPrismaService = {
  fine: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  member: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  book: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  transaction: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('FinesService', () => {
  let service: FinesService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FinesService>(FinesService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findAll ──────────────────────────────────────────────────────────

  describe('findAll', () => {
    const baseFine = {
      id: 'fine-1',
      memberId: 'member-1',
      transactionId: 'txn-1',
      fineType: 'overdue',
      amount: mockDecimal(10),
      paidAmount: mockDecimal(0),
      status: 'pending',
      description: 'Overdue fine',
      createdAt: new Date('2024-06-01'),
      updatedAt: new Date('2024-06-01'),
      member: {
        id: 'member-1',
        fullName: 'John Doe',
        email: 'john@example.com',
        memberType: 'public',
      },
      transaction: {
        id: 'txn-1',
        bookId: 'book-1',
        issueDate: new Date('2024-05-01'),
        dueDate: new Date('2024-05-15'),
        returnDate: new Date('2024-06-01'),
        book: {
          id: 'book-1',
          title: 'Test Book',
          author: 'Test Author',
          isbn: '1234567890',
        },
      },
    };

    it('should return paginated fines with default query (no filters)', async () => {
      const query = new FineQueryDto();
      query.page = 1;
      query.limit = 20;

      prisma.fine.findMany.mockResolvedValue([baseFine]);
      prisma.fine.count.mockResolvedValue(1);

      const result = await service.findAll(query);

      expect(result).toEqual({ fines: [baseFine], total: 1 });
      expect(prisma.fine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 20,
        }),
      );
      expect(prisma.fine.count).toHaveBeenCalledWith({ where: {} });
    });

    it('should apply status filter', async () => {
      const query = new FineQueryDto();
      query.status = FineStatusFilter.pending;

      prisma.fine.findMany.mockResolvedValue([baseFine]);
      prisma.fine.count.mockResolvedValue(1);

      await service.findAll(query);

      expect(prisma.fine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending' },
        }),
      );
      expect(prisma.fine.count).toHaveBeenCalledWith({
        where: { status: 'pending' },
      });
    });

    it('should apply fineType filter', async () => {
      const query = new FineQueryDto();
      query.fineType = FineTypeFilter.overdue;

      prisma.fine.findMany.mockResolvedValue([]);
      prisma.fine.count.mockResolvedValue(0);

      await service.findAll(query);

      expect(prisma.fine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fineType: 'overdue' },
        }),
      );
    });

    it('should apply memberId filter', async () => {
      const query = new FineQueryDto();
      query.memberId = 'member-1';

      prisma.fine.findMany.mockResolvedValue([baseFine]);
      prisma.fine.count.mockResolvedValue(1);

      await service.findAll(query);

      expect(prisma.fine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { memberId: 'member-1' },
        }),
      );
    });

    it('should apply search filter with OR conditions', async () => {
      const query = new FineQueryDto();
      query.search = 'John';

      prisma.fine.findMany.mockResolvedValue([]);
      prisma.fine.count.mockResolvedValue(0);

      await service.findAll(query);

      expect(prisma.fine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { description: { contains: 'John', mode: 'insensitive' } },
              { member: { fullName: { contains: 'John', mode: 'insensitive' } } },
            ],
          },
        }),
      );
    });

    it('should apply multiple filters simultaneously', async () => {
      const query = new FineQueryDto();
      query.status = FineStatusFilter.pending;
      query.fineType = FineTypeFilter.lost;
      query.memberId = 'member-1';

      prisma.fine.findMany.mockResolvedValue([]);
      prisma.fine.count.mockResolvedValue(0);

      await service.findAll(query);

      expect(prisma.fine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'pending',
            fineType: 'lost',
            memberId: 'member-1',
          },
        }),
      );
    });

    it('should sort by a valid sortBy field', async () => {
      const query = new FineQueryDto();
      query.sortBy = 'amount';
      query.sortOrder = 'asc';

      prisma.fine.findMany.mockResolvedValue([]);
      prisma.fine.count.mockResolvedValue(0);

      await service.findAll(query);

      expect(prisma.fine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { amount: 'asc' },
        }),
      );
    });

    it('should default to createdAt desc for invalid sortBy field', async () => {
      const query = new FineQueryDto();
      query.sortBy = 'invalidField';

      prisma.fine.findMany.mockResolvedValue([]);
      prisma.fine.count.mockResolvedValue(0);

      await service.findAll(query);

      expect(prisma.fine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should paginate with correct skip and take values', async () => {
      const query = new FineQueryDto();
      query.page = 3;
      query.limit = 10;

      prisma.fine.findMany.mockResolvedValue([]);
      prisma.fine.count.mockResolvedValue(25);

      const result = await service.findAll(query);

      expect(result.total).toBe(25);
      expect(prisma.fine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('should return empty fines array when no fines match', async () => {
      const query = new FineQueryDto();

      prisma.fine.findMany.mockResolvedValue([]);
      prisma.fine.count.mockResolvedValue(0);

      const result = await service.findAll(query);

      expect(result).toEqual({ fines: [], total: 0 });
    });
  });

  // ─── findByMember ─────────────────────────────────────────────────────

  describe('findByMember', () => {
    const memberId = 'member-1';

    it('should return fines for a valid member', async () => {
      const mockMember = { id: memberId, fullName: 'John Doe' };
      const mockFines = [
        {
          id: 'fine-1',
          memberId,
          fineType: 'overdue',
          amount: mockDecimal(10),
          status: 'pending',
          createdAt: new Date('2024-06-01'),
          transaction: {
            id: 'txn-1',
            bookId: 'book-1',
            issueDate: new Date('2024-05-01'),
            dueDate: new Date('2024-05-15'),
            returnDate: new Date('2024-06-01'),
            book: {
              id: 'book-1',
              title: 'Test Book',
              author: 'Test Author',
              isbn: '1234567890',
            },
          },
        },
      ];

      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.fine.findMany.mockResolvedValue(mockFines);

      const result = await service.findByMember(memberId);

      expect(result).toEqual(mockFines);
      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { id: memberId },
      });
      expect(prisma.fine.findMany).toHaveBeenCalledWith({
        where: { memberId },
        include: expect.objectContaining({
          transaction: expect.any(Object),
        }),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when member has no fines', async () => {
      prisma.member.findUnique.mockResolvedValue({ id: memberId, fullName: 'John Doe' });
      prisma.fine.findMany.mockResolvedValue([]);

      const result = await service.findByMember(memberId);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(service.findByMember('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findByMember('nonexistent')).rejects.toThrow(
        'Member with ID nonexistent not found',
      );
    });
  });

  // ─── getOutstanding ───────────────────────────────────────────────────

  describe('getOutstanding', () => {
    it('should return all pending fines', async () => {
      const mockFines = [
        {
          id: 'fine-1',
          status: 'pending',
          amount: mockDecimal(15),
          member: { id: 'member-1', fullName: 'John Doe', email: 'john@example.com', phone: '555-1234', memberType: 'public' },
          transaction: {
            id: 'txn-1',
            bookId: 'book-1',
            issueDate: new Date(),
            dueDate: new Date(),
            returnDate: null,
            book: { id: 'book-1', title: 'Book A', author: 'Author A', isbn: '111' },
          },
        },
        {
          id: 'fine-2',
          status: 'pending',
          amount: mockDecimal(20),
          member: { id: 'member-2', fullName: 'Jane Doe', email: 'jane@example.com', phone: '555-5678', memberType: 'student' },
          transaction: {
            id: 'txn-2',
            bookId: 'book-2',
            issueDate: new Date(),
            dueDate: new Date(),
            returnDate: null,
            book: { id: 'book-2', title: 'Book B', author: 'Author B', isbn: '222' },
          },
        },
      ];

      prisma.fine.findMany.mockResolvedValue(mockFines);

      const result = await service.getOutstanding();

      expect(result).toEqual(mockFines);
      expect(prisma.fine.findMany).toHaveBeenCalledWith({
        where: { status: 'pending' },
        include: expect.objectContaining({
          member: expect.any(Object),
          transaction: expect.any(Object),
        }),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no outstanding fines exist', async () => {
      prisma.fine.findMany.mockResolvedValue([]);

      const result = await service.getOutstanding();

      expect(result).toEqual([]);
    });
  });

  // ─── processPayment ───────────────────────────────────────────────────

  describe('processPayment', () => {
    const payDto: PayFineDto = {
      fineId: 'fine-1',
      amount: 10,
      paymentMethod: PaymentMethod.cash,
    };

    const mockFine = {
      id: 'fine-1',
      memberId: 'member-1',
      amount: mockDecimal(20),
      paidAmount: mockDecimal(0),
      status: 'pending',
      fineType: 'overdue',
    };

    it('should process a full payment successfully', async () => {
      const fullPayDto: PayFineDto = {
        fineId: 'fine-1',
        amount: 20,
        paymentMethod: PaymentMethod.card,
      };

      prisma.fine.findUnique.mockResolvedValue(mockFine);

      const updatedFine = {
        ...mockFine,
        paidAmount: mockDecimal(20),
        status: 'paid',
        paymentDate: new Date(),
        paymentMethod: 'card',
        member: { id: 'member-1', fullName: 'John Doe', outstandingFines: mockDecimal(0) },
      };

      const mockTx = {
        fine: { update: jest.fn().mockResolvedValue(updatedFine) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      const result = await service.processPayment(fullPayDto);

      expect(result).toEqual(updatedFine);
      expect(mockTx.fine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'fine-1' },
          data: expect.objectContaining({
            paymentMethod: 'card',
            status: 'paid',
          }),
        }),
      );
      expect(mockTx.member.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'member-1' },
          data: expect.objectContaining({
            outstandingFines: expect.any(Object),
          }),
        }),
      );
    });

    it('should process a partial payment successfully', async () => {
      prisma.fine.findUnique.mockResolvedValue(mockFine);

      const updatedFine = {
        ...mockFine,
        paidAmount: mockDecimal(10),
        status: 'pending',
        paymentDate: new Date(),
        paymentMethod: 'cash',
        member: { id: 'member-1', fullName: 'John Doe', outstandingFines: mockDecimal(10) },
      };

      const mockTx = {
        fine: { update: jest.fn().mockResolvedValue(updatedFine) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      const result = await service.processPayment(payDto);

      expect(result).toEqual(updatedFine);
      expect(result.status).toBe('pending');
      expect(mockTx.fine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending',
          }),
        }),
      );
    });

    it('should handle payment on a partially paid fine', async () => {
      const partiallyPaidFine = {
        ...mockFine,
        paidAmount: mockDecimal(5),
        status: 'pending',
      };

      const secondPayDto: PayFineDto = {
        fineId: 'fine-1',
        amount: 15,
        paymentMethod: PaymentMethod.online,
      };

      prisma.fine.findUnique.mockResolvedValue(partiallyPaidFine);

      const updatedFine = {
        ...partiallyPaidFine,
        paidAmount: mockDecimal(20),
        status: 'paid',
        paymentDate: new Date(),
        paymentMethod: 'online',
        member: { id: 'member-1', fullName: 'John Doe', outstandingFines: mockDecimal(0) },
      };

      const mockTx = {
        fine: { update: jest.fn().mockResolvedValue(updatedFine) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      const result = await service.processPayment(secondPayDto);

      expect(result.status).toBe('paid');
    });

    it('should throw NotFoundException when fine does not exist', async () => {
      prisma.fine.findUnique.mockResolvedValue(null);

      await expect(service.processPayment(payDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.processPayment(payDto)).rejects.toThrow(
        'Fine with ID fine-1 not found',
      );
    });

    it('should throw BadRequestException when fine is already fully paid', async () => {
      prisma.fine.findUnique.mockResolvedValue({
        ...mockFine,
        status: 'paid',
      });

      await expect(service.processPayment(payDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.processPayment(payDto)).rejects.toThrow(
        'This fine has already been fully paid',
      );
    });

    it('should throw BadRequestException when fine has been waived', async () => {
      prisma.fine.findUnique.mockResolvedValue({
        ...mockFine,
        status: 'waived',
      });

      await expect(service.processPayment(payDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.processPayment(payDto)).rejects.toThrow(
        'This fine has been waived and cannot be paid',
      );
    });

    it('should throw BadRequestException when payment exceeds remaining balance', async () => {
      prisma.fine.findUnique.mockResolvedValue(mockFine);

      const overpayDto: PayFineDto = {
        fineId: 'fine-1',
        amount: 25,
        paymentMethod: PaymentMethod.cash,
      };

      await expect(service.processPayment(overpayDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.processPayment(overpayDto)).rejects.toThrow(
        /Payment amount.*exceeds remaining balance/,
      );
    });

    it('should throw BadRequestException when partial overpayment on partially paid fine', async () => {
      prisma.fine.findUnique.mockResolvedValue({
        ...mockFine,
        paidAmount: mockDecimal(15),
      });

      const overpayDto: PayFineDto = {
        fineId: 'fine-1',
        amount: 10,
        paymentMethod: PaymentMethod.cash,
      };

      await expect(service.processPayment(overpayDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should decrement member outstanding fines by the payment amount', async () => {
      prisma.fine.findUnique.mockResolvedValue(mockFine);

      const updatedFine = {
        ...mockFine,
        paidAmount: mockDecimal(10),
        status: 'pending',
        member: { id: 'member-1', fullName: 'John Doe', outstandingFines: mockDecimal(10) },
      };

      const mockTx = {
        fine: { update: jest.fn().mockResolvedValue(updatedFine) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      await service.processPayment(payDto);

      expect(mockTx.member.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: {
          outstandingFines: {
            decrement: expect.anything(),
          },
        },
      });
    });
  });

  // ─── waiveFine ────────────────────────────────────────────────────────

  describe('waiveFine', () => {
    const fineId = 'fine-1';

    const mockFine = {
      id: fineId,
      memberId: 'member-1',
      amount: mockDecimal(20),
      paidAmount: mockDecimal(0),
      status: 'pending',
      fineType: 'overdue',
    };

    it('should waive a pending fine with no prior payments', async () => {
      prisma.fine.findUnique.mockResolvedValue(mockFine);

      const updatedFine = {
        ...mockFine,
        status: 'waived',
        member: { id: 'member-1', fullName: 'John Doe', outstandingFines: mockDecimal(0) },
      };

      const mockTx = {
        fine: { update: jest.fn().mockResolvedValue(updatedFine) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      const result = await service.waiveFine(fineId);

      expect(result).toEqual(updatedFine);
      expect(result.status).toBe('waived');
      expect(mockTx.fine.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: fineId },
          data: { status: 'waived' },
        }),
      );
      expect(mockTx.member.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: {
          outstandingFines: {
            decrement: expect.anything(),
          },
        },
      });
    });

    it('should waive a partially paid fine and only decrement unpaid portion', async () => {
      const partiallyPaidFine = {
        ...mockFine,
        paidAmount: mockDecimal(8),
      };

      prisma.fine.findUnique.mockResolvedValue(partiallyPaidFine);

      const updatedFine = {
        ...partiallyPaidFine,
        status: 'waived',
        member: { id: 'member-1', fullName: 'John Doe', outstandingFines: mockDecimal(0) },
      };

      const mockTx = {
        fine: { update: jest.fn().mockResolvedValue(updatedFine) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      const result = await service.waiveFine(fineId);

      expect(result.status).toBe('waived');
      // Member outstanding fines should be decremented (unpaid portion = 20 - 8 = 12)
      expect(mockTx.member.update).toHaveBeenCalled();
    });

    it('should not decrement member outstanding fines when unpaid amount is zero', async () => {
      // Edge case: fine has been paid in full amount but status is somehow still pending
      // The unpaidAmount would be 0, so member.update should NOT be called
      const fullyPaidButPending = {
        ...mockFine,
        paidAmount: mockDecimal(20),
        status: 'pending',
      };

      prisma.fine.findUnique.mockResolvedValue(fullyPaidButPending);

      const updatedFine = {
        ...fullyPaidButPending,
        status: 'waived',
        member: { id: 'member-1', fullName: 'John Doe', outstandingFines: mockDecimal(0) },
      };

      const mockTx = {
        fine: { update: jest.fn().mockResolvedValue(updatedFine) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      await service.waiveFine(fineId);

      // Since unpaidAmount is 0, member.update should NOT be called
      expect(mockTx.member.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when fine does not exist', async () => {
      prisma.fine.findUnique.mockResolvedValue(null);

      await expect(service.waiveFine('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.waiveFine('nonexistent')).rejects.toThrow(
        'Fine with ID nonexistent not found',
      );
    });

    it('should throw BadRequestException when fine is already paid', async () => {
      prisma.fine.findUnique.mockResolvedValue({
        ...mockFine,
        status: 'paid',
      });

      await expect(service.waiveFine(fineId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.waiveFine(fineId)).rejects.toThrow(
        'Cannot waive an already paid fine',
      );
    });

    it('should throw BadRequestException when fine is already waived', async () => {
      prisma.fine.findUnique.mockResolvedValue({
        ...mockFine,
        status: 'waived',
      });

      await expect(service.waiveFine(fineId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.waiveFine(fineId)).rejects.toThrow(
        'This fine has already been waived',
      );
    });
  });

  // ─── recordLostBook ───────────────────────────────────────────────────

  describe('recordLostBook', () => {
    const lostBookDto: LostBookDto = {
      transactionId: 'txn-1',
      memberId: 'member-1',
      bookId: 'book-1',
    };

    const mockMember = { id: 'member-1', fullName: 'John Doe' };
    const mockBook = {
      id: 'book-1',
      title: 'Test Book',
      author: 'Test Author',
      price: mockDecimal(30),
      availableCopies: 5,
      totalCopies: 10,
    };
    const mockTransaction = {
      id: 'txn-1',
      memberId: 'member-1',
      bookId: 'book-1',
      issueDate: new Date('2024-05-01'),
      dueDate: new Date('2024-05-15'),
    };

    it('should record a lost book fine successfully (book price + $5 fee)', async () => {
      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);

      const createdFine = {
        id: 'fine-new',
        memberId: 'member-1',
        transactionId: 'txn-1',
        fineType: 'lost',
        amount: mockDecimal(35), // 30 + 5
        paidAmount: mockDecimal(0),
        status: 'pending',
        description: expect.any(String),
        member: { id: 'member-1', fullName: 'John Doe' },
        transaction: {
          id: 'txn-1',
          book: { id: 'book-1', title: 'Test Book', author: 'Test Author' },
        },
      };

      const mockTx = {
        fine: { create: jest.fn().mockResolvedValue(createdFine) },
        book: { update: jest.fn().mockResolvedValue({}) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      const result = await service.recordLostBook(lostBookDto);

      expect(result).toEqual(createdFine);
      expect(mockTx.fine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transactionId: 'txn-1',
            memberId: 'member-1',
            fineType: 'lost',
          }),
        }),
      );
      // Book copies should be decremented
      expect(mockTx.book.update).toHaveBeenCalledWith({
        where: { id: 'book-1' },
        data: {
          availableCopies: { decrement: 1 },
          totalCopies: { decrement: 1 },
        },
      });
      // Member outstanding fines should be incremented
      expect(mockTx.member.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: {
          outstandingFines: { increment: expect.anything() },
        },
      });
    });

    it('should use custom description when provided', async () => {
      const dtoWithDescription: LostBookDto = {
        ...lostBookDto,
        description: 'Member lost the book during travel',
      };

      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);

      const mockTx = {
        fine: { create: jest.fn().mockResolvedValue({ id: 'fine-new' }) },
        book: { update: jest.fn().mockResolvedValue({}) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      await service.recordLostBook(dtoWithDescription);

      expect(mockTx.fine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'Member lost the book during travel',
          }),
        }),
      );
    });

    it('should default to $25 book price when book has no price set', async () => {
      const bookNoPrice = { ...mockBook, price: null };

      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.book.findUnique.mockResolvedValue(bookNoPrice);
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);

      const mockTx = {
        fine: { create: jest.fn().mockResolvedValue({ id: 'fine-new', amount: mockDecimal(30) }) },
        book: { update: jest.fn().mockResolvedValue({}) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      await service.recordLostBook(lostBookDto);

      // Fine amount should be 25 (default) + 5 (processing fee) = 30
      expect(mockTx.fine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fineType: 'lost',
          }),
        }),
      );
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(null);
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);

      await expect(service.recordLostBook(lostBookDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.recordLostBook(lostBookDto)).rejects.toThrow(
        'Member with ID member-1 not found',
      );
    });

    it('should throw NotFoundException when book does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.book.findUnique.mockResolvedValue(null);
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);

      await expect(service.recordLostBook(lostBookDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.recordLostBook(lostBookDto)).rejects.toThrow(
        'Book with ID book-1 not found',
      );
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.transaction.findUnique.mockResolvedValue(null);

      await expect(service.recordLostBook(lostBookDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.recordLostBook(lostBookDto)).rejects.toThrow(
        'Transaction with ID txn-1 not found',
      );
    });

    it('should throw BadRequestException when transaction does not belong to member', async () => {
      const wrongMemberTxn = {
        ...mockTransaction,
        memberId: 'member-other',
      };

      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.transaction.findUnique.mockResolvedValue(wrongMemberTxn);

      await expect(service.recordLostBook(lostBookDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.recordLostBook(lostBookDto)).rejects.toThrow(
        'Transaction does not belong to the specified member',
      );
    });

    it('should throw BadRequestException when transaction does not correspond to the book', async () => {
      const wrongBookTxn = {
        ...mockTransaction,
        bookId: 'book-other',
      };

      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.transaction.findUnique.mockResolvedValue(wrongBookTxn);

      await expect(service.recordLostBook(lostBookDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.recordLostBook(lostBookDto)).rejects.toThrow(
        'Transaction does not correspond to the specified book',
      );
    });
  });

  // ─── recordDamage ─────────────────────────────────────────────────────

  describe('recordDamage', () => {
    const damageDto: DamageFineDto = {
      memberId: 'member-1',
      bookId: 'book-1',
      damagePercent: 50,
    };

    const mockMember = { id: 'member-1', fullName: 'John Doe' };
    const mockBook = {
      id: 'book-1',
      title: 'Test Book',
      author: 'Test Author',
      price: mockDecimal(40),
    };

    it('should record moderate damage fine (50%) successfully', async () => {
      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.book.findUnique.mockResolvedValue(mockBook);

      const createdFine = {
        id: 'fine-new',
        memberId: 'member-1',
        transactionId: null,
        fineType: 'damage',
        amount: mockDecimal(20), // 50% of 40
        paidAmount: mockDecimal(0),
        status: 'pending',
        member: { id: 'member-1', fullName: 'John Doe' },
        transaction: null,
      };

      const mockTx = {
        fine: { create: jest.fn().mockResolvedValue(createdFine) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      const result = await service.recordDamage(damageDto);

      expect(result).toEqual(createdFine);
      expect(mockTx.fine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            memberId: 'member-1',
            fineType: 'damage',
            transactionId: null,
          }),
        }),
      );
      expect(mockTx.member.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: {
          outstandingFines: { increment: expect.anything() },
        },
      });
    });

    it('should record minor damage fine (25%)', async () => {
      const minorDamageDto: DamageFineDto = {
        memberId: 'member-1',
        bookId: 'book-1',
        damagePercent: 25,
      };

      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.book.findUnique.mockResolvedValue(mockBook);

      const createdFine = {
        id: 'fine-new',
        fineType: 'damage',
        amount: mockDecimal(10), // 25% of 40
      };

      const mockTx = {
        fine: { create: jest.fn().mockResolvedValue(createdFine) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      const result = await service.recordDamage(minorDamageDto);

      expect(result).toEqual(createdFine);
    });

    it('should record severe damage fine (100%)', async () => {
      const severeDamageDto: DamageFineDto = {
        memberId: 'member-1',
        bookId: 'book-1',
        damagePercent: 100,
      };

      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.book.findUnique.mockResolvedValue(mockBook);

      const createdFine = {
        id: 'fine-new',
        fineType: 'damage',
        amount: mockDecimal(40), // 100% of 40
      };

      const mockTx = {
        fine: { create: jest.fn().mockResolvedValue(createdFine) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      const result = await service.recordDamage(severeDamageDto);

      expect(result).toEqual(createdFine);
    });

    it('should use custom description when provided', async () => {
      const dtoWithDesc: DamageFineDto = {
        ...damageDto,
        description: 'Water damage on pages 50-100',
      };

      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.book.findUnique.mockResolvedValue(mockBook);

      const mockTx = {
        fine: { create: jest.fn().mockResolvedValue({ id: 'fine-new' }) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      await service.recordDamage(dtoWithDesc);

      expect(mockTx.fine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'Water damage on pages 50-100',
          }),
        }),
      );
    });

    it('should default to $25 book price when book has no price set', async () => {
      const bookNoPrice = { ...mockBook, price: null };

      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.book.findUnique.mockResolvedValue(bookNoPrice);

      const mockTx = {
        fine: { create: jest.fn().mockResolvedValue({ id: 'fine-new' }) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      await service.recordDamage(damageDto);

      // Fine amount should be 50% of $25 = $12.50
      expect(mockTx.fine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fineType: 'damage',
            memberId: 'member-1',
          }),
        }),
      );
    });

    it('should include transactionId when provided', async () => {
      const dtoWithTxn: DamageFineDto = {
        ...damageDto,
        transactionId: 'txn-1',
      };

      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.transaction.findUnique.mockResolvedValue({
        id: 'txn-1',
        memberId: 'member-1',
        bookId: 'book-1',
      });

      const mockTx = {
        fine: { create: jest.fn().mockResolvedValue({ id: 'fine-new' }) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      await service.recordDamage(dtoWithTxn);

      expect(mockTx.fine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transactionId: 'txn-1',
          }),
        }),
      );
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(null);
      prisma.book.findUnique.mockResolvedValue(mockBook);

      await expect(service.recordDamage(damageDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.recordDamage(damageDto)).rejects.toThrow(
        'Member with ID member-1 not found',
      );
    });

    it('should throw NotFoundException when book does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.book.findUnique.mockResolvedValue(null);

      await expect(service.recordDamage(damageDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.recordDamage(damageDto)).rejects.toThrow(
        'Book with ID book-1 not found',
      );
    });

    it('should throw NotFoundException when provided transactionId does not exist', async () => {
      const dtoWithBadTxn: DamageFineDto = {
        ...damageDto,
        transactionId: 'txn-nonexistent',
      };

      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.transaction.findUnique.mockResolvedValue(null);

      await expect(service.recordDamage(dtoWithBadTxn)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.recordDamage(dtoWithBadTxn)).rejects.toThrow(
        'Transaction with ID txn-nonexistent not found',
      );
    });

    it('should not validate transactionId when not provided', async () => {
      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.book.findUnique.mockResolvedValue(mockBook);

      const mockTx = {
        fine: { create: jest.fn().mockResolvedValue({ id: 'fine-new' }) },
        member: { update: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => fn(mockTx));

      await service.recordDamage(damageDto);

      // transaction.findUnique should NOT have been called since transactionId is not provided
      expect(prisma.transaction.findUnique).not.toHaveBeenCalled();
    });
  });
});
