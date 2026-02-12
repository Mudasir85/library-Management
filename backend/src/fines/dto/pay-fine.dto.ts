import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsUUID, Min } from 'class-validator';

export enum PaymentMethod {
  cash = 'cash',
  card = 'card',
  online = 'online',
}

export class PayFineDto {
  @ApiProperty({
    description: 'ID of the fine to pay',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'fineId must be a valid UUID' })
  fineId: string;

  @ApiProperty({
    description: 'Amount to pay (supports partial payments)',
    example: 10.5,
    minimum: 0.01,
  })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0.01, { message: 'Payment amount must be at least 0.01' })
  amount: number;

  @ApiProperty({
    description: 'Payment method used',
    enum: PaymentMethod,
    example: PaymentMethod.cash,
  })
  @IsEnum(PaymentMethod, {
    message: 'Payment method must be one of: cash, card, online',
  })
  paymentMethod: PaymentMethod;
}
