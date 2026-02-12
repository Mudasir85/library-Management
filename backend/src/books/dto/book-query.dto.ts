import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaginationDto } from '@/common/dto/pagination.dto';

export class BookQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by category',
    example: 'Computer Science',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Filter by language',
    example: 'English',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: 'Filter by availability (true = only available books)',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  available?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by publication year (from)',
    example: 2000,
    minimum: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  yearFrom?: number;

  @ApiPropertyOptional({
    description: 'Filter by publication year (to)',
    example: 2024,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(new Date().getFullYear())
  yearTo?: number;
}
