import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export enum FineStatusFilter {
  pending = 'pending',
  paid = 'paid',
  waived = 'waived',
}

export enum FineTypeFilter {
  overdue = 'overdue',
  lost = 'lost',
  damage = 'damage',
  membership = 'membership',
  reservation_noshow = 'reservation_noshow',
}

export class FineQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by fine status',
    enum: FineStatusFilter,
    example: FineStatusFilter.pending,
  })
  @IsOptional()
  @IsEnum(FineStatusFilter, {
    message: 'Status must be one of: pending, paid, waived',
  })
  status?: FineStatusFilter;

  @ApiPropertyOptional({
    description: 'Filter by fine type',
    enum: FineTypeFilter,
    example: FineTypeFilter.overdue,
  })
  @IsOptional()
  @IsEnum(FineTypeFilter, {
    message:
      'Fine type must be one of: overdue, lost, damage, membership, reservation_noshow',
  })
  fineType?: FineTypeFilter;

  @ApiPropertyOptional({
    description: 'Filter by member ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID('4', { message: 'memberId must be a valid UUID' })
  memberId?: string;
}
