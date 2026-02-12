import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export enum MemberTypeFilter {
  student = 'student',
  faculty = 'faculty',
  public = 'public',
}

export enum MemberStatusFilter {
  active = 'active',
  suspended = 'suspended',
  expired = 'expired',
}

export class MemberQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by member type',
    enum: MemberTypeFilter,
    example: MemberTypeFilter.student,
  })
  @IsOptional()
  @IsEnum(MemberTypeFilter)
  memberType?: MemberTypeFilter;

  @ApiPropertyOptional({
    description: 'Filter by member status',
    enum: MemberStatusFilter,
    example: MemberStatusFilter.active,
  })
  @IsOptional()
  @IsEnum(MemberStatusFilter)
  status?: MemberStatusFilter;

  @ApiPropertyOptional({
    description: 'Filter by city',
    example: 'Springfield',
  })
  @IsOptional()
  @IsString()
  city?: string;
}
