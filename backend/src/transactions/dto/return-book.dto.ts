import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class ReturnBookDto {
  @ApiPropertyOptional({
    description: 'Transaction ID to return (use this OR bookId+memberId)',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Transaction ID must be a valid UUID' })
  transactionId?: string;

  @ApiPropertyOptional({
    description: 'Book ID (required if transactionId is not provided)',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Book ID must be a valid UUID' })
  bookId?: string;

  @ApiPropertyOptional({
    description: 'Member ID (required if transactionId is not provided)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Member ID must be a valid UUID' })
  memberId?: string;
}
