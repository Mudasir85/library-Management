import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class LostBookDto {
  @ApiProperty({
    description: 'ID of the transaction for the lost book',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'transactionId must be a valid UUID' })
  transactionId: string;

  @ApiProperty({
    description: 'ID of the member who lost the book',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID('4', { message: 'memberId must be a valid UUID' })
  memberId: string;

  @ApiProperty({
    description: 'ID of the lost book',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID('4', { message: 'bookId must be a valid UUID' })
  bookId: string;

  @ApiPropertyOptional({
    description: 'Additional description or notes about the lost book',
    example: 'Member reported book lost during travel',
  })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  description?: string;
}
