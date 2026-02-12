import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const mockPrismaService = {
  systemSetting: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findAll ────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return all system settings', async () => {
      const mockSettings = [
        {
          id: 'setting-1',
          memberType: 'faculty',
          maxBooksAllowed: 10,
          loanDurationDays: 30,
          renewalLimit: 3,
          finePerDay: 0.5,
          gracePeriodDays: 2,
        },
        {
          id: 'setting-2',
          memberType: 'public',
          maxBooksAllowed: 5,
          loanDurationDays: 14,
          renewalLimit: 2,
          finePerDay: 1.0,
          gracePeriodDays: 0,
        },
        {
          id: 'setting-3',
          memberType: 'student',
          maxBooksAllowed: 7,
          loanDurationDays: 21,
          renewalLimit: 2,
          finePerDay: 0.75,
          gracePeriodDays: 1,
        },
      ];

      prisma.systemSetting.findMany.mockResolvedValue(mockSettings);

      const result = await service.findAll();

      expect(result).toEqual(mockSettings);
      expect(result).toHaveLength(3);
      expect(prisma.systemSetting.findMany).toHaveBeenCalledWith({
        orderBy: { memberType: 'asc' },
      });
    });

    it('should return empty array when no settings exist', async () => {
      prisma.systemSetting.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ─── findByMemberType ──────────────────────────────────────────────

  describe('findByMemberType', () => {
    it('should return settings for a valid member type', async () => {
      const mockSetting = {
        id: 'setting-1',
        memberType: 'student',
        maxBooksAllowed: 7,
        loanDurationDays: 21,
        renewalLimit: 2,
        finePerDay: 0.75,
        gracePeriodDays: 1,
      };

      prisma.systemSetting.findUnique.mockResolvedValue(mockSetting);

      const result = await service.findByMemberType('student');

      expect(result).toEqual(mockSetting);
      expect(prisma.systemSetting.findUnique).toHaveBeenCalledWith({
        where: { memberType: 'student' },
      });
    });

    it('should throw BadRequestException for invalid member type', async () => {
      await expect(
        service.findByMemberType('invalid_type'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.findByMemberType('invalid_type'),
      ).rejects.toThrow(
        'Invalid member type "invalid_type". Valid types are: student, faculty, public',
      );
    });

    it('should throw NotFoundException when settings not found for member type', async () => {
      prisma.systemSetting.findUnique.mockResolvedValue(null);

      await expect(
        service.findByMemberType('faculty'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findByMemberType('faculty'),
      ).rejects.toThrow(
        'Settings for member type "faculty" not found. You may need to create default settings first.',
      );
    });

    it('should accept all valid member types', async () => {
      const validTypes = ['student', 'faculty', 'public'];

      for (const memberType of validTypes) {
        prisma.systemSetting.findUnique.mockResolvedValue({
          id: `setting-${memberType}`,
          memberType,
          maxBooksAllowed: 5,
          loanDurationDays: 14,
          renewalLimit: 2,
          finePerDay: 1.0,
          gracePeriodDays: 0,
        });

        const result = await service.findByMemberType(memberType);

        expect(result.memberType).toBe(memberType);
      }
    });
  });

  // ─── update ─────────────────────────────────────────────────────────

  describe('update', () => {
    const fullDto: UpdateSettingsDto = {
      maxBooksAllowed: 10,
      loanDurationDays: 30,
      renewalLimit: 3,
      finePerDay: 1.5,
      gracePeriodDays: 2,
    };

    it('should update existing settings with partial data', async () => {
      const existingSetting = {
        id: 'setting-1',
        memberType: 'student',
        maxBooksAllowed: 5,
        loanDurationDays: 14,
        renewalLimit: 2,
        finePerDay: 0.75,
        gracePeriodDays: 0,
      };

      const partialDto: UpdateSettingsDto = {
        maxBooksAllowed: 8,
        loanDurationDays: 21,
      };

      const updatedSetting = {
        ...existingSetting,
        maxBooksAllowed: 8,
        loanDurationDays: 21,
      };

      prisma.systemSetting.findUnique.mockResolvedValue(existingSetting);
      prisma.systemSetting.update.mockResolvedValue(updatedSetting);

      const result = await service.update('student', partialDto);

      expect(result).toEqual(updatedSetting);
      expect(prisma.systemSetting.update).toHaveBeenCalledWith({
        where: { memberType: 'student' },
        data: {
          maxBooksAllowed: 8,
          loanDurationDays: 21,
        },
      });
    });

    it('should create new settings when none exist and all fields provided', async () => {
      const newSetting = {
        id: 'setting-new',
        memberType: 'faculty',
        maxBooksAllowed: 10,
        loanDurationDays: 30,
        renewalLimit: 3,
        finePerDay: 1.5,
        gracePeriodDays: 2,
      };

      prisma.systemSetting.findUnique.mockResolvedValue(null);
      prisma.systemSetting.create.mockResolvedValue(newSetting);

      const result = await service.update('faculty', fullDto);

      expect(result).toEqual(newSetting);
      expect(prisma.systemSetting.create).toHaveBeenCalledWith({
        data: {
          memberType: 'faculty',
          maxBooksAllowed: 10,
          loanDurationDays: 30,
          renewalLimit: 3,
          finePerDay: 1.5,
          gracePeriodDays: 2,
        },
      });
    });

    it('should default gracePeriodDays to 0 when creating new settings without it', async () => {
      const dtoWithoutGrace: UpdateSettingsDto = {
        maxBooksAllowed: 5,
        loanDurationDays: 14,
        renewalLimit: 2,
        finePerDay: 1.0,
      };

      prisma.systemSetting.findUnique.mockResolvedValue(null);
      prisma.systemSetting.create.mockResolvedValue({
        id: 'setting-new',
        memberType: 'public',
        ...dtoWithoutGrace,
        gracePeriodDays: 0,
      });

      await service.update('public', dtoWithoutGrace);

      expect(prisma.systemSetting.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          gracePeriodDays: 0,
        }),
      });
    });

    it('should throw BadRequestException when creating settings without all required fields', async () => {
      const incompleteDto: UpdateSettingsDto = {
        maxBooksAllowed: 5,
        loanDurationDays: 14,
        // missing renewalLimit and finePerDay
      };

      prisma.systemSetting.findUnique.mockResolvedValue(null);

      await expect(
        service.update('student', incompleteDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update('student', incompleteDto),
      ).rejects.toThrow(
        'Settings for member type "student" do not exist yet. ' +
          'Please provide all required fields for initial creation: ' +
          'maxBooksAllowed, loanDurationDays, renewalLimit, finePerDay',
      );
    });

    it('should throw BadRequestException for invalid member type', async () => {
      await expect(
        service.update('invalid_type', fullDto),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.update('invalid_type', fullDto),
      ).rejects.toThrow(
        'Invalid member type "invalid_type". Valid types are: student, faculty, public',
      );
    });

    it('should update only the fields provided in the DTO', async () => {
      const existingSetting = {
        id: 'setting-1',
        memberType: 'public',
        maxBooksAllowed: 5,
        loanDurationDays: 14,
        renewalLimit: 2,
        finePerDay: 1.0,
        gracePeriodDays: 0,
      };

      prisma.systemSetting.findUnique.mockResolvedValue(existingSetting);
      prisma.systemSetting.update.mockResolvedValue({
        ...existingSetting,
        finePerDay: 2.0,
      });

      await service.update('public', { finePerDay: 2.0 });

      expect(prisma.systemSetting.update).toHaveBeenCalledWith({
        where: { memberType: 'public' },
        data: { finePerDay: 2.0 },
      });
    });

    it('should update all fields when all are provided for existing settings', async () => {
      const existingSetting = {
        id: 'setting-1',
        memberType: 'student',
        maxBooksAllowed: 5,
        loanDurationDays: 14,
        renewalLimit: 2,
        finePerDay: 0.75,
        gracePeriodDays: 0,
      };

      prisma.systemSetting.findUnique.mockResolvedValue(existingSetting);
      prisma.systemSetting.update.mockResolvedValue({
        ...existingSetting,
        ...fullDto,
      });

      await service.update('student', fullDto);

      expect(prisma.systemSetting.update).toHaveBeenCalledWith({
        where: { memberType: 'student' },
        data: {
          maxBooksAllowed: 10,
          loanDurationDays: 30,
          renewalLimit: 3,
          finePerDay: 1.5,
          gracePeriodDays: 2,
        },
      });
    });

    it('should not call create or update when member type validation fails', async () => {
      await expect(
        service.update('admin', fullDto),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.systemSetting.findUnique).not.toHaveBeenCalled();
      expect(prisma.systemSetting.create).not.toHaveBeenCalled();
      expect(prisma.systemSetting.update).not.toHaveBeenCalled();
    });
  });
});
