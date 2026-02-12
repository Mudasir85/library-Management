import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class IssueBookDto {
  @ApiProperty({
    description: 'ID of the member to issue the book to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty({ message: 'Member ID is required' })
  @IsUUID('4', { message: 'Member ID must be a valid UUID' })
  memberId: string;

  @ApiProperty({
    description: 'ID of the book to issue',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty({ message: 'Book ID is required' })
  @IsUUID('4', { message: 'Book ID must be a valid UUID' })
  bookId: string;
}
