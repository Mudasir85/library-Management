import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateReservationDto {
  @ApiProperty({
    description: 'ID of the book to reserve',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty({ message: 'Book ID is required' })
  @IsUUID('4', { message: 'bookId must be a valid UUID' })
  bookId: string;
}
