import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Category name (must be unique)',
    example: 'Science Fiction',
  })
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  name: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Books about futuristic science and technology',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Parent category ID for hierarchical categorization',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'parentCategoryId must be a valid UUID' })
  parentCategoryId?: string;
}
