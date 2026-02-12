import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateMemberDto, MemberType, Gender } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberQueryDto } from './dto/member-query.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';

jest.mock('date-fns', () => ({
  addYears: jest.fn((date: Date, years: number) => {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
  }),
}));

const mockPrismaService = {
  member: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  transaction: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  fine: {
    findMany: jest.fn(),
  },
};

describe('MembersService', () => {
  let service: MembersService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<MembersService>(MembersService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- findAll ---------------------------------------------------------------

  describe('findAll', () => {
    const baseQuery: MemberQueryDto = Object.assign(new MemberQueryDto(), {
      page: 1,
      limit: 20,
      sortOrder: 'desc' as const,
    });

    const mockMembers = [
      {
        id: 'member-1',
        fullName: 'John Doe',
        email: 'john@example.com',
        memberType: 'student',
        status: 'active',
        user: { id: 'user-1', username: 'johndoe', role: 'member', status: 'active', lastLogin: null },
      },
      {
        id: 'member-2',
        fullName: 'Jane Smith',
        email: 'jane@example.com',
        memberType: 'faculty',
        status: 'active',
        user: { id: 'user-2', username: 'janesmith', role: 'member', status: 'active', lastLogin: null },
      },
    ];

    it('should return paginated members with defaults', async () => {
      prisma.member.findMany.mockResolvedValue(mockMembers);
      prisma.member.count.mockResolvedValue(2);

      const result = await service.findAll(baseQuery);

      expect(result).toEqual({
        members: mockMembers,
        total: 2,
        page: 1,
        limit: 20,
      });
      expect(prisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(prisma.member.count).toHaveBeenCalledWith({ where: {} });
    });

    it('should apply search filter across fullName, email, and phone', async () => {
      const queryWithSearch: MemberQueryDto = Object.assign(new MemberQueryDto(), {
        ...baseQuery,
        search: 'john',
      });

      prisma.member.findMany.mockResolvedValue([mockMembers[0]]);
      prisma.member.count.mockResolvedValue(1);

      await service.findAll(queryWithSearch);

      expect(prisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { fullName: { contains: 'john', mode: 'insensitive' } },
              { email: { contains: 'john', mode: 'insensitive' } },
              { phone: { contains: 'john', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('should apply memberType filter', async () => {
      const queryWithType: MemberQueryDto = Object.assign(new MemberQueryDto(), {
        ...baseQuery,
        memberType: 'student',
      });

      prisma.member.findMany.mockResolvedValue([mockMembers[0]]);
      prisma.member.count.mockResolvedValue(1);

      await service.findAll(queryWithType);

      expect(prisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            memberType: 'student',
          }),
        }),
      );
    });

    it('should apply status filter', async () => {
      const queryWithStatus: MemberQueryDto = Object.assign(new MemberQueryDto(), {
        ...baseQuery,
        status: 'active',
      });

      prisma.member.findMany.mockResolvedValue(mockMembers);
      prisma.member.count.mockResolvedValue(2);

      await service.findAll(queryWithStatus);

      expect(prisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'active',
          }),
        }),
      );
    });

    it('should apply city filter with case-insensitive contains', async () => {
      const queryWithCity: MemberQueryDto = Object.assign(new MemberQueryDto(), {
        ...baseQuery,
        city: 'Springfield',
      });

      prisma.member.findMany.mockResolvedValue([]);
      prisma.member.count.mockResolvedValue(0);

      await service.findAll(queryWithCity);

      expect(prisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            city: { contains: 'Springfield', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('should apply custom sort field and direction', async () => {
      const queryWithSort: MemberQueryDto = Object.assign(new MemberQueryDto(), {
        ...baseQuery,
        sortBy: 'fullName',
        sortOrder: 'asc' as const,
      });

      prisma.member.findMany.mockResolvedValue(mockMembers);
      prisma.member.count.mockResolvedValue(2);

      await service.findAll(queryWithSort);

      expect(prisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { fullName: 'asc' },
        }),
      );
    });

    it('should default to createdAt sort when sortBy is not in allowed fields', async () => {
      const queryWithBadSort: MemberQueryDto = Object.assign(new MemberQueryDto(), {
        ...baseQuery,
        sortBy: 'invalidField',
      });

      prisma.member.findMany.mockResolvedValue([]);
      prisma.member.count.mockResolvedValue(0);

      await service.findAll(queryWithBadSort);

      expect(prisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should calculate correct skip for page 2', async () => {
      const queryPage2: MemberQueryDto = Object.assign(new MemberQueryDto(), {
        ...baseQuery,
        page: 2,
        limit: 10,
      });

      prisma.member.findMany.mockResolvedValue([]);
      prisma.member.count.mockResolvedValue(15);

      await service.findAll(queryPage2);

      expect(prisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('should combine multiple filters', async () => {
      const combinedQuery: MemberQueryDto = Object.assign(new MemberQueryDto(), {
        ...baseQuery,
        search: 'doe',
        memberType: 'student',
        status: 'active',
        city: 'Springfield',
      });

      prisma.member.findMany.mockResolvedValue([]);
      prisma.member.count.mockResolvedValue(0);

      await service.findAll(combinedQuery);

      expect(prisma.member.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { fullName: { contains: 'doe', mode: 'insensitive' } },
              { email: { contains: 'doe', mode: 'insensitive' } },
              { phone: { contains: 'doe', mode: 'insensitive' } },
            ],
            memberType: 'student',
            status: 'active',
            city: { contains: 'Springfield', mode: 'insensitive' },
          },
        }),
      );
    });
  });

  // --- findOne ---------------------------------------------------------------

  describe('findOne', () => {
    const mockMember = {
      id: 'member-1',
      fullName: 'John Doe',
      email: 'john@example.com',
      memberType: 'student',
      status: 'active',
      user: {
        id: 'user-1',
        username: 'johndoe',
        email: 'john@example.com',
        role: 'member',
        status: 'active',
        lastLogin: null,
        createdAt: new Date('2024-01-01'),
      },
      _count: {
        transactions: 5,
        fines: 1,
        reservations: 2,
      },
    };

    it('should return a member by ID with user and counts', async () => {
      prisma.member.findUnique.mockResolvedValue(mockMember);

      const result = await service.findOne('member-1');

      expect(result).toEqual(mockMember);
      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { id: 'member-1' },
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
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Member with ID "nonexistent" not found',
      );
    });
  });

  // --- findByUserId ----------------------------------------------------------

  describe('findByUserId', () => {
    it('should return a member by userId', async () => {
      const mockMember = {
        id: 'member-1',
        userId: 'user-1',
        fullName: 'John Doe',
        email: 'john@example.com',
      };

      prisma.member.findUnique.mockResolvedValue(mockMember);

      const result = await service.findByUserId('user-1');

      expect(result).toEqual(mockMember);
      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('should return null when no member exists for the userId', async () => {
      prisma.member.findUnique.mockResolvedValue(null);

      const result = await service.findByUserId('nonexistent-user');

      expect(result).toBeNull();
    });
  });

  // --- create ----------------------------------------------------------------

  describe('create', () => {
    const createDto: CreateMemberDto = {
      userId: 'user-1',
      fullName: 'John Doe',
      dateOfBirth: '1995-06-15',
      gender: Gender.male,
      email: 'john@example.com',
      phone: '+1-555-123-4567',
      address: '123 Main Street',
      city: 'Springfield',
      postalCode: '62704',
      memberType: MemberType.student,
      department: 'Computer Science',
      studentEmployeeId: 'STU-2024-001',
    };

    const mockUser = {
      id: 'user-1',
      username: 'johndoe',
      email: 'john@example.com',
      role: 'member',
      status: 'active',
    };

    const mockCreatedMember = {
      id: 'member-1',
      userId: 'user-1',
      fullName: 'John Doe',
      dateOfBirth: new Date('1995-06-15'),
      gender: 'male',
      email: 'john@example.com',
      phone: '+1-555-123-4567',
      address: '123 Main Street',
      city: 'Springfield',
      postalCode: '62704',
      memberType: 'student',
      department: 'Computer Science',
      studentEmployeeId: 'STU-2024-001',
      registrationDate: expect.any(Date),
      expiryDate: expect.any(Date),
      status: 'active',
      booksIssuedCount: 0,
      outstandingFines: 0,
      user: mockUser,
    };

    it('should create a new member linked to an existing user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.member.findUnique.mockResolvedValue(null); // no existing member
      prisma.member.create.mockResolvedValue(mockCreatedMember);

      const result = await service.create(createDto);

      expect(result).toEqual(mockCreatedMember);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(prisma.member.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          fullName: 'John Doe',
          dateOfBirth: new Date('1995-06-15'),
          gender: 'male',
          email: 'john@example.com',
          phone: '+1-555-123-4567',
          address: '123 Main Street',
          city: 'Springfield',
          postalCode: '62704',
          memberType: 'student',
          department: 'Computer Science',
          studentEmployeeId: 'STU-2024-001',
          registrationDate: expect.any(Date),
          expiryDate: expect.any(Date),
          status: 'active',
          booksIssuedCount: 0,
          outstandingFines: 0,
        }),
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
    });

    it('should create a member with optional fields as null when not provided', async () => {
      const minimalDto: CreateMemberDto = {
        userId: 'user-1',
        fullName: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+1-555-987-6543',
        address: '456 Oak Avenue',
        city: 'Chicago',
        memberType: MemberType.public,
      };

      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.member.findUnique.mockResolvedValue(null);
      prisma.member.create.mockResolvedValue({ id: 'member-2' });

      await service.create(minimalDto);

      expect(prisma.member.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dateOfBirth: null,
          gender: null,
          postalCode: null,
          department: null,
          studentEmployeeId: null,
        }),
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'User with ID "user-1" not found. A member must be linked to an existing user account.',
      );
    });

    it('should throw ConflictException when user already has a member profile', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.member.findUnique.mockResolvedValue({
        id: 'existing-member',
        userId: 'user-1',
      });

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'User with ID "user-1" already has a member profile (Member ID: existing-member).',
      );
    });

    it('should set expiryDate to 1 year from registration', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.member.findUnique.mockResolvedValue(null);
      prisma.member.create.mockResolvedValue({ id: 'member-1' });

      await service.create(createDto);

      const createCall = prisma.member.create.mock.calls[0][0];
      const registrationDate = createCall.data.registrationDate as Date;
      const expiryDate = createCall.data.expiryDate as Date;

      expect(expiryDate.getFullYear()).toBe(registrationDate.getFullYear() + 1);
    });
  });

  // --- update ----------------------------------------------------------------

  describe('update', () => {
    const existingMember = {
      id: 'member-1',
      fullName: 'John Doe',
      email: 'john@example.com',
      memberType: 'student',
      status: 'active',
    };

    it('should update member fields successfully', async () => {
      const updateDto: UpdateMemberDto = {
        fullName: 'John Updated Doe',
        email: 'john.updated@example.com',
        city: 'New York',
      };

      const updatedMember = {
        ...existingMember,
        ...updateDto,
        user: { id: 'user-1', username: 'johndoe', email: 'john.updated@example.com', role: 'member', status: 'active' },
      };

      prisma.member.findUnique.mockResolvedValue(existingMember);
      prisma.member.update.mockResolvedValue(updatedMember);

      const result = await service.update('member-1', updateDto);

      expect(result).toEqual(updatedMember);
      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { id: 'member-1' },
      });
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: {
          fullName: 'John Updated Doe',
          email: 'john.updated@example.com',
          city: 'New York',
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
    });

    it('should only include defined fields in updateData', async () => {
      const partialDto: UpdateMemberDto = {
        phone: '+1-555-999-0000',
      };

      prisma.member.findUnique.mockResolvedValue(existingMember);
      prisma.member.update.mockResolvedValue({ ...existingMember, phone: '+1-555-999-0000' });

      await service.update('member-1', partialDto);

      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: {
          phone: '+1-555-999-0000',
        },
        include: expect.any(Object),
      });
    });

    it('should handle dateOfBirth conversion to Date object', async () => {
      const dtoWithDate: UpdateMemberDto = {
        dateOfBirth: '2000-01-15',
      };

      prisma.member.findUnique.mockResolvedValue(existingMember);
      prisma.member.update.mockResolvedValue({ ...existingMember });

      await service.update('member-1', dtoWithDate);

      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: {
          dateOfBirth: new Date('2000-01-15'),
        },
        include: expect.any(Object),
      });
    });

    it('should update all supported fields at once', async () => {
      const fullDto: UpdateMemberDto = {
        fullName: 'Updated Name',
        dateOfBirth: '1990-05-20',
        gender: Gender.female,
        email: 'updated@example.com',
        phone: '+1-555-111-2222',
        address: '789 Elm Street',
        city: 'Boston',
        postalCode: '02101',
        memberType: MemberType.faculty,
        department: 'Physics',
        studentEmployeeId: 'EMP-2024-999',
      };

      prisma.member.findUnique.mockResolvedValue(existingMember);
      prisma.member.update.mockResolvedValue({ ...existingMember, ...fullDto });

      await service.update('member-1', fullDto);

      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: {
          fullName: 'Updated Name',
          dateOfBirth: new Date('1990-05-20'),
          gender: 'female',
          email: 'updated@example.com',
          phone: '+1-555-111-2222',
          address: '789 Elm Street',
          city: 'Boston',
          postalCode: '02101',
          memberType: 'faculty',
          department: 'Physics',
          studentEmployeeId: 'EMP-2024-999',
        },
        include: expect.any(Object),
      });
    });

    it('should send empty updateData when dto has no defined fields', async () => {
      const emptyDto: UpdateMemberDto = {};

      prisma.member.findUnique.mockResolvedValue(existingMember);
      prisma.member.update.mockResolvedValue(existingMember);

      await service.update('member-1', emptyDto);

      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: {},
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { fullName: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update('nonexistent', { fullName: 'New Name' }),
      ).rejects.toThrow('Member with ID "nonexistent" not found');
    });
  });

  // --- deactivate ------------------------------------------------------------

  describe('deactivate', () => {
    it('should set member status to suspended', async () => {
      const activeMember = {
        id: 'member-1',
        fullName: 'John Doe',
        status: 'active',
      };

      const suspendedMember = {
        ...activeMember,
        status: 'suspended',
      };

      prisma.member.findUnique.mockResolvedValue(activeMember);
      prisma.member.update.mockResolvedValue(suspendedMember);

      const result = await service.deactivate('member-1');

      expect(result).toEqual(suspendedMember);
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { status: 'suspended' },
      });
    });

    it('should deactivate an expired member', async () => {
      const expiredMember = {
        id: 'member-1',
        fullName: 'John Doe',
        status: 'expired',
      };

      prisma.member.findUnique.mockResolvedValue(expiredMember);
      prisma.member.update.mockResolvedValue({ ...expiredMember, status: 'suspended' });

      const result = await service.deactivate('member-1');

      expect(result.status).toBe('suspended');
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { status: 'suspended' },
      });
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(service.deactivate('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.deactivate('nonexistent')).rejects.toThrow(
        'Member with ID "nonexistent" not found',
      );
    });

    it('should throw BadRequestException when member is already suspended', async () => {
      const suspendedMember = {
        id: 'member-1',
        fullName: 'John Doe',
        status: 'suspended',
      };

      prisma.member.findUnique.mockResolvedValue(suspendedMember);

      await expect(service.deactivate('member-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.deactivate('member-1')).rejects.toThrow(
        'Member with ID "member-1" is already deactivated (suspended).',
      );
    });
  });

  // --- renewMembership -------------------------------------------------------

  describe('renewMembership', () => {
    const existingMember = {
      id: 'member-1',
      fullName: 'John Doe',
      status: 'expired',
      expiryDate: new Date('2023-01-01'),
    };

    it('should renew membership by extending expiry 1 year and setting status to active', async () => {
      const renewedMember = {
        ...existingMember,
        status: 'active',
        expiryDate: expect.any(Date),
        user: { id: 'user-1', username: 'johndoe', email: 'john@example.com', role: 'member' },
      };

      prisma.member.findUnique.mockResolvedValue(existingMember);
      prisma.member.update.mockResolvedValue(renewedMember);

      const result = await service.renewMembership('member-1');

      expect(result).toEqual(renewedMember);
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: {
          expiryDate: expect.any(Date),
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
    });

    it('should set new expiry date to 1 year from now', async () => {
      prisma.member.findUnique.mockResolvedValue(existingMember);
      prisma.member.update.mockResolvedValue({ ...existingMember, status: 'active' });

      await service.renewMembership('member-1');

      const updateCall = prisma.member.update.mock.calls[0][0];
      const newExpiryDate = updateCall.data.expiryDate as Date;
      const now = new Date();

      // The expiry date should be approximately 1 year from now
      expect(newExpiryDate.getFullYear()).toBe(now.getFullYear() + 1);
    });

    it('should renew an active membership (extend further)', async () => {
      const activeMember = {
        ...existingMember,
        status: 'active',
        expiryDate: new Date('2025-06-01'),
      };

      prisma.member.findUnique.mockResolvedValue(activeMember);
      prisma.member.update.mockResolvedValue({ ...activeMember, status: 'active' });

      const result = await service.renewMembership('member-1');

      expect(result).toBeDefined();
      expect(prisma.member.update).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(service.renewMembership('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.renewMembership('nonexistent')).rejects.toThrow(
        'Member with ID "nonexistent" not found',
      );
    });
  });

  // --- getBorrowingHistory ---------------------------------------------------

  describe('getBorrowingHistory', () => {
    const paginationDto: PaginationDto = Object.assign(new PaginationDto(), {
      page: 1,
      limit: 20,
      sortOrder: 'desc' as const,
    });

    const existingMember = {
      id: 'member-1',
      fullName: 'John Doe',
      status: 'active',
    };

    const mockTransactions = [
      {
        id: 'txn-1',
        memberId: 'member-1',
        issueDate: new Date('2024-01-10'),
        dueDate: new Date('2024-02-10'),
        returnDate: null,
        status: 'issued',
        book: { id: 'book-1', title: 'Clean Code', author: 'Robert C. Martin', isbn: '978-0132350884', coverImageUrl: null },
        issuedBy: { id: 'staff-1', fullName: 'Staff One' },
        returnedTo: null,
      },
      {
        id: 'txn-2',
        memberId: 'member-1',
        issueDate: new Date('2023-11-01'),
        dueDate: new Date('2023-12-01'),
        returnDate: new Date('2023-11-25'),
        status: 'returned',
        book: { id: 'book-2', title: 'The Pragmatic Programmer', author: 'David Thomas', isbn: '978-0135957059', coverImageUrl: null },
        issuedBy: { id: 'staff-1', fullName: 'Staff One' },
        returnedTo: { id: 'staff-2', fullName: 'Staff Two' },
      },
    ];

    it('should return paginated borrowing history', async () => {
      prisma.member.findUnique.mockResolvedValue(existingMember);
      prisma.transaction.findMany.mockResolvedValue(mockTransactions);
      prisma.transaction.count.mockResolvedValue(2);

      const result = await service.getBorrowingHistory('member-1', paginationDto);

      expect(result).toEqual({
        transactions: mockTransactions,
        total: 2,
        page: 1,
        limit: 20,
      });
      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { id: 'member-1' },
      });
      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { memberId: 'member-1' },
          skip: 0,
          take: 20,
          orderBy: { issueDate: 'desc' },
        }),
      );
      expect(prisma.transaction.count).toHaveBeenCalledWith({
        where: { memberId: 'member-1' },
      });
    });

    it('should apply custom sort field and pagination', async () => {
      const customQuery: PaginationDto = Object.assign(new PaginationDto(), {
        page: 2,
        limit: 5,
        sortBy: 'dueDate',
        sortOrder: 'asc' as const,
      });

      prisma.member.findUnique.mockResolvedValue(existingMember);
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.getBorrowingHistory('member-1', customQuery);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
          orderBy: { dueDate: 'asc' },
        }),
      );
    });

    it('should default to issueDate sort when sortBy is not in allowed fields', async () => {
      const badSortQuery: PaginationDto = Object.assign(new PaginationDto(), {
        page: 1,
        limit: 10,
        sortBy: 'invalidField',
        sortOrder: 'desc' as const,
      });

      prisma.member.findUnique.mockResolvedValue(existingMember);
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.transaction.count.mockResolvedValue(0);

      await service.getBorrowingHistory('member-1', badSortQuery);

      expect(prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { issueDate: 'desc' },
        }),
      );
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(
        service.getBorrowingHistory('nonexistent', paginationDto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getBorrowingHistory('nonexistent', paginationDto),
      ).rejects.toThrow('Member with ID "nonexistent" not found');
    });
  });

  // --- getMemberFines --------------------------------------------------------

  describe('getMemberFines', () => {
    const existingMember = {
      id: 'member-1',
      fullName: 'John Doe',
      status: 'active',
    };

    const mockFines = [
      {
        id: 'fine-1',
        memberId: 'member-1',
        amount: 15.5,
        paidAmount: 15.5,
        status: 'paid',
        createdAt: new Date('2024-01-15'),
        transaction: {
          id: 'txn-1',
          issueDate: new Date('2024-01-01'),
          dueDate: new Date('2024-01-14'),
          returnDate: new Date('2024-01-20'),
          status: 'returned',
          book: { id: 'book-1', title: 'Clean Code', author: 'Robert C. Martin', isbn: '978-0132350884' },
        },
      },
      {
        id: 'fine-2',
        memberId: 'member-1',
        amount: 10.0,
        paidAmount: 0,
        status: 'pending',
        createdAt: new Date('2024-02-10'),
        transaction: {
          id: 'txn-2',
          issueDate: new Date('2024-02-01'),
          dueDate: new Date('2024-02-08'),
          returnDate: new Date('2024-02-15'),
          status: 'returned',
          book: { id: 'book-2', title: 'Design Patterns', author: 'Gang of Four', isbn: '978-0201633610' },
        },
      },
      {
        id: 'fine-3',
        memberId: 'member-1',
        amount: 5.0,
        paidAmount: 5.0,
        status: 'waived',
        createdAt: new Date('2024-03-01'),
        transaction: {
          id: 'txn-3',
          issueDate: new Date('2024-02-20'),
          dueDate: new Date('2024-03-01'),
          returnDate: null,
          status: 'overdue',
          book: { id: 'book-3', title: 'Refactoring', author: 'Martin Fowler', isbn: '978-0134757599' },
        },
      },
    ];

    it('should return fines with correct summary', async () => {
      prisma.member.findUnique.mockResolvedValue(existingMember);
      prisma.fine.findMany.mockResolvedValue(mockFines);

      const result = await service.getMemberFines('member-1');

      expect(result.fines).toEqual(mockFines);
      expect(result.summary).toEqual({
        totalFines: 30.5,
        totalPaid: 20.5,
        totalOutstanding: 10,
        fineCount: 3,
        pendingCount: 1,
        paidCount: 1,
        waivedCount: 1,
      });
    });

    it('should return empty fines with zero summary for member with no fines', async () => {
      prisma.member.findUnique.mockResolvedValue(existingMember);
      prisma.fine.findMany.mockResolvedValue([]);

      const result = await service.getMemberFines('member-1');

      expect(result.fines).toEqual([]);
      expect(result.summary).toEqual({
        totalFines: 0,
        totalPaid: 0,
        totalOutstanding: 0,
        fineCount: 0,
        pendingCount: 0,
        paidCount: 0,
        waivedCount: 0,
      });
    });

    it('should order fines by createdAt descending', async () => {
      prisma.member.findUnique.mockResolvedValue(existingMember);
      prisma.fine.findMany.mockResolvedValue(mockFines);

      await service.getMemberFines('member-1');

      expect(prisma.fine.findMany).toHaveBeenCalledWith({
        where: { memberId: 'member-1' },
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
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(service.getMemberFines('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getMemberFines('nonexistent')).rejects.toThrow(
        'Member with ID "nonexistent" not found',
      );
    });

    it('should calculate summary correctly with decimal amounts', async () => {
      const decimalFines = [
        { id: 'f1', amount: 3.33, paidAmount: 1.11, status: 'pending' },
        { id: 'f2', amount: 6.67, paidAmount: 6.67, status: 'paid' },
      ];

      prisma.member.findUnique.mockResolvedValue(existingMember);
      prisma.fine.findMany.mockResolvedValue(decimalFines);

      const result = await service.getMemberFines('member-1');

      expect(result.summary.totalFines).toBe(10);
      expect(result.summary.totalPaid).toBe(7.78);
      expect(result.summary.totalOutstanding).toBe(2.22);
    });
  });

  // --- generateIdCard --------------------------------------------------------

  describe('generateIdCard', () => {
    const mockMember = {
      id: 'member-1',
      fullName: 'John Doe',
      memberType: 'student',
      department: 'Computer Science',
      studentEmployeeId: 'STU-2024-001',
      email: 'john@example.com',
      phone: '+1-555-123-4567',
      photoUrl: 'https://example.com/photo.jpg',
      registrationDate: new Date('2024-01-01'),
      expiryDate: new Date('2025-01-01'),
      status: 'active',
      user: { id: 'user-1', username: 'johndoe' },
    };

    it('should generate ID card data for an existing member', async () => {
      prisma.member.findUnique.mockResolvedValue(mockMember);

      const result = await service.generateIdCard('member-1');

      expect(result.cardData).toEqual({
        memberId: 'member-1',
        fullName: 'John Doe',
        memberType: 'student',
        department: 'Computer Science',
        studentEmployeeId: 'STU-2024-001',
        email: 'john@example.com',
        phone: '+1-555-123-4567',
        photoUrl: 'https://example.com/photo.jpg',
        registrationDate: new Date('2024-01-01'),
        expiryDate: new Date('2025-01-01'),
        status: 'active',
        barcode: 'member-1',
      });
      expect(result.generatedAt).toBeDefined();
      expect(typeof result.generatedAt).toBe('string');
    });

    it('should include user relation in the query', async () => {
      prisma.member.findUnique.mockResolvedValue(mockMember);

      await service.generateIdCard('member-1');

      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });
    });

    it('should handle member with null optional fields', async () => {
      const memberWithNulls = {
        ...mockMember,
        department: null,
        studentEmployeeId: null,
        photoUrl: null,
      };

      prisma.member.findUnique.mockResolvedValue(memberWithNulls);

      const result = await service.generateIdCard('member-1');

      expect(result.cardData.department).toBeNull();
      expect(result.cardData.studentEmployeeId).toBeNull();
      expect(result.cardData.photoUrl).toBeNull();
    });

    it('should use member ID as barcode', async () => {
      prisma.member.findUnique.mockResolvedValue(mockMember);

      const result = await service.generateIdCard('member-1');

      expect(result.cardData.barcode).toBe('member-1');
    });

    it('should return generatedAt as an ISO string', async () => {
      prisma.member.findUnique.mockResolvedValue(mockMember);

      const result = await service.generateIdCard('member-1');

      // Verify it is a valid ISO 8601 date string
      expect(new Date(result.generatedAt).toISOString()).toBe(result.generatedAt);
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(service.generateIdCard('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.generateIdCard('nonexistent')).rejects.toThrow(
        'Member with ID "nonexistent" not found',
      );
    });
  });

  // --- updatePhoto -----------------------------------------------------------

  describe('updatePhoto', () => {
    const existingMember = {
      id: 'member-1',
      fullName: 'John Doe',
      photoUrl: null,
    };

    it('should update the photo URL for a member', async () => {
      const newPhotoUrl = 'https://storage.example.com/photos/member-1.jpg';
      const updatedMember = {
        ...existingMember,
        photoUrl: newPhotoUrl,
      };

      prisma.member.findUnique.mockResolvedValue(existingMember);
      prisma.member.update.mockResolvedValue(updatedMember);

      const result = await service.updatePhoto('member-1', newPhotoUrl);

      expect(result).toEqual(updatedMember);
      expect(prisma.member.findUnique).toHaveBeenCalledWith({
        where: { id: 'member-1' },
      });
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { photoUrl: newPhotoUrl },
      });
    });

    it('should replace an existing photo URL', async () => {
      const memberWithPhoto = {
        ...existingMember,
        photoUrl: 'https://storage.example.com/photos/old.jpg',
      };
      const newPhotoUrl = 'https://storage.example.com/photos/new.jpg';

      prisma.member.findUnique.mockResolvedValue(memberWithPhoto);
      prisma.member.update.mockResolvedValue({ ...memberWithPhoto, photoUrl: newPhotoUrl });

      const result = await service.updatePhoto('member-1', newPhotoUrl);

      expect(result.photoUrl).toBe(newPhotoUrl);
      expect(prisma.member.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { photoUrl: newPhotoUrl },
      });
    });

    it('should throw NotFoundException when member does not exist', async () => {
      prisma.member.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePhoto('nonexistent', 'https://example.com/photo.jpg'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updatePhoto('nonexistent', 'https://example.com/photo.jpg'),
      ).rejects.toThrow('Member with ID "nonexistent" not found');
    });
  });
});
