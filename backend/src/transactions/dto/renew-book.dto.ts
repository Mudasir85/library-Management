import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class RenewBookDto {
  @ApiProperty({
    description: 'Transaction ID to renew',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty({ message: 'Transaction ID is required' })
  @IsUUID('4', { message: 'Transaction ID must be a valid UUID' })
  transactionId: string;
}
