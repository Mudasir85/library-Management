import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { FineQueryDto } from './dto/fine-query.dto';
import { PayFineDto } from './dto/pay-fine.dto';
import { LostBookDto } from './dto/lost-book.dto';
import { DamageFineDto } from './dto/damage-fine.dto';

@Injectable()
export class FinesService {
  private readonly logger = new Logger(FinesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieve a paginated list of fines with optional filters.
   */
  async findAll(query: FineQueryDto) {
    const where: Prisma.FineWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.fineType) {
      where.fineType = query.fineType;
    }

    if (query.memberId) {
      where.memberId = query.memberId;
    }

    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { member: { fullName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const validSortFields = [
      'createdAt',
      'updatedAt',
      'amount',
      'paidAmount',
      'paymentDate',
      'status',
      'fineType',
    ] as const;

    type SortField = (typeof validSortFields)[number];

    let orderBy: Prisma.FineOrderByWithRelationInput;
    if (query.sortBy && validSortFields.includes(query.sortBy as SortField)) {
      orderBy = { [query.sortBy as SortField]: query.sortOrder };
    } else {
      orderBy = { createdAt: 'desc' };
    }

    const [fines, total] = await Promise.all([
      this.prisma.fine.findMany({
        where,
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
              email: true,
              memberType: true,
            },
          },
          transaction: {
            select: {
              id: true,
              bookId: true,
              issueDate: true,
              dueDate: true,
              returnDate: true,
              book: {
                select: {
                  id: true,
                  title: true,
                  author: true,
                  isbn: true,
                },
              },
            },
          },
        },
        orderBy,
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.fine.count({ where }),
    ]);

    return { fines, total };
  }

  /**
   * Retrieve all fines for a specific member.
   */
  async findByMember(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID ${memberId} not found`);
    }

    const fines = await this.prisma.fine.findMany({
      where: { memberId },
      include: {
        transaction: {
          select: {
            id: true,
            bookId: true,
            issueDate: true,
            dueDate: true,
            returnDate: true,
            book: {
              select: {
                id: true,
                title: true,
                author: true,
                isbn: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return fines;
  }

  /**
   * Retrieve all outstanding (unpaid) fines across the system.
   */
  async getOutstanding() {
    const fines = await this.prisma.fine.findMany({
      where: { status: 'pending' },
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
        transaction: {
          select: {
            id: true,
            bookId: true,
            issueDate: true,
            dueDate: true,
            returnDate: true,
            book: {
              select: {
                id: true,
                title: true,
                author: true,
                isbn: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return fines;
  }

  /**
   * Process a payment for a fine (supports full and partial payments).
   * Uses a Prisma transaction to atomically update the fine and the member's
   * outstanding fines balance.
   */
  async processPayment(dto: PayFineDto) {
    const fine = await this.prisma.fine.findUnique({
      where: { id: dto.fineId },
    });

    if (!fine) {
      throw new NotFoundException(`Fine with ID ${dto.fineId} not found`);
    }

    if (fine.status === 'paid') {
      throw new BadRequestException('This fine has already been fully paid');
    }

    if (fine.status === 'waived') {
      throw new BadRequestException('This fine has been waived and cannot be paid');
    }

    const currentPaid = new Prisma.Decimal(fine.paidAmount.toString());
    const fineAmount = new Prisma.Decimal(fine.amount.toString());
    const paymentAmount = new Prisma.Decimal(dto.amount.toString());
    const remainingBalance = fineAmount.minus(currentPaid);

    if (paymentAmount.greaterThan(remainingBalance)) {
      throw new BadRequestException(
        `Payment amount (${dto.amount}) exceeds remaining balance (${remainingBalance.toFixed(2)})`,
      );
    }

    const newPaidAmount = currentPaid.plus(paymentAmount);
    const isFullyPaid = newPaidAmount.greaterThanOrEqualTo(fineAmount);

    const updatedFine = await this.prisma.$transaction(async (tx) => {
      // Update the fine record
      const updated = await tx.fine.update({
        where: { id: dto.fineId },
        data: {
          paidAmount: newPaidAmount,
          paymentDate: new Date(),
          paymentMethod: dto.paymentMethod,
          status: isFullyPaid ? 'paid' : 'pending',
        },
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
              outstandingFines: true,
            },
          },
        },
      });

      // Decrease the member's outstanding fines by the payment amount
      await tx.member.update({
        where: { id: fine.memberId },
        data: {
          outstandingFines: {
            decrement: paymentAmount,
          },
        },
      });

      return updated;
    });

    this.logger.log(
      `Payment of ${dto.amount} processed for fine [${dto.fineId}] by member [${fine.memberId}]. Status: ${updatedFine.status}`,
    );

    return updatedFine;
  }

  /**
   * Waive a fine entirely. Sets status to 'waived' and adjusts the member's
   * outstanding fines balance accordingly.
   */
  async waiveFine(fineId: string) {
    const fine = await this.prisma.fine.findUnique({
      where: { id: fineId },
    });

    if (!fine) {
      throw new NotFoundException(`Fine with ID ${fineId} not found`);
    }

    if (fine.status === 'paid') {
      throw new BadRequestException('Cannot waive an already paid fine');
    }

    if (fine.status === 'waived') {
      throw new BadRequestException('This fine has already been waived');
    }

    // Calculate the unpaid portion that needs to be removed from outstanding fines
    const unpaidAmount = new Prisma.Decimal(fine.amount.toString()).minus(
      new Prisma.Decimal(fine.paidAmount.toString()),
    );

    const updatedFine = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.fine.update({
        where: { id: fineId },
        data: {
          status: 'waived',
        },
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
              outstandingFines: true,
            },
          },
        },
      });

      // Reduce the member's outstanding fines by the unpaid portion
      if (unpaidAmount.greaterThan(0)) {
        await tx.member.update({
          where: { id: fine.memberId },
          data: {
            outstandingFines: {
              decrement: unpaidAmount,
            },
          },
        });
      }

      return updated;
    });

    this.logger.log(
      `Fine [${fineId}] waived for member [${fine.memberId}]. Waived amount: ${unpaidAmount.toFixed(2)}`,
    );

    return updatedFine;
  }

  /**
   * Record a lost book fine. Creates a fine equal to the book price plus a $5
   * processing fee, and decrements the book's available and total copies.
   * Uses a Prisma transaction for atomicity.
   */
  async recordLostBook(dto: LostBookDto) {
    const [member, book, transaction] = await Promise.all([
      this.prisma.member.findUnique({ where: { id: dto.memberId } }),
      this.prisma.book.findUnique({ where: { id: dto.bookId } }),
      this.prisma.transaction.findUnique({ where: { id: dto.transactionId } }),
    ]);

    if (!member) {
      throw new NotFoundException(`Member with ID ${dto.memberId} not found`);
    }

    if (!book) {
      throw new NotFoundException(`Book with ID ${dto.bookId} not found`);
    }

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with ID ${dto.transactionId} not found`,
      );
    }

    if (transaction.memberId !== dto.memberId) {
      throw new BadRequestException(
        'Transaction does not belong to the specified member',
      );
    }

    if (transaction.bookId !== dto.bookId) {
      throw new BadRequestException(
        'Transaction does not correspond to the specified book',
      );
    }

    // Fine = book price + $5 processing fee. Default to $25 if no price set.
    const bookPrice = book.price
      ? new Prisma.Decimal(book.price.toString())
      : new Prisma.Decimal('25.00');
    const processingFee = new Prisma.Decimal('5.00');
    const fineAmount = bookPrice.plus(processingFee);

    const description =
      dto.description ||
      `Lost book: "${book.title}" by ${book.author}. Replacement cost ($${bookPrice.toFixed(2)}) + processing fee ($${processingFee.toFixed(2)})`;

    const fine = await this.prisma.$transaction(async (tx) => {
      // Create the lost book fine
      const newFine = await tx.fine.create({
        data: {
          transactionId: dto.transactionId,
          memberId: dto.memberId,
          fineType: 'lost',
          amount: fineAmount,
          description,
        },
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
            },
          },
          transaction: {
            select: {
              id: true,
              book: {
                select: {
                  id: true,
                  title: true,
                  author: true,
                },
              },
            },
          },
        },
      });

      // Decrement available copies and total copies
      await tx.book.update({
        where: { id: dto.bookId },
        data: {
          availableCopies: { decrement: 1 },
          totalCopies: { decrement: 1 },
        },
      });

      // Increment the member's outstanding fines
      await tx.member.update({
        where: { id: dto.memberId },
        data: {
          outstandingFines: { increment: fineAmount },
        },
      });

      return newFine;
    });

    this.logger.log(
      `Lost book fine of $${fineAmount.toFixed(2)} recorded for member [${dto.memberId}], book [${dto.bookId}]`,
    );

    return fine;
  }

  /**
   * Record a damage fine based on the damage percentage and the book's price.
   * damagePercent: 25 (minor), 50 (moderate), 100 (severe/total destruction).
   */
  async recordDamage(dto: DamageFineDto) {
    const [member, book] = await Promise.all([
      this.prisma.member.findUnique({ where: { id: dto.memberId } }),
      this.prisma.book.findUnique({ where: { id: dto.bookId } }),
    ]);

    if (!member) {
      throw new NotFoundException(`Member with ID ${dto.memberId} not found`);
    }

    if (!book) {
      throw new NotFoundException(`Book with ID ${dto.bookId} not found`);
    }

    if (dto.transactionId) {
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: dto.transactionId },
      });
      if (!transaction) {
        throw new NotFoundException(
          `Transaction with ID ${dto.transactionId} not found`,
        );
      }
    }

    // Fine = damagePercent% of book price. Default to $25 if no price set.
    const bookPrice = book.price
      ? new Prisma.Decimal(book.price.toString())
      : new Prisma.Decimal('25.00');
    const damageMultiplier = new Prisma.Decimal(dto.damagePercent.toString()).dividedBy(100);
    const fineAmount = bookPrice.times(damageMultiplier);

    const damageLabel =
      dto.damagePercent === 25
        ? 'Minor'
        : dto.damagePercent === 50
          ? 'Moderate'
          : 'Severe';

    const description =
      dto.description ||
      `${damageLabel} damage (${dto.damagePercent}%) to "${book.title}" by ${book.author}. Fine: $${fineAmount.toFixed(2)}`;

    const fine = await this.prisma.$transaction(async (tx) => {
      const newFine = await tx.fine.create({
        data: {
          transactionId: dto.transactionId || null,
          memberId: dto.memberId,
          fineType: 'damage',
          amount: fineAmount,
          description,
        },
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
            },
          },
          transaction: {
            select: {
              id: true,
              book: {
                select: {
                  id: true,
                  title: true,
                  author: true,
                },
              },
            },
          },
        },
      });

      // Increment the member's outstanding fines
      await tx.member.update({
        where: { id: dto.memberId },
        data: {
          outstandingFines: { increment: fineAmount },
        },
      });

      return newFine;
    });

    this.logger.log(
      `Damage fine of $${fineAmount.toFixed(2)} (${dto.damagePercent}%) recorded for member [${dto.memberId}], book [${dto.bookId}]`,
    );

    return fine;
  }
}
