import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsString, IsIn } from 'class-validator';

export class ReportQueryDto {
  @ApiPropertyOptional({
    description: 'Start date for report range (ISO 8601)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'fromDate must be a valid ISO 8601 date string' })
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'End date for report range (ISO 8601)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'toDate must be a valid ISO 8601 date string' })
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by member type',
    enum: ['student', 'faculty', 'public'],
    example: 'student',
  })
  @IsOptional()
  @IsString()
  memberType?: string;

  @ApiPropertyOptional({
    description: 'Filter by category',
    example: 'Fiction',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Export format',
    enum: ['csv', 'json'],
    default: 'json',
    example: 'json',
  })
  @IsOptional()
  @IsIn(['csv', 'json'], { message: 'format must be either csv or json' })
  format?: 'csv' | 'json';
}

export class ExportReportDto {
  @ApiPropertyOptional({
    description: 'Type of report to export',
    enum: [
      'popular-books',
      'inventory',
      'overdue',
      'member-stats',
      'transactions',
      'financial',
    ],
    example: 'overdue',
  })
  @IsString()
  reportType: string;

  @ApiPropertyOptional({
    description: 'Export format',
    enum: ['csv', 'json'],
    default: 'csv',
    example: 'csv',
  })
  @IsOptional()
  @IsIn(['csv', 'json'], { message: 'format must be either csv or json' })
  format?: 'csv' | 'json';

  @ApiPropertyOptional({
    description: 'Additional parameters for the report',
  })
  @IsOptional()
  params?: Record<string, any>;
}
