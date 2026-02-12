import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class DamageFineDto {
  @ApiPropertyOptional({
    description: 'ID of the related transaction (if applicable)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'transactionId must be a valid UUID' })
  transactionId?: string;

  @ApiProperty({
    description: 'ID of the member responsible for the damage',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID('4', { message: 'memberId must be a valid UUID' })
  memberId: string;

  @ApiProperty({
    description: 'ID of the damaged book',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID('4', { message: 'bookId must be a valid UUID' })
  bookId: string;

  @ApiProperty({
    description:
      'Percentage of damage to the book (25 = minor, 50 = moderate, 100 = severe/total)',
    example: 50,
    enum: [25, 50, 100],
  })
  @IsNumber({}, { message: 'damagePercent must be a number' })
  @IsIn([25, 50, 100], {
    message: 'damagePercent must be one of: 25, 50, or 100',
  })
  damagePercent: number;

  @ApiPropertyOptional({
    description: 'Description of the damage',
    example: 'Water damage on pages 50-100, text partially illegible',
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;
}
