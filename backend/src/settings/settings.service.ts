import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { MemberType, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Valid member types from the Prisma MemberType enum.
   */
  private readonly validMemberTypes: MemberType[] = [
    'student',
    'faculty',
    'public',
  ];

  /**
   * Validate that a member type string is a valid MemberType enum value.
   */
  private validateMemberType(memberType: string): MemberType {
    if (!this.validMemberTypes.includes(memberType as MemberType)) {
      throw new BadRequestException(
        `Invalid member type "${memberType}". Valid types are: ${this.validMemberTypes.join(', ')}`,
      );
    }

    return memberType as MemberType;
  }

  /**
   * Get all system settings for all member types.
   */
  async findAll() {
    const settings = await this.prisma.systemSetting.findMany({
      orderBy: { memberType: 'asc' },
    });

    return settings;
  }

  /**
   * Get system settings for a specific member type.
   */
  async findByMemberType(memberType: string) {
    const validatedType = this.validateMemberType(memberType);

    const setting = await this.prisma.systemSetting.findUnique({
      where: { memberType: validatedType },
    });

    if (!setting) {
      throw new NotFoundException(
        `Settings for member type "${memberType}" not found. You may need to create default settings first.`,
      );
    }

    return setting;
  }

  /**
   * Update system settings for a specific member type.
   * Creates the settings record if it does not exist (upsert behavior).
   */
  async update(memberType: string, dto: UpdateSettingsDto) {
    const validatedType = this.validateMemberType(memberType);

    // Check if settings exist for this member type
    const existing = await this.prisma.systemSetting.findUnique({
      where: { memberType: validatedType },
    });

    if (!existing) {
      // If settings don't exist, require all fields for initial creation
      if (
        dto.maxBooksAllowed === undefined ||
        dto.loanDurationDays === undefined ||
        dto.renewalLimit === undefined ||
        dto.finePerDay === undefined
      ) {
        throw new BadRequestException(
          `Settings for member type "${memberType}" do not exist yet. ` +
            'Please provide all required fields for initial creation: ' +
            'maxBooksAllowed, loanDurationDays, renewalLimit, finePerDay',
        );
      }

      // Create new settings
      const newSetting = await this.prisma.systemSetting.create({
        data: {
          memberType: validatedType,
          maxBooksAllowed: dto.maxBooksAllowed,
          loanDurationDays: dto.loanDurationDays,
          renewalLimit: dto.renewalLimit,
          finePerDay: dto.finePerDay,
          gracePeriodDays: dto.gracePeriodDays ?? 0,
        },
      });

      return newSetting;
    }

    // Build update data with only provided fields
    const updateData: Prisma.SystemSettingUpdateInput = {};

    if (dto.maxBooksAllowed !== undefined) {
      updateData.maxBooksAllowed = dto.maxBooksAllowed;
    }

    if (dto.loanDurationDays !== undefined) {
      updateData.loanDurationDays = dto.loanDurationDays;
    }

    if (dto.renewalLimit !== undefined) {
      updateData.renewalLimit = dto.renewalLimit;
    }

    if (dto.finePerDay !== undefined) {
      updateData.finePerDay = dto.finePerDay;
    }

    if (dto.gracePeriodDays !== undefined) {
      updateData.gracePeriodDays = dto.gracePeriodDays;
    }

    const updated = await this.prisma.systemSetting.update({
      where: { memberType: validatedType },
      data: updateData,
    });

    return updated;
  }
}
