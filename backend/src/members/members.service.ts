import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { addYears } from 'date-fns';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberQueryDto } from './dto/member-query.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieve a paginated, searchable, filterable list of members.
   */
  async findAll(query: MemberQueryDto) {
    const {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      memberType,
      status,
      city,
    } = query;

    const where: Prisma.MemberWhereInput = {};

    // Full-text search across fullName, email, and phone
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Apply filters
    if (memberType) {
      where.memberType = memberType;
    }

    if (status) {
      where.status = status;
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }

    // Determine sort configuration
    const allowedSortFields = [
      'fullName',
      'email',
      'memberType',
      'status',
      'registrationDate',
      'expiryDate',
      'booksIssuedCount',
      'outstandingFines',
      'createdAt',
    ];

    const orderByField =
      sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderByDirection = sortOrder || 'desc';
    const orderBy: Prisma.MemberOrderByWithRelationInput = {
      [orderByField]: orderByDirection,
    };

    const skip = (page - 1) * limit;

    const [members, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              role: true,
              status: true,
              lastLogin: true,
            },
          },
        },
      }),
      this.prisma.member.count({ where }),
    ]);

    return { members, total, page, limit };
  }

  /**
   * Retrieve a single member by ID, including user relation and transaction count.
   */
  async findOne(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            status: true,
            lastLogin: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            transactions: true,
            fines: true,
            reservations: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID "${id}" not found`);
    }

    return member;
  }

  /**
   * Find a member by their linked userId.
   */
  async findByUserId(userId: string) {
    const member = await this.prisma.member.findUnique({
      where: { userId },
    });

    return member;
  }

  /**
   * Create a new member linked to an existing user account.
   */
  async create(dto: CreateMemberDto) {
    // Verify the user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException(
        `User with ID "${dto.userId}" not found. A member must be linked to an existing user account.`,
      );
    }

    // Check if this user already has a member profile
    const existingMember = await this.prisma.member.findUnique({
      where: { userId: dto.userId },
    });

    if (existingMember) {
      throw new ConflictException(
        `User with ID "${dto.userId}" already has a member profile (Member ID: ${existingMember.id}).`,
      );
    }

    const registrationDate = new Date();
    const expiryDate = addYears(registrationDate, 1);

    const member = await this.prisma.member.create({
      data: {
        userId: dto.userId,
        fullName: dto.fullName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        gender: dto.gender ?? null,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        city: dto.city,
        postalCode: dto.postalCode ?? null,
        memberType: dto.memberType,
        department: dto.department ?? null,
        studentEmployeeId: dto.studentEmployeeId ?? null,
        registrationDate,
        expiryDate,
        status: 'active',
        booksIssuedCount: 0,
        outstandingFines: 0,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });

    return member;
  }

  /**
   * Update an existing member's profile information.
   */
  async update(id: string, dto: UpdateMemberDto) {
    // Ensure member exists
    const existing = await this.prisma.member.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Member with ID "${id}" not found`);
    }

    const updateData: Prisma.MemberUpdateInput = {};

    if (dto.fullName !== undefined) {
      updateData.fullName = dto.fullName;
    }

    if (dto.dateOfBirth !== undefined) {
      updateData.dateOfBirth = new Date(dto.dateOfBirth);
    }

    if (dto.gender !== undefined) {
      updateData.gender = dto.gender;
    }

    if (dto.email !== undefined) {
      updateData.email = dto.email;
    }

    if (dto.phone !== undefined) {
      updateData.phone = dto.phone;
    }

    if (dto.address !== undefined) {
      updateData.address = dto.address;
    }

    if (dto.city !== undefined) {
      updateData.city = dto.city;
    }

    if (dto.postalCode !== undefined) {
      updateData.postalCode = dto.postalCode;
    }

    if (dto.memberType !== undefined) {
      updateData.memberType = dto.memberType;
    }

    if (dto.department !== undefined) {
      updateData.department = dto.department;
    }

    if (dto.studentEmployeeId !== undefined) {
      updateData.studentEmployeeId = dto.studentEmployeeId;
    }

    const member = await this.prisma.member.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });

    return member;
  }

  /**
   * Soft-delete a member by setting their status to 'suspended'.
   * Note: The Prisma schema defines MemberStatus as active/suspended/expired.
   * Deactivation maps to 'suspended' as there is no 'inactive' status in the enum.
   */
  async deactivate(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID "${id}" not found`);
    }

    if (member.status === 'suspended') {
      throw new BadRequestException(
        `Member with ID "${id}" is already deactivated (suspended).`,
      );
    }

    const updated = await this.prisma.member.update({
      where: { id },
      data: { status: 'suspended' },
    });

    return updated;
  }

  /**
   * Renew a member's membership by extending the expiry date 1 year from now
   * and setting the status back to 'active'.
   */
  async renewMembership(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID "${id}" not found`);
    }

    const newExpiryDate = addYears(new Date(), 1);

    const renewed = await this.prisma.member.update({
      where: { id },
      data: {
        expiryDate: newExpiryDate,
        status: 'active',
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return renewed;
  }

  /**
   * Get the borrowing (transaction) history for a specific member with pagination.
   */
  async getBorrowingHistory(id: string, query: PaginationDto) {
    const member = await this.prisma.member.findUnique({
      where: { id },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID "${id}" not found`);
    }

    const { page, limit, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const allowedSortFields = [
      'issueDate',
      'dueDate',
      'returnDate',
      'status',
      'createdAt',
    ];

    const orderByField =
      sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'issueDate';
    const orderByDirection = sortOrder || 'desc';
    const orderBy: Prisma.TransactionOrderByWithRelationInput = {
      [orderByField]: orderByDirection,
    };

    const where: Prisma.TransactionWhereInput = { memberId: id };

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              isbn: true,
              coverImageUrl: true,
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
    ]);

    return { transactions, total, page, limit };
  }

  /**
   * Get all fines for a specific member, including related transaction details.
   */
  async getMemberFines(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID "${id}" not found`);
    }

    const fines = await this.prisma.fine.findMany({
      where: { memberId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        transaction: {
          select: {
            id: true,
            issueDate: true,
            dueDate: true,
            returnDate: true,
            status: true,
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
    });

    const totalFines = fines.reduce(
      (sum, fine) => sum + Number(fine.amount),
      0,
    );
    const totalPaid = fines.reduce(
      (sum, fine) => sum + Number(fine.paidAmount),
      0,
    );
    const totalOutstanding = totalFines - totalPaid;

    return {
      fines,
      summary: {
        totalFines: Number(totalFines.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        totalOutstanding: Number(totalOutstanding.toFixed(2)),
        fineCount: fines.length,
        pendingCount: fines.filter((f) => f.status === 'pending').length,
        paidCount: fines.filter((f) => f.status === 'paid').length,
        waivedCount: fines.filter((f) => f.status === 'waived').length,
      },
    };
  }

  /**
   * Generate data formatted for member ID card generation.
   */
  async generateIdCard(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID "${id}" not found`);
    }

    return {
      cardData: {
        memberId: member.id,
        fullName: member.fullName,
        memberType: member.memberType,
        department: member.department,
        studentEmployeeId: member.studentEmployeeId,
        email: member.email,
        phone: member.phone,
        photoUrl: member.photoUrl,
        registrationDate: member.registrationDate,
        expiryDate: member.expiryDate,
        status: member.status,
        barcode: member.id,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Update the photo URL for a member after a file upload.
   */
  async updatePhoto(id: string, photoUrl: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
    });

    if (!member) {
      throw new NotFoundException(`Member with ID "${id}" not found`);
    }

    const updated = await this.prisma.member.update({
      where: { id },
      data: { photoUrl },
    });

    return updated;
  }
}
