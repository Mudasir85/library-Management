import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  isBefore,
} from 'date-fns';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get comprehensive dashboard statistics for the library.
   */
  async getDashboardStats() {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const monthStart = startOfMonth(now);

    const [
      totalBooks,
      availableBooksResult,
      totalMembers,
      activeMembers,
      overdueBooks,
      totalFinesOutstandingResult,
      todayIssues,
      todayReturns,
      newMembersThisMonth,
      popularCategories,
      recentActivities,
    ] = await Promise.all([
      // Total books (not deleted)
      this.prisma.book.count({
        where: { isDeleted: false },
      }),

      // Sum of available copies
      this.prisma.book.aggregate({
        where: { isDeleted: false },
        _sum: { availableCopies: true },
      }),

      // Total members
      this.prisma.member.count(),

      // Active members
      this.prisma.member.count({
        where: { status: 'active' },
      }),

      // Overdue books (issued transactions past due date)
      this.prisma.transaction.count({
        where: {
          status: 'issued',
          dueDate: { lt: now },
        },
      }),

      // Total outstanding fines
      this.prisma.fine.aggregate({
        where: { status: 'pending' },
        _sum: { amount: true },
      }),

      // Today's issues
      this.prisma.transaction.count({
        where: {
          issueDate: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),

      // Today's returns
      this.prisma.transaction.count({
        where: {
          returnDate: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),

      // New members this month
      this.prisma.member.count({
        where: {
          createdAt: { gte: monthStart },
        },
      }),

      // Popular categories (top 5)
      this.prisma.book.groupBy({
        by: ['category'],
        where: { isDeleted: false },
        _count: { _all: true },
        orderBy: { _count: { category: 'desc' } },
        take: 5,
      }),

      // Recent activities (last 10 transactions)
      this.prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
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
      }),
    ]);

    const availableBooks = availableBooksResult._sum.availableCopies || 0;
    const totalBooksSum = await this.prisma.book.aggregate({
      where: { isDeleted: false },
      _sum: { totalCopies: true },
    });
    const totalCopies = totalBooksSum._sum.totalCopies || 0;
    const issuedBooks = totalCopies - availableBooks;

    return {
      totalBooks,
      totalCopies,
      availableBooks,
      issuedBooks,
      totalMembers,
      activeMembers,
      overdueBooks,
      totalFinesOutstanding: Number(totalFinesOutstandingResult._sum.amount || 0),
      todayIssues,
      todayReturns,
      newMembersThisMonth,
      popularCategories: popularCategories.map((cat) => ({
        category: cat.category,
        count: cat._count._all,
      })),
      recentActivities,
    };
  }

  /**
   * Get the most popular books ranked by borrow count.
   */
  async getPopularBooks(limit: number = 10) {
    const popularBookIds = await this.prisma.transaction.groupBy({
      by: ['bookId'],
      _count: { bookId: true },
      orderBy: { _count: { bookId: 'desc' } },
      take: limit,
    });

    if (popularBookIds.length === 0) {
      return { books: [] };
    }

    const bookIds = popularBookIds.map((entry) => entry.bookId);
    const borrowCounts = new Map(
      popularBookIds.map((entry) => [entry.bookId, entry._count.bookId]),
    );

    const books = await this.prisma.book.findMany({
      where: {
        id: { in: bookIds },
        isDeleted: false,
      },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    const result = books
      .map((book) => ({
        ...book,
        borrowCount: borrowCounts.get(book.id) || 0,
      }))
      .sort((a, b) => b.borrowCount - a.borrowCount);

    return { books: result };
  }

  /**
   * Get inventory status: books grouped by condition, category counts, and low-stock books.
   */
  async getInventoryStatus() {
    const [
      byCondition,
      byCategory,
      lowStockBooks,
      totalBooksCount,
      totalCopiesAgg,
      availableCopiesAgg,
    ] = await Promise.all([
      // Books grouped by condition
      this.prisma.book.groupBy({
        by: ['condition'],
        where: { isDeleted: false },
        _count: { _all: true },
        _sum: { totalCopies: true, availableCopies: true },
      }),

      // Books grouped by category
      this.prisma.book.groupBy({
        by: ['category'],
        where: { isDeleted: false },
        _count: { _all: true },
        _sum: { totalCopies: true, availableCopies: true },
        orderBy: { _count: { category: 'desc' } },
      }),

      // Low-stock books (available copies <= 1 and total copies > 0)
      this.prisma.book.findMany({
        where: {
          isDeleted: false,
          availableCopies: { lte: 1 },
          totalCopies: { gt: 0 },
        },
        select: {
          id: true,
          title: true,
          author: true,
          isbn: true,
          category: true,
          totalCopies: true,
          availableCopies: true,
          condition: true,
        },
        orderBy: { availableCopies: 'asc' },
        take: 50,
      }),

      // Total unique book titles
      this.prisma.book.count({ where: { isDeleted: false } }),

      // Total copies aggregate
      this.prisma.book.aggregate({
        where: { isDeleted: false },
        _sum: { totalCopies: true },
      }),

      // Available copies aggregate
      this.prisma.book.aggregate({
        where: { isDeleted: false },
        _sum: { availableCopies: true },
      }),
    ]);

    return {
      summary: {
        totalBooks: totalBooksCount,
        totalCopies: totalCopiesAgg._sum.totalCopies || 0,
        availableCopies: availableCopiesAgg._sum.availableCopies || 0,
        issuedCopies:
          (totalCopiesAgg._sum.totalCopies || 0) -
          (availableCopiesAgg._sum.availableCopies || 0),
      },
      byCondition: byCondition.map((item) => ({
        condition: item.condition,
        bookCount: item._count._all,
        totalCopies: item._sum.totalCopies || 0,
        availableCopies: item._sum.availableCopies || 0,
      })),
      byCategory: byCategory.map((item) => ({
        category: item.category,
        bookCount: item._count._all,
        totalCopies: item._sum.totalCopies || 0,
        availableCopies: item._sum.availableCopies || 0,
      })),
      lowStockBooks,
    };
  }

  /**
   * Get a list of all overdue transactions with member and book details.
   */
  async getOverdueReport() {
    const now = new Date();

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

    const result = overdueTransactions.map((transaction) => {
      const dueDate = new Date(transaction.dueDate);
      const daysOverdue = Math.floor(
        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        ...transaction,
        daysOverdue,
      };
    });

    return {
      overdueCount: result.length,
      transactions: result,
    };
  }

  /**
   * Get member statistics: members by type, active/inactive counts, top borrowers.
   */
  async getMemberStats() {
    const [
      byType,
      byStatus,
      totalMembers,
      topBorrowers,
      membersWithFines,
    ] = await Promise.all([
      // Members grouped by type
      this.prisma.member.groupBy({
        by: ['memberType'],
        _count: { _all: true },
      }),

      // Members grouped by status
      this.prisma.member.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),

      // Total members
      this.prisma.member.count(),

      // Top 10 borrowers (by transaction count)
      this.prisma.member.findMany({
        orderBy: { booksIssuedCount: 'desc' },
        take: 10,
        select: {
          id: true,
          fullName: true,
          email: true,
          memberType: true,
          booksIssuedCount: true,
          status: true,
          _count: {
            select: { transactions: true },
          },
        },
      }),

      // Members with outstanding fines
      this.prisma.member.count({
        where: {
          outstandingFines: { gt: 0 },
        },
      }),
    ]);

    return {
      totalMembers,
      membersWithFines,
      byType: byType.map((item) => ({
        memberType: item.memberType,
        count: item._count._all,
      })),
      byStatus: byStatus.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
      topBorrowers: topBorrowers.map((member) => ({
        id: member.id,
        fullName: member.fullName,
        email: member.email,
        memberType: member.memberType,
        booksIssuedCount: member.booksIssuedCount,
        totalTransactions: member._count.transactions,
        status: member.status,
      })),
    };
  }

  /**
   * Get transaction report for a given date range with summary statistics.
   */
  async getTransactionReport(fromDate?: string, toDate?: string) {
    const where: Prisma.TransactionWhereInput = {};

    if (fromDate || toDate) {
      where.issueDate = {};
      if (fromDate) {
        where.issueDate.gte = new Date(fromDate);
      }
      if (toDate) {
        where.issueDate.lte = endOfDay(new Date(toDate));
      }
    }

    const [transactions, totalCount, statusCounts] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { issueDate: 'desc' },
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
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
          returnedTo: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      }),

      this.prisma.transaction.count({ where }),

      this.prisma.transaction.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
    ]);

    const summary = {
      totalTransactions: totalCount,
      byStatus: statusCounts.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
    };

    return {
      summary,
      transactions,
    };
  }

  /**
   * Get financial report for fines in a given date range.
   */
  async getFinancialReport(fromDate?: string, toDate?: string) {
    const where: Prisma.FineWhereInput = {};

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.createdAt.lte = endOfDay(new Date(toDate));
      }
    }

    const [
      fines,
      totalFinesAgg,
      paidFinesAgg,
      waivedFinesAgg,
      pendingFinesAgg,
      byType,
      byStatus,
    ] = await Promise.all([
      // All fines in range
      this.prisma.fine.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          member: {
            select: {
              id: true,
              fullName: true,
              memberType: true,
            },
          },
          transaction: {
            select: {
              id: true,
              issueDate: true,
              dueDate: true,
              returnDate: true,
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
      }),

      // Total fines amount
      this.prisma.fine.aggregate({
        where,
        _sum: { amount: true },
      }),

      // Paid fines amount
      this.prisma.fine.aggregate({
        where: { ...where, status: 'paid' },
        _sum: { amount: true, paidAmount: true },
      }),

      // Waived fines amount
      this.prisma.fine.aggregate({
        where: { ...where, status: 'waived' },
        _sum: { amount: true },
      }),

      // Pending fines amount
      this.prisma.fine.aggregate({
        where: { ...where, status: 'pending' },
        _sum: { amount: true },
      }),

      // Fines by type
      this.prisma.fine.groupBy({
        by: ['fineType'],
        where,
        _count: { _all: true },
        _sum: { amount: true, paidAmount: true },
      }),

      // Fines by status
      this.prisma.fine.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    return {
      summary: {
        totalFinesAmount: Number(totalFinesAgg._sum.amount || 0),
        collectedAmount: Number(paidFinesAgg._sum.paidAmount || 0),
        waivedAmount: Number(waivedFinesAgg._sum.amount || 0),
        outstandingAmount: Number(pendingFinesAgg._sum.amount || 0),
        totalFineCount: fines.length,
      },
      byType: byType.map((item) => ({
        fineType: item.fineType,
        count: item._count._all,
        totalAmount: Number(item._sum.amount || 0),
        paidAmount: Number(item._sum.paidAmount || 0),
      })),
      byStatus: byStatus.map((item) => ({
        status: item.status,
        count: item._count._all,
        totalAmount: Number(item._sum.amount || 0),
      })),
      fines,
    };
  }

  /**
   * Generate a CSV string for a given report type.
   */
  async exportToCsv(
    reportType: string,
    params?: Record<string, any>,
  ): Promise<string> {
    switch (reportType) {
      case 'popular-books':
        return this.exportPopularBooksCsv(params?.limit);
      case 'inventory':
        return this.exportInventoryCsv();
      case 'overdue':
        return this.exportOverdueCsv();
      case 'member-stats':
        return this.exportMemberStatsCsv();
      case 'transactions':
        return this.exportTransactionsCsv(params?.fromDate, params?.toDate);
      case 'financial':
        return this.exportFinancialCsv(params?.fromDate, params?.toDate);
      default:
        return 'Error: Unknown report type';
    }
  }

  private async exportPopularBooksCsv(limit?: number): Promise<string> {
    const report = await this.getPopularBooks(limit || 50);
    const header = 'Title,Author,ISBN,Category,Total Copies,Available Copies,Borrow Count';
    const rows = report.books.map((book) =>
      [
        this.escapeCsvField(book.title),
        this.escapeCsvField(book.author),
        this.escapeCsvField(book.isbn),
        this.escapeCsvField(book.category),
        book.totalCopies,
        book.availableCopies,
        book.borrowCount,
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  private async exportInventoryCsv(): Promise<string> {
    const books = await this.prisma.book.findMany({
      where: { isDeleted: false },
      orderBy: { title: 'asc' },
      select: {
        title: true,
        author: true,
        isbn: true,
        category: true,
        language: true,
        condition: true,
        totalCopies: true,
        availableCopies: true,
        shelfLocation: true,
        callNumber: true,
      },
    });

    const header =
      'Title,Author,ISBN,Category,Language,Condition,Total Copies,Available Copies,Shelf Location,Call Number';
    const rows = books.map((book) =>
      [
        this.escapeCsvField(book.title),
        this.escapeCsvField(book.author),
        this.escapeCsvField(book.isbn),
        this.escapeCsvField(book.category),
        this.escapeCsvField(book.language),
        book.condition,
        book.totalCopies,
        book.availableCopies,
        this.escapeCsvField(book.shelfLocation),
        this.escapeCsvField(book.callNumber),
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  private async exportOverdueCsv(): Promise<string> {
    const report = await this.getOverdueReport();
    const header =
      'Transaction ID,Member Name,Member Email,Member Phone,Book Title,Book Author,ISBN,Issue Date,Due Date,Days Overdue';
    const rows = report.transactions.map((tx) =>
      [
        tx.id,
        this.escapeCsvField(tx.member.fullName),
        this.escapeCsvField(tx.member.email),
        this.escapeCsvField(tx.member.phone),
        this.escapeCsvField(tx.book.title),
        this.escapeCsvField(tx.book.author),
        this.escapeCsvField(tx.book.isbn),
        new Date(tx.issueDate).toISOString().split('T')[0],
        new Date(tx.dueDate).toISOString().split('T')[0],
        tx.daysOverdue,
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  private async exportMemberStatsCsv(): Promise<string> {
    const members = await this.prisma.member.findMany({
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        memberType: true,
        status: true,
        booksIssuedCount: true,
        outstandingFines: true,
        registrationDate: true,
        expiryDate: true,
      },
    });

    const header =
      'Member ID,Full Name,Email,Member Type,Status,Books Issued,Outstanding Fines,Registration Date,Expiry Date';
    const rows = members.map((m) =>
      [
        m.id,
        this.escapeCsvField(m.fullName),
        this.escapeCsvField(m.email),
        m.memberType,
        m.status,
        m.booksIssuedCount,
        Number(m.outstandingFines),
        new Date(m.registrationDate).toISOString().split('T')[0],
        new Date(m.expiryDate).toISOString().split('T')[0],
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  private async exportTransactionsCsv(
    fromDate?: string,
    toDate?: string,
  ): Promise<string> {
    const report = await this.getTransactionReport(fromDate, toDate);
    const header =
      'Transaction ID,Member Name,Member Type,Book Title,Author,ISBN,Issue Date,Due Date,Return Date,Status,Fine Amount,Renewal Count';
    const rows = report.transactions.map((tx) =>
      [
        tx.id,
        this.escapeCsvField(tx.member.fullName),
        tx.member.memberType,
        this.escapeCsvField(tx.book.title),
        this.escapeCsvField(tx.book.author),
        this.escapeCsvField(tx.book.isbn),
        new Date(tx.issueDate).toISOString().split('T')[0],
        new Date(tx.dueDate).toISOString().split('T')[0],
        tx.returnDate
          ? new Date(tx.returnDate).toISOString().split('T')[0]
          : '',
        tx.status,
        Number(tx.fineAmount),
        tx.renewalCount,
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  private async exportFinancialCsv(
    fromDate?: string,
    toDate?: string,
  ): Promise<string> {
    const report = await this.getFinancialReport(fromDate, toDate);
    const header =
      'Fine ID,Member Name,Member Type,Fine Type,Amount,Paid Amount,Status,Book Title,Issue Date,Due Date,Created At';
    const rows = report.fines.map((fine) =>
      [
        fine.id,
        this.escapeCsvField(fine.member.fullName),
        fine.member.memberType,
        fine.fineType,
        Number(fine.amount),
        Number(fine.paidAmount),
        fine.status,
        fine.transaction
          ? this.escapeCsvField(fine.transaction.book.title)
          : '',
        fine.transaction
          ? new Date(fine.transaction.issueDate).toISOString().split('T')[0]
          : '',
        fine.transaction
          ? new Date(fine.transaction.dueDate).toISOString().split('T')[0]
          : '',
        new Date(fine.createdAt).toISOString().split('T')[0],
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  /**
   * Escape a field value for CSV output. Wraps in quotes if needed.
   */
  private escapeCsvField(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);

    // If the value contains commas, quotes, or newlines, wrap it in quotes
    if (
      stringValue.includes(',') ||
      stringValue.includes('"') ||
      stringValue.includes('\n')
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }
}
