import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class SearchQueryDto {
  @ApiPropertyOptional({
    description: 'Search term to match against title, author, ISBN, or description',
    example: 'harry potter',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filter by author name',
    example: 'J.K. Rowling',
  })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({
    description: 'Filter by category',
    example: 'Fiction',
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
    description: 'Sort field',
    enum: ['title', 'author', 'year', 'popularity'],
    example: 'title',
  })
  @IsOptional()
  @IsIn(['title', 'author', 'year', 'popularity'], {
    message: 'sort must be one of: title, author, year, popularity',
  })
  sort?: 'title' | 'author' | 'year' | 'popularity';

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
