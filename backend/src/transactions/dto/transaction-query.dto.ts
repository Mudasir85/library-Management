import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsIn, IsDateString } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class TransactionQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by transaction status',
    enum: ['issued', 'returned', 'overdue'],
    example: 'issued',
  })
  @IsOptional()
  @IsIn(['issued', 'returned', 'overdue'], {
    message: 'Status must be one of: issued, returned, overdue',
  })
  status?: 'issued' | 'returned' | 'overdue';

  @ApiPropertyOptional({
    description: 'Filter by member ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Member ID must be a valid UUID' })
  memberId?: string;

  @ApiPropertyOptional({
    description: 'Filter by book ID',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Book ID must be a valid UUID' })
  bookId?: string;

  @ApiPropertyOptional({
    description: 'Filter transactions from this date (ISO 8601)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'fromDate must be a valid ISO 8601 date string' })
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter transactions to this date (ISO 8601)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'toDate must be a valid ISO 8601 date string' })
  toDate?: string;
}
