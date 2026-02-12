import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    description: 'Maximum number of books a member can borrow at once',
    example: 5,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'maxBooksAllowed must be an integer' })
  @Min(1, { message: 'maxBooksAllowed must be at least 1' })
  maxBooksAllowed?: number;

  @ApiPropertyOptional({
    description: 'Number of days a book can be borrowed',
    example: 14,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'loanDurationDays must be an integer' })
  @Min(1, { message: 'loanDurationDays must be at least 1' })
  loanDurationDays?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of times a book can be renewed',
    example: 2,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'renewalLimit must be an integer' })
  @Min(0, { message: 'renewalLimit must be at least 0' })
  renewalLimit?: number;

  @ApiPropertyOptional({
    description: 'Fine amount per day for overdue books (in currency units)',
    example: 1.5,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'finePerDay must be a number' })
  @Min(0, { message: 'finePerDay must be at least 0' })
  finePerDay?: number;

  @ApiPropertyOptional({
    description: 'Number of grace period days before fines start accruing',
    example: 1,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'gracePeriodDays must be an integer' })
  @Min(0, { message: 'gracePeriodDays must be at least 0' })
  gracePeriodDays?: number;
}
