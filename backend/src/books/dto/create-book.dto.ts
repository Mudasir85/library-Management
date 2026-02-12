import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  IsEnum,
  IsDateString,
  Min,
  Max,
  Matches,
} from 'class-validator';

export enum BookCondition {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
}

export class CreateBookDto {
  @ApiProperty({
    description: 'Title of the book',
    example: 'Clean Code: A Handbook of Agile Software Craftsmanship',
  })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  title: string;

  @ApiProperty({
    description: 'Author of the book',
    example: 'Robert C. Martin',
  })
  @IsString()
  @IsNotEmpty({ message: 'Author is required' })
  author: string;

  @ApiProperty({
    description: 'ISBN (10 or 13 digits, optionally with hyphens)',
    example: '978-0132350884',
  })
  @IsString()
  @IsNotEmpty({ message: 'ISBN is required' })
  @Matches(/^(?:\d{9}[\dXx]|\d{13}|\d{3}-\d{1,5}-\d{1,7}-\d{1,7}-\d{1})$/, {
    message:
      'ISBN must be a valid 10-digit or 13-digit ISBN, optionally with hyphens',
  })
  isbn: string;

  @ApiPropertyOptional({
    description: 'Publisher of the book',
    example: 'Prentice Hall',
  })
  @IsOptional()
  @IsString()
  publisher?: string;

  @ApiPropertyOptional({
    description: 'Year the book was published',
    example: 2008,
    minimum: 1000,
  })
  @IsOptional()
  @IsInt({ message: 'Publication year must be an integer' })
  @Min(1000, { message: 'Publication year must be at least 1000' })
  @Max(new Date().getFullYear(), {
    message: `Publication year cannot exceed the current year`,
  })
  publicationYear?: number;

  @ApiPropertyOptional({
    description: 'Edition of the book',
    example: '1st',
  })
  @IsOptional()
  @IsString()
  edition?: string;

  @ApiProperty({
    description: 'Category or genre of the book',
    example: 'Computer Science',
  })
  @IsString()
  @IsNotEmpty({ message: 'Category is required' })
  category: string;

  @ApiPropertyOptional({
    description: 'Language the book is written in',
    default: 'English',
    example: 'English',
  })
  @IsOptional()
  @IsString()
  language?: string = 'English';

  @ApiPropertyOptional({
    description: 'Number of pages in the book',
    example: 464,
    minimum: 1,
  })
  @IsOptional()
  @IsInt({ message: 'Pages must be an integer' })
  @Min(1, { message: 'Pages must be at least 1' })
  pages?: number;

  @ApiProperty({
    description: 'Physical shelf location in the library',
    example: 'A3-S2-R4',
  })
  @IsString()
  @IsNotEmpty({ message: 'Shelf location is required' })
  shelfLocation: string;

  @ApiProperty({
    description: 'Library call number for cataloging',
    example: 'QA76.73.J38 M37 2008',
  })
  @IsString()
  @IsNotEmpty({ message: 'Call number is required' })
  callNumber: string;

  @ApiProperty({
    description: 'Total number of copies owned by the library',
    example: 3,
    minimum: 1,
  })
  @IsInt({ message: 'Total copies must be an integer' })
  @Min(1, { message: 'Total copies must be at least 1' })
  totalCopies: number;

  @ApiProperty({
    description: 'Number of copies currently available for checkout',
    example: 2,
    minimum: 0,
  })
  @IsInt({ message: 'Available copies must be an integer' })
  @Min(0, { message: 'Available copies cannot be negative' })
  availableCopies: number;

  @ApiPropertyOptional({
    description: 'Physical condition of the book',
    enum: BookCondition,
    default: BookCondition.GOOD,
    example: BookCondition.GOOD,
  })
  @IsOptional()
  @IsEnum(BookCondition, {
    message: 'Condition must be one of: excellent, good, fair, poor',
  })
  condition?: BookCondition;

  @ApiPropertyOptional({
    description: 'Date the book was purchased',
    example: '2023-06-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Purchase date must be a valid ISO date string' })
  purchaseDate?: string;

  @ApiPropertyOptional({
    description: 'Purchase price of the book',
    example: 39.99,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Price must be a number' })
  @Min(0, { message: 'Price cannot be negative' })
  price?: number;

  @ApiPropertyOptional({
    description: 'Description or summary of the book',
    example:
      'A handbook of agile software craftsmanship that covers best practices for writing clean, maintainable code.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'URL to the book cover image',
    example: 'https://example.com/covers/clean-code.jpg',
  })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;
}
