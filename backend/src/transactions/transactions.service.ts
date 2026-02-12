import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { IssueBookDto } from './dto/issue-book.dto';
import { ReturnBookDto } from './dto/return-book.dto';
import { RenewBookDto } from './dto/renew-book.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { addDays, differenceInDays, startOfDay } from 'date-fns';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Issue a book to a member.
   *
   * Validates member eligibility, book availability, reservation conflicts,
   * then atomically creates the transaction and updates book/member counts.
   */
  async issueBook(dto: IssueBookDto, issuedById: string) {
    const { memberId, bookId } = dto;

    // 1. Validate member exists and is active
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID "${memberId}" not found`);
    }

    if (member.status !== 'active') {
      throw new BadRequestException(
        `Member account is ${member.status}. Only active members can borrow books.`,
      );
    }

    // 2. Get system settings for this member type
    const settings = await this.prisma.systemSetting.findUnique({
      where: { memberType: member.memberType },
    });

    if (!settings) {
      throw new BadRequestException(
        `System settings not configured for member type "${member.memberType}". Contact an administrator.`,
      );
    }

    // 3. Check member hasn't exceeded their borrowing limit
    if (member.booksIssuedCount >= settings.maxBooksAllowed) {
      throw new BadRequestException(
        `Member has already issued ${member.booksIssuedCount} book(s). ` +
          `Maximum allowed for ${member.memberType} members is ${settings.maxBooksAllowed}.`,
      );
    }

    // 4. Check member's outstanding fines are within acceptable limit
    const outstandingFines = Number(member.outstandingFines);
    if (outstandingFines > 10) {
      throw new BadRequestException(
        `Member has outstanding fines of $${outstandingFines.toFixed(2)}. ` +
          `Fines must be $10.00 or less to borrow books. Please clear fines first.`,
      );
    }

    // 5. Validate book exists and has available copies
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
    });

    if (!book) {
      throw new NotFoundException(`Book with ID "${bookId}" not found`);
    }

    if (book.isDeleted) {
      throw new BadRequestException(
        'This book has been removed from the library catalog.',
      );
    }

    if (book.availableCopies <= 0) {
      throw new BadRequestException(
        `No available copies of "${book.title}". All ${book.totalCopies} copies are currently issued.`,
      );
    }

    // 5b. Check if the member already has this book issued
    const existingTransaction = await this.prisma.transaction.findFirst({
      where: {
        memberId,
        bookId,
        status: 'issued',
      },
    });

    if (existingTransaction) {
      throw new ConflictException(
        `Member already has an active issue for "${book.title}".`,
      );
    }

    // 6. Check reservations - if reserved by someone else, block. If reserved by this member, fulfill it.
    const activeReservation = await this.prisma.reservation.findFirst({
      where: {
        bookId,
        status: 'active',
      },
      orderBy: { reservationDate: 'asc' },
    });

    if (activeReservation && activeReservation.memberId !== memberId) {
      throw new ConflictException(
        `This book is currently reserved by another member. Cannot issue.`,
      );
    }

    // 7. Calculate due date
    const now = new Date();
    const dueDate = startOfDay(addDays(now, settings.loanDurationDays));

    // 8-11. Create transaction atomically
    const transaction = await this.prisma.$transaction(async (tx) => {
      // Create the transaction record
      const newTransaction = await tx.transaction.create({
        data: {
          memberId,
          bookId,
          issueDate: now,
          dueDate,
          status: 'issued',
          issuedById,
        },
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
              memberType: true,
              email: true,
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

      // Decrement book's available copies
      await tx.book.update({
        where: { id: bookId },
        data: {
          availableCopies: { decrement: 1 },
        },
      });

      // Increment member's books issued count
      await tx.member.update({
        where: { id: memberId },
        data: {
          booksIssuedCount: { increment: 1 },
        },
      });

      // If this member had an active reservation for this book, fulfill it
      if (activeReservation && activeReservation.memberId === memberId) {
        await tx.reservation.update({
          where: { id: activeReservation.id },
          data: { status: 'fulfilled' },
        });
      }

      return newTransaction;
    });

    this.logger.log(
      `Book "${book.title}" issued to member "${member.fullName}" (Transaction: ${transaction.id})`,
    );

    return transaction;
  }

  /**
   * Return a book from a member.
   *
   * Calculates fines for overdue returns, creates fine records,
   * and atomically updates all related records.
   */
  async returnBook(dto: ReturnBookDto, returnedToId: string) {
    const { transactionId, bookId, memberId } = dto;

    // Validate that we have enough info to find the transaction
    if (!transactionId && (!bookId || !memberId)) {
      throw new BadRequestException(
        'Either transactionId or both bookId and memberId are required to process a return.',
      );
    }

    // 1. Find the active transaction
    let transaction: Awaited<ReturnType<typeof this.prisma.transaction.findFirst>>;

    if (transactionId) {
      transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          member: true,
          book: true,
        },
      });
    } else {
      transaction = await this.prisma.transaction.findFirst({
        where: {
          bookId: bookId!,
          memberId: memberId!,
          status: { in: ['issued', 'overdue'] },
        },
        include: {
          member: true,
          book: true,
        },
      });
    }

    if (!transaction) {
      throw new NotFoundException(
        'No active transaction found matching the provided criteria.',
      );
    }

    if (transaction.status === 'returned') {
      throw new BadRequestException(
        'This transaction has already been returned.',
      );
    }

    // 2. Get system settings for fine calculation
    const member = (transaction as any).member;
    const book = (transaction as any).book;

    const settings = await this.prisma.systemSetting.findUnique({
      where: { memberType: member.memberType },
    });

    if (!settings) {
      throw new BadRequestException(
        `System settings not configured for member type "${member.memberType}".`,
      );
    }

    // 3. Calculate overdue days and fine
    const now = new Date();
    const returnDate = now;
    const dueDate = new Date(transaction.dueDate);
    const gracePeriodDays = settings.gracePeriodDays;
    const effectiveDueDate = addDays(dueDate, gracePeriodDays);

    let overdueDays = differenceInDays(
      startOfDay(returnDate),
      startOfDay(effectiveDueDate),
    );

    // Only count positive overdue days (if returned before effective due date, no fine)
    overdueDays = Math.max(0, overdueDays);

    let fineAmount = new Prisma.Decimal(0);
    let fineRecord: { id: string; amount: Prisma.Decimal } | null = null;

    if (overdueDays > 0) {
      const finePerDay = Number(settings.finePerDay);
      let calculatedFine = overdueDays * finePerDay;

      // Cap fine at book price + 5 (if book has a price)
      if (book.price) {
        const maxFine = Number(book.price) + 5;
        calculatedFine = Math.min(calculatedFine, maxFine);
      }

      fineAmount = new Prisma.Decimal(calculatedFine.toFixed(2));
    }

    // 4-10. Perform the return atomically
    const updatedTransaction = await this.prisma.$transaction(async (tx) => {
      // Create Fine record if applicable
      if (fineAmount.greaterThan(0)) {
        fineRecord = await tx.fine.create({
          data: {
            transactionId: transaction!.id,
            memberId: transaction!.memberId,
            fineType: 'overdue',
            amount: fineAmount,
            status: 'pending',
            description: `Overdue fine for ${overdueDays} day(s) past grace period. ` +
              `Due: ${dueDate.toISOString().split('T')[0]}, ` +
              `Returned: ${returnDate.toISOString().split('T')[0]}.`,
          },
        });
      }

      // Update the transaction
      const updated = await tx.transaction.update({
        where: { id: transaction!.id },
        data: {
          returnDate: returnDate,
          status: 'returned',
          fineAmount: fineAmount,
          returnedToId,
        },
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
              memberType: true,
              email: true,
              booksIssuedCount: true,
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
            select: { id: true, fullName: true },
          },
          returnedTo: {
            select: { id: true, fullName: true },
          },
          fines: true,
        },
      });

      // Increment book's available copies
      await tx.book.update({
        where: { id: transaction!.bookId },
        data: {
          availableCopies: { increment: 1 },
        },
      });

      // Decrement member's books issued count (ensure it doesn't go below 0)
      await tx.member.update({
        where: { id: transaction!.memberId },
        data: {
          booksIssuedCount: {
            decrement: 1,
          },
        },
      });

      // Ensure booksIssuedCount doesn't go negative
      await tx.member.updateMany({
        where: {
          id: transaction!.memberId,
          booksIssuedCount: { lt: 0 },
        },
        data: {
          booksIssuedCount: 0,
        },
      });

      // Update member's outstanding fines if fine was created
      if (fineAmount.greaterThan(0)) {
        await tx.member.update({
          where: { id: transaction!.memberId },
          data: {
            outstandingFines: {
              increment: fineAmount,
            },
          },
        });
      }

      // 9. Check for active reservations on this book and log for notification
      const pendingReservations = await tx.reservation.findMany({
        where: {
          bookId: transaction!.bookId,
          status: 'active',
        },
        orderBy: { reservationDate: 'asc' },
        include: {
          member: {
            select: { fullName: true, email: true },
          },
        },
      });

      if (pendingReservations.length > 0) {
        const nextReservation = pendingReservations[0];
        this.logger.log(
          `Book "${book.title}" returned. Next reservation: ` +
            `Member "${nextReservation.member.fullName}" (${nextReservation.member.email}). ` +
            `Notification should be sent.`,
        );
      }

      return updated;
    });

    this.logger.log(
      `Book "${book.title}" returned by member "${member.fullName}" ` +
        `(Transaction: ${transaction.id})` +
        (fineAmount.greaterThan(0)
          ? `. Fine: $${fineAmount.toFixed(2)} (${overdueDays} days overdue)`
          : ''),
    );

    return {
      ...updatedTransaction,
      overdueDays,
      fineApplied: fineAmount.greaterThan(0),
    };
  }

  /**
   * Renew a book transaction.
   *
   * Extends the due date by the loan duration, if renewal limits
   * and reservation constraints are met.
   */
  async renewBook(dto: RenewBookDto, userId: string) {
    const { transactionId } = dto;

    // 1. Find the transaction
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        member: true,
        book: {
          select: { id: true, title: true },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with ID "${transactionId}" not found.`,
      );
    }

    if (transaction.status !== 'issued') {
      throw new BadRequestException(
        `Only issued transactions can be renewed. Current status: "${transaction.status}".`,
      );
    }

    // 2. Get system settings for the member's type
    const settings = await this.prisma.systemSetting.findUnique({
      where: { memberType: transaction.member.memberType },
    });

    if (!settings) {
      throw new BadRequestException(
        `System settings not configured for member type "${transaction.member.memberType}".`,
      );
    }

    // 3. Check renewal count limit
    if (transaction.renewalCount >= settings.renewalLimit) {
      throw new BadRequestException(
        `Maximum renewal limit of ${settings.renewalLimit} reached for this transaction. ` +
          `The book must be returned.`,
      );
    }

    // 4. Check no active reservation by another member for this book
    const activeReservation = await this.prisma.reservation.findFirst({
      where: {
        bookId: transaction.bookId,
        status: 'active',
        memberId: { not: transaction.memberId },
      },
    });

    if (activeReservation) {
      throw new ConflictException(
        'This book has been reserved by another member and cannot be renewed. Please return the book.',
      );
    }

    // 5. Extend due date from current due date by loan duration days
    const currentDueDate = new Date(transaction.dueDate);
    const newDueDate = startOfDay(
      addDays(currentDueDate, settings.loanDurationDays),
    );

    // 6. Update the transaction
    const updatedTransaction = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        dueDate: newDueDate,
        renewalCount: { increment: 1 },
      },
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            memberType: true,
            email: true,
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
          select: { id: true, fullName: true },
        },
      },
    });

    this.logger.log(
      `Transaction ${transactionId} renewed (count: ${updatedTransaction.renewalCount}/${settings.renewalLimit}). ` +
        `New due date: ${newDueDate.toISOString().split('T')[0]}`,
    );

    return {
      ...updatedTransaction,
      previousDueDate: currentDueDate,
      newDueDate,
      renewalsRemaining: settings.renewalLimit - updatedTransaction.renewalCount,
    };
  }

  /**
   * Retrieve a paginated list of transactions with optional filters.
   */
  async findAll(query: TransactionQueryDto) {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      status,
      memberId,
      bookId,
      fromDate,
      toDate,
    } = query;

    const where: Prisma.TransactionWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (memberId) {
      where.memberId = memberId;
    }

    if (bookId) {
      where.bookId = bookId;
    }

    if (fromDate || toDate) {
      where.issueDate = {};
      if (fromDate) {
        where.issueDate.gte = new Date(fromDate);
      }
      if (toDate) {
        // Include the entire end date by setting to end of day
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        where.issueDate.lte = endDate;
      }
    }

    const validSortFields = [
      'issueDate',
      'dueDate',
      'returnDate',
      'createdAt',
      'updatedAt',
      'status',
    ] as const;

    type SortField = (typeof validSortFields)[number];

    let orderBy: Prisma.TransactionOrderByWithRelationInput;
    const mappedField = sortBy ? (orderByFieldMap[sortBy] || sortBy) : null;
    if (mappedField && validSortFields.includes(mappedField as SortField)) {
      orderBy = { [mappedField as SortField]: sortOrder };
    } else {
      orderBy = { createdAt: sortOrder };
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: limit,
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
              memberType: true,
              email: true,
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
            select: { id: true, fullName: true },
          },
          returnedTo: {
            select: { id: true, fullName: true },
          },
          fines: {
            select: {
              id: true,
              fineType: true,
              amount: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { transactions, total, page, limit };
  }

  /**
   * Retrieve a single transaction by ID with full relation data.
   */
  async findOne(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            memberType: true,
            email: true,
            phone: true,
            department: true,
            studentEmployeeId: true,
          },
        },
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            isbn: true,
            publisher: true,
            shelfLocation: true,
            callNumber: true,
          },
        },
        issuedBy: {
          select: { id: true, fullName: true, email: true },
        },
        returnedTo: {
          select: { id: true, fullName: true, email: true },
        },
        fines: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with ID "${id}" not found.`,
      );
    }

    return transaction;
  }

  /**
   * Retrieve all overdue transactions.
   *
   * Returns transactions with status 'issued' whose due date has passed.
   */
  async getOverdue() {
    const now = startOfDay(new Date());

    const overdueTransactions = await this.prisma.transaction.findMany({
      where: {
        status: 'issued',
        dueDate: { lt: now },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            memberType: true,
            email: true,
            phone: true,
          },
        },
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            isbn: true,
            price: true,
          },
        },
        issuedBy: {
          select: { id: true, fullName: true },
        },
      },
    });

    // Enrich each transaction with overdue days and estimated fine
    const enrichedTransactions = await Promise.all(
      overdueTransactions.map(async (txn) => {
        const dueDate = new Date(txn.dueDate);
        const overdueDays = differenceInDays(now, startOfDay(dueDate));

        // Get settings for estimated fine calculation
        const settings = await this.prisma.systemSetting.findUnique({
          where: { memberType: txn.member.memberType },
        });

        let estimatedFine = 0;
        if (settings) {
          const effectiveOverdueDays = Math.max(
            0,
            overdueDays - settings.gracePeriodDays,
          );
          estimatedFine = effectiveOverdueDays * Number(settings.finePerDay);

          // Cap at book price + 5 if book has price
          if (txn.book.price) {
            const maxFine = Number(txn.book.price) + 5;
            estimatedFine = Math.min(estimatedFine, maxFine);
          }
        }

        return {
          ...txn,
          overdueDays,
          estimatedFine: Number(estimatedFine.toFixed(2)),
        };
      }),
    );

    return {
      count: enrichedTransactions.length,
      transactions: enrichedTransactions,
    };
  }

  /**
   * Generate receipt data for a given transaction.
   *
   * Returns a structured object with all information needed to print or display a receipt.
   */
  async generateReceipt(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            memberType: true,
            email: true,
            phone: true,
            studentEmployeeId: true,
            department: true,
          },
        },
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            isbn: true,
            callNumber: true,
            shelfLocation: true,
          },
        },
        issuedBy: {
          select: { id: true, fullName: true },
        },
        returnedTo: {
          select: { id: true, fullName: true },
        },
        fines: {
          select: {
            id: true,
            fineType: true,
            amount: true,
            status: true,
            paidAmount: true,
            paymentDate: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(
        `Transaction with ID "${id}" not found.`,
      );
    }

    const totalFines = transaction.fines.reduce(
      (sum, fine) => sum + Number(fine.amount),
      0,
    );
    const totalPaid = transaction.fines.reduce(
      (sum, fine) => sum + Number(fine.paidAmount),
      0,
    );

    return {
      receiptType:
        transaction.status === 'returned' ? 'RETURN_RECEIPT' : 'ISSUE_RECEIPT',
      transactionId: transaction.id,
      status: transaction.status,
      issueDate: transaction.issueDate,
      dueDate: transaction.dueDate,
      returnDate: transaction.returnDate,
      renewalCount: transaction.renewalCount,
      member: {
        id: transaction.member.id,
        name: transaction.member.fullName,
        memberType: transaction.member.memberType,
        email: transaction.member.email,
        phone: transaction.member.phone,
        studentEmployeeId: transaction.member.studentEmployeeId,
        department: transaction.member.department,
      },
      book: {
        id: transaction.book.id,
        title: transaction.book.title,
        author: transaction.book.author,
        isbn: transaction.book.isbn,
        callNumber: transaction.book.callNumber,
        shelfLocation: transaction.book.shelfLocation,
      },
      issuedBy: transaction.issuedBy
        ? {
            id: transaction.issuedBy.id,
            name: transaction.issuedBy.fullName,
          }
        : null,
      returnedTo: transaction.returnedTo
        ? {
            id: transaction.returnedTo.id,
            name: transaction.returnedTo.fullName,
          }
        : null,
      fines: {
        items: transaction.fines,
        totalAmount: Number(totalFines.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        balance: Number((totalFines - totalPaid).toFixed(2)),
      },
      generatedAt: new Date(),
    };
  }
}

/**
 * Mapping of user-facing sort field names to Prisma field names.
 */
const orderByFieldMap: Record<string, string> = {
  issueDate: 'issueDate',
  dueDate: 'dueDate',
  returnDate: 'returnDate',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  status: 'status',
};
