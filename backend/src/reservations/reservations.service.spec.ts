import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';

const mockPrismaService = {
  reservation: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
  book: {
    findUnique: jest.fn(),
  },
  member: {
    findUnique: jest.fn(),
  },
};

describe('ReservationsService', () => {
  let service: ReservationsService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── create ─────────────────────────────────────────────────────────

  describe('create', () => {
    const dto: CreateReservationDto = {
      bookId: 'book-1',
    };
    const memberId = 'member-1';

    const mockBook = {
      id: 'book-1',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: '978-0132350884',
      availableCopies: 0,
      totalCopies: 3,
      isDeleted: false,
    };

    const mockMember = {
      id: 'member-1',
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      status: 'active',
    };

    const mockCreatedReservation = {
      id: 'reservation-1',
      bookId: 'book-1',
      memberId: 'member-1',
      status: 'active',
      reservationDate: new Date('2026-01-15'),
      expiryDate: new Date('2026-02-14'),
      book: {
        id: 'book-1',
        title: 'Clean Code',
        author: 'Robert C. Martin',
        isbn: '978-0132350884',
      },
      member: {
        id: 'member-1',
        fullName: 'Jane Doe',
        email: 'jane@example.com',
      },
    };

    it('should create a reservation successfully', async () => {
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.reservation.findFirst.mockResolvedValue(null);
      prisma.reservation.count.mockResolvedValue(0);
      prisma.reservation.create.mockResolvedValue(mockCreatedReservation);

      const result = await service.create(dto, memberId);

      expect(result).toEqual(mockCreatedReservation);

      expect(prisma.book.findUnique).toHaveBeenCalledWith({
        where: { id: 'book-1' },
      });
      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { id: 'member-1' },
      });
      expect(prisma.reservation.findFirst).toHaveBeenCalledWith({
        where: {
          bookId: 'book-1',
          memberId: 'member-1',
          status: 'active',
        },
      });
      expect(prisma.reservation.count).toHaveBeenCalledWith({
        where: {
          memberId: 'member-1',
          status: 'active',
        },
      });
      expect(prisma.reservation.create).toHaveBeenCalledWith({
        data: {
          bookId: 'book-1',
          memberId: 'member-1',
          expiryDate: expect.any(Date),
        },
        include: {
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              isbn: true,
            },
          },
          member: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });
    });

    it('should set expiry date to 30 days from now', async () => {
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.reservation.findFirst.mockResolvedValue(null);
      prisma.reservation.count.mockResolvedValue(0);
      prisma.reservation.create.mockResolvedValue(mockCreatedReservation);

      const before = new Date();
      await service.create(dto, memberId);
      const after = new Date();

      const createCall = prisma.reservation.create.mock.calls[0][0];
      const expiryDate = createCall.data.expiryDate as Date;

      // Expiry should be approximately 30 days from now
      const expectedMin = new Date(before.getTime() + 30 * 24 * 60 * 60 * 1000 - 5000);
      const expectedMax = new Date(after.getTime() + 30 * 24 * 60 * 60 * 1000 + 5000);
      expect(expiryDate.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(expiryDate.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });

    it('should throw NotFoundException when book does not exist', async () => {
      prisma.book.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, memberId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(dto, memberId)).rejects.toThrow(
        `Book with ID ${dto.bookId} not found`,
      );

      expect(prisma.member.findUnique).not.toHaveBeenCalled();
      expect(prisma.reservation.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when book is deleted', async () => {
      prisma.book.findUnique.mockResolvedValue({
        ...mockBook,
        isDeleted: true,
      });

      await expect(service.create(dto, memberId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(dto, memberId)).rejects.toThrow(
        'This book has been removed from the library',
      );

      expect(prisma.member.findUnique).not.toHaveBeenCalled();
      expect(prisma.reservation.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when book has available copies', async () => {
      prisma.book.findUnique.mockResolvedValue({
        ...mockBook,
        availableCopies: 2,
      });

      await expect(service.create(dto, memberId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(dto, memberId)).rejects.toThrow(
        'This book is currently available. You can borrow it directly instead of reserving.',
      );

      expect(prisma.member.findUnique).not.toHaveBeenCalled();
      expect(prisma.reservation.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, memberId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(dto, memberId)).rejects.toThrow(
        `Member with ID ${memberId} not found`,
      );

      expect(prisma.reservation.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when member is not active', async () => {
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.member.findUnique.mockResolvedValue({
        ...mockMember,
        status: 'suspended',
      });

      await expect(service.create(dto, memberId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(dto, memberId)).rejects.toThrow(
        'Your membership is not active. Please contact the library to renew your membership.',
      );

      expect(prisma.reservation.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when member already has active reservation for this book', async () => {
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.reservation.findFirst.mockResolvedValue({
        id: 'existing-reservation',
        bookId: 'book-1',
        memberId: 'member-1',
        status: 'active',
      });

      await expect(service.create(dto, memberId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(dto, memberId)).rejects.toThrow(
        'You already have an active reservation for this book',
      );

      expect(prisma.reservation.count).not.toHaveBeenCalled();
      expect(prisma.reservation.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when member has 3 or more active reservations', async () => {
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.reservation.findFirst.mockResolvedValue(null);
      prisma.reservation.count.mockResolvedValue(3);

      await expect(service.create(dto, memberId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(dto, memberId)).rejects.toThrow(
        'You cannot have more than 3 active reservations at a time',
      );

      expect(prisma.reservation.create).not.toHaveBeenCalled();
    });

    it('should allow reservation when member has exactly 2 active reservations', async () => {
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.reservation.findFirst.mockResolvedValue(null);
      prisma.reservation.count.mockResolvedValue(2);
      prisma.reservation.create.mockResolvedValue(mockCreatedReservation);

      const result = await service.create(dto, memberId);

      expect(result).toEqual(mockCreatedReservation);
      expect(prisma.reservation.create).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when member has more than 3 active reservations', async () => {
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.reservation.findFirst.mockResolvedValue(null);
      prisma.reservation.count.mockResolvedValue(5);

      await expect(service.create(dto, memberId)).rejects.toThrow(
        BadRequestException,
      );

      expect(prisma.reservation.create).not.toHaveBeenCalled();
    });

    it('should allow reservation when book has exactly 0 available copies', async () => {
      prisma.book.findUnique.mockResolvedValue({
        ...mockBook,
        availableCopies: 0,
      });
      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.reservation.findFirst.mockResolvedValue(null);
      prisma.reservation.count.mockResolvedValue(0);
      prisma.reservation.create.mockResolvedValue(mockCreatedReservation);

      const result = await service.create(dto, memberId);

      expect(result).toEqual(mockCreatedReservation);
    });
  });

  // ─── cancel ─────────────────────────────────────────────────────────

  describe('cancel', () => {
    const reservationId = 'reservation-1';

    const mockActiveReservation = {
      id: 'reservation-1',
      bookId: 'book-1',
      memberId: 'member-1',
      status: 'active',
      reservationDate: new Date('2026-01-15'),
      expiryDate: new Date('2026-02-14'),
    };

    const mockUpdatedReservation = {
      ...mockActiveReservation,
      status: 'cancelled',
      book: {
        id: 'book-1',
        title: 'Clean Code',
        author: 'Robert C. Martin',
      },
      member: {
        id: 'member-1',
        fullName: 'Jane Doe',
      },
    };

    it('should cancel an active reservation successfully', async () => {
      prisma.reservation.findUnique.mockResolvedValue(mockActiveReservation);
      prisma.reservation.update.mockResolvedValue(mockUpdatedReservation);

      const result = await service.cancel(reservationId);

      expect(result).toEqual(mockUpdatedReservation);
      expect(prisma.reservation.findUnique).toHaveBeenCalledWith({
        where: { id: reservationId },
      });
      expect(prisma.reservation.update).toHaveBeenCalledWith({
        where: { id: reservationId },
        data: { status: 'cancelled' },
        include: {
          book: {
            select: {
              id: true,
              title: true,
              author: true,
            },
          },
          member: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when reservation does not exist', async () => {
      prisma.reservation.findUnique.mockResolvedValue(null);

      await expect(service.cancel(reservationId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.cancel(reservationId)).rejects.toThrow(
        `Reservation with ID ${reservationId} not found`,
      );

      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when reservation is already cancelled', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        ...mockActiveReservation,
        status: 'cancelled',
      });

      await expect(service.cancel(reservationId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.cancel(reservationId)).rejects.toThrow(
        "Cannot cancel a reservation with status 'cancelled'",
      );

      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when reservation is fulfilled', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        ...mockActiveReservation,
        status: 'fulfilled',
      });

      await expect(service.cancel(reservationId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.cancel(reservationId)).rejects.toThrow(
        "Cannot cancel a reservation with status 'fulfilled'",
      );

      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when reservation is expired', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        ...mockActiveReservation,
        status: 'expired',
      });

      await expect(service.cancel(reservationId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.cancel(reservationId)).rejects.toThrow(
        "Cannot cancel a reservation with status 'expired'",
      );

      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });
  });

  // ─── getByMember ────────────────────────────────────────────────────

  describe('getByMember', () => {
    const memberId = 'member-1';

    const mockMember = {
      id: 'member-1',
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      status: 'active',
    };

    const mockReservations = [
      {
        id: 'reservation-2',
        bookId: 'book-2',
        memberId: 'member-1',
        status: 'active',
        reservationDate: new Date('2026-01-20'),
        expiryDate: new Date('2026-02-19'),
        book: {
          id: 'book-2',
          title: 'The Pragmatic Programmer',
          author: 'David Thomas',
          isbn: '978-0135957059',
          availableCopies: 0,
          totalCopies: 2,
          coverImageUrl: null,
        },
      },
      {
        id: 'reservation-1',
        bookId: 'book-1',
        memberId: 'member-1',
        status: 'fulfilled',
        reservationDate: new Date('2026-01-15'),
        expiryDate: new Date('2026-02-14'),
        book: {
          id: 'book-1',
          title: 'Clean Code',
          author: 'Robert C. Martin',
          isbn: '978-0132350884',
          availableCopies: 1,
          totalCopies: 3,
          coverImageUrl: 'https://example.com/cover.jpg',
        },
      },
    ];

    it('should return all reservations for a member', async () => {
      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.reservation.findMany.mockResolvedValue(mockReservations);

      const result = await service.getByMember(memberId);

      expect(result).toEqual(mockReservations);
      expect(result).toHaveLength(2);

      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { id: memberId },
      });
      expect(prisma.reservation.findMany).toHaveBeenCalledWith({
        where: { memberId },
        include: {
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              isbn: true,
              availableCopies: true,
              totalCopies: true,
              coverImageUrl: true,
            },
          },
        },
        orderBy: { reservationDate: 'desc' },
      });
    });

    it('should return an empty array when member has no reservations', async () => {
      prisma.member.findUnique.mockResolvedValue(mockMember);
      prisma.reservation.findMany.mockResolvedValue([]);

      const result = await service.getByMember(memberId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(service.getByMember(memberId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getByMember(memberId)).rejects.toThrow(
        `Member with ID ${memberId} not found`,
      );

      expect(prisma.reservation.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── getByBook ──────────────────────────────────────────────────────

  describe('getByBook', () => {
    const bookId = 'book-1';

    const mockBook = {
      id: 'book-1',
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: '978-0132350884',
      availableCopies: 0,
      totalCopies: 3,
      isDeleted: false,
    };

    const mockReservationQueue = [
      {
        id: 'reservation-1',
        bookId: 'book-1',
        memberId: 'member-1',
        status: 'active',
        reservationDate: new Date('2026-01-10'),
        expiryDate: new Date('2026-02-09'),
        member: {
          id: 'member-1',
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          phone: '555-0101',
          memberType: 'public',
        },
      },
      {
        id: 'reservation-2',
        bookId: 'book-1',
        memberId: 'member-2',
        status: 'active',
        reservationDate: new Date('2026-01-12'),
        expiryDate: new Date('2026-02-11'),
        member: {
          id: 'member-2',
          fullName: 'John Smith',
          email: 'john@example.com',
          phone: '555-0102',
          memberType: 'student',
        },
      },
    ];

    it('should return the reservation queue for a book ordered by reservation date ascending', async () => {
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.reservation.findMany.mockResolvedValue(mockReservationQueue);

      const result = await service.getByBook(bookId);

      expect(result).toEqual(mockReservationQueue);
      expect(result).toHaveLength(2);

      expect(prisma.book.findUnique).toHaveBeenCalledWith({
        where: { id: bookId },
      });
      expect(prisma.reservation.findMany).toHaveBeenCalledWith({
        where: {
          bookId,
          status: 'active',
        },
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
        },
        orderBy: { reservationDate: 'asc' },
      });
    });

    it('should return an empty array when no active reservations exist for the book', async () => {
      prisma.book.findUnique.mockResolvedValue(mockBook);
      prisma.reservation.findMany.mockResolvedValue([]);

      const result = await service.getByBook(bookId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should throw NotFoundException when book does not exist', async () => {
      prisma.book.findUnique.mockResolvedValue(null);

      await expect(service.getByBook(bookId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getByBook(bookId)).rejects.toThrow(
        `Book with ID ${bookId} not found`,
      );

      expect(prisma.reservation.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── fulfill ────────────────────────────────────────────────────────

  describe('fulfill', () => {
    const reservationId = 'reservation-1';

    const mockActiveReservation = {
      id: 'reservation-1',
      bookId: 'book-1',
      memberId: 'member-1',
      status: 'active',
      reservationDate: new Date('2026-01-15'),
      expiryDate: new Date('2026-02-14'),
    };

    const mockFulfilledReservation = {
      ...mockActiveReservation,
      status: 'fulfilled',
      book: {
        id: 'book-1',
        title: 'Clean Code',
        author: 'Robert C. Martin',
      },
      member: {
        id: 'member-1',
        fullName: 'Jane Doe',
      },
    };

    it('should fulfill an active reservation successfully', async () => {
      prisma.reservation.findUnique.mockResolvedValue(mockActiveReservation);
      prisma.reservation.update.mockResolvedValue(mockFulfilledReservation);

      const result = await service.fulfill(reservationId);

      expect(result).toEqual(mockFulfilledReservation);
      expect(prisma.reservation.findUnique).toHaveBeenCalledWith({
        where: { id: reservationId },
      });
      expect(prisma.reservation.update).toHaveBeenCalledWith({
        where: { id: reservationId },
        data: { status: 'fulfilled' },
        include: {
          book: {
            select: {
              id: true,
              title: true,
              author: true,
            },
          },
          member: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when reservation does not exist', async () => {
      prisma.reservation.findUnique.mockResolvedValue(null);

      await expect(service.fulfill(reservationId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.fulfill(reservationId)).rejects.toThrow(
        `Reservation with ID ${reservationId} not found`,
      );

      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when reservation is already fulfilled', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        ...mockActiveReservation,
        status: 'fulfilled',
      });

      await expect(service.fulfill(reservationId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.fulfill(reservationId)).rejects.toThrow(
        "Cannot fulfill a reservation with status 'fulfilled'",
      );

      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when reservation is cancelled', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        ...mockActiveReservation,
        status: 'cancelled',
      });

      await expect(service.fulfill(reservationId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.fulfill(reservationId)).rejects.toThrow(
        "Cannot fulfill a reservation with status 'cancelled'",
      );

      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when reservation is expired', async () => {
      prisma.reservation.findUnique.mockResolvedValue({
        ...mockActiveReservation,
        status: 'expired',
      });

      await expect(service.fulfill(reservationId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.fulfill(reservationId)).rejects.toThrow(
        "Cannot fulfill a reservation with status 'expired'",
      );

      expect(prisma.reservation.update).not.toHaveBeenCalled();
    });
  });

  // ─── expireOld ──────────────────────────────────────────────────────

  describe('expireOld', () => {
    it('should expire all past-due reservations and return count', async () => {
      prisma.reservation.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.expireOld();

      expect(result).toEqual({ expiredCount: 5 });
      expect(prisma.reservation.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          expiryDate: {
            lt: expect.any(Date),
          },
        },
        data: {
          status: 'expired',
        },
      });
    });

    it('should return zero count when no reservations are past due', async () => {
      prisma.reservation.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.expireOld();

      expect(result).toEqual({ expiredCount: 0 });
      expect(prisma.reservation.updateMany).toHaveBeenCalledTimes(1);
    });

    it('should use current date for the expiry comparison', async () => {
      prisma.reservation.updateMany.mockResolvedValue({ count: 0 });

      const before = new Date();
      await service.expireOld();
      const after = new Date();

      const callArgs = prisma.reservation.updateMany.mock.calls[0][0];
      const usedDate = callArgs.where.expiryDate.lt as Date;

      expect(usedDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(usedDate.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should handle expiring a single reservation', async () => {
      prisma.reservation.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.expireOld();

      expect(result).toEqual({ expiredCount: 1 });
    });
  });

  // ─── getNextInQueue ─────────────────────────────────────────────────

  describe('getNextInQueue', () => {
    const bookId = 'book-1';

    const mockNextReservation = {
      id: 'reservation-1',
      bookId: 'book-1',
      memberId: 'member-1',
      status: 'active',
      reservationDate: new Date('2026-01-10'),
      expiryDate: new Date('2026-02-09'),
      member: {
        id: 'member-1',
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '555-0101',
      },
      book: {
        id: 'book-1',
        title: 'Clean Code',
        author: 'Robert C. Martin',
      },
    };

    it('should return the oldest active reservation for a book', async () => {
      prisma.reservation.findFirst.mockResolvedValue(mockNextReservation);

      const result = await service.getNextInQueue(bookId);

      expect(result).toEqual(mockNextReservation);
      expect(prisma.reservation.findFirst).toHaveBeenCalledWith({
        where: {
          bookId,
          status: 'active',
        },
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
            },
          },
          book: {
            select: {
              id: true,
              title: true,
              author: true,
            },
          },
        },
        orderBy: { reservationDate: 'asc' },
      });
    });

    it('should return null when no active reservations exist for the book', async () => {
      prisma.reservation.findFirst.mockResolvedValue(null);

      const result = await service.getNextInQueue(bookId);

      expect(result).toBeNull();
      expect(prisma.reservation.findFirst).toHaveBeenCalledWith({
        where: {
          bookId,
          status: 'active',
        },
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
            },
          },
          book: {
            select: {
              id: true,
              title: true,
              author: true,
            },
          },
        },
        orderBy: { reservationDate: 'asc' },
      });
    });
  });
});
