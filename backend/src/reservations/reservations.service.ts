import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { addDays } from 'date-fns';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';

const MAX_ACTIVE_RESERVATIONS = 3;
const RESERVATION_EXPIRY_DAYS = 30;

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new reservation for a book.
   * Validations:
   * - Book must exist and not be deleted
   * - Book must have 0 available copies (can only reserve unavailable books)
   * - Member must not already have an active reservation for this book
   * - Member must have fewer than 3 active reservations total
   * Expiry date is set to 30 days from now.
   */
  async create(dto: CreateReservationDto, memberId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: dto.bookId },
    });

    if (!book) {
      throw new NotFoundException(`Book with ID ${dto.bookId} not found`);
    }

    if (book.isDeleted) {
      throw new BadRequestException('This book has been removed from the library');
    }

    if (book.availableCopies > 0) {
      throw new BadRequestException(
        'This book is currently available. You can borrow it directly instead of reserving.',
      );
    }

    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID ${memberId} not found`);
    }

    if (member.status !== 'active') {
      throw new BadRequestException(
        'Your membership is not active. Please contact the library to renew your membership.',
      );
    }

    // Check for existing active reservation for the same book by this member
    const existingReservation = await this.prisma.reservation.findFirst({
      where: {
        bookId: dto.bookId,
        memberId,
        status: 'active',
      },
    });

    if (existingReservation) {
      throw new BadRequestException(
        'You already have an active reservation for this book',
      );
    }

    // Check total active reservations count
    const activeReservationsCount = await this.prisma.reservation.count({
      where: {
        memberId,
        status: 'active',
      },
    });

    if (activeReservationsCount >= MAX_ACTIVE_RESERVATIONS) {
      throw new BadRequestException(
        `You cannot have more than ${MAX_ACTIVE_RESERVATIONS} active reservations at a time`,
      );
    }

    const expiryDate = addDays(new Date(), RESERVATION_EXPIRY_DAYS);

    const reservation = await this.prisma.reservation.create({
      data: {
        bookId: dto.bookId,
        memberId,
        expiryDate,
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

    this.logger.log(
      `Reservation created: member [${memberId}] reserved book [${dto.bookId}] "${book.title}". Expires: ${expiryDate.toISOString()}`,
    );

    return reservation;
  }

  /**
   * Cancel a reservation by setting its status to 'cancelled'.
   */
  async cancel(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException(
        `Reservation with ID ${reservationId} not found`,
      );
    }

    if (reservation.status !== 'active') {
      throw new BadRequestException(
        `Cannot cancel a reservation with status '${reservation.status}'`,
      );
    }

    const updated = await this.prisma.reservation.update({
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

    this.logger.log(
      `Reservation [${reservationId}] cancelled for member [${reservation.memberId}]`,
    );

    return updated;
  }

  /**
   * Get all reservations for a specific member, with book details.
   */
  async getByMember(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID ${memberId} not found`);
    }

    const reservations = await this.prisma.reservation.findMany({
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

    return reservations;
  }

  /**
   * Get the reservation queue for a specific book, ordered by reservation date
   * (oldest first, i.e. first-come-first-served).
   */
  async getByBook(bookId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
    });

    if (!book) {
      throw new NotFoundException(`Book with ID ${bookId} not found`);
    }

    const reservations = await this.prisma.reservation.findMany({
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

    return reservations;
  }

  /**
   * Fulfill a reservation by setting its status to 'fulfilled'.
   * Typically called when the reserved book is checked out to the member.
   */
  async fulfill(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundException(
        `Reservation with ID ${reservationId} not found`,
      );
    }

    if (reservation.status !== 'active') {
      throw new BadRequestException(
        `Cannot fulfill a reservation with status '${reservation.status}'`,
      );
    }

    const updated = await this.prisma.reservation.update({
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

    this.logger.log(
      `Reservation [${reservationId}] fulfilled for member [${reservation.memberId}]`,
    );

    return updated;
  }

  /**
   * Expire all reservations that have passed their expiry date.
   * Returns the count of expired reservations.
   */
  async expireOld() {
    const now = new Date();

    const result = await this.prisma.reservation.updateMany({
      where: {
        status: 'active',
        expiryDate: {
          lt: now,
        },
      },
      data: {
        status: 'expired',
      },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} reservation(s) past their expiry date`);
    }

    return { expiredCount: result.count };
  }

  /**
   * Get the next member in the reservation queue for a specific book.
   * Returns the oldest active reservation (first-come-first-served).
   */
  async getNextInQueue(bookId: string) {
    const reservation = await this.prisma.reservation.findFirst({
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

    return reservation;
  }
}
