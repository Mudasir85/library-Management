import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Readable } from 'stream';
import * as csvParser from 'csv-parser';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { BookQueryDto } from './dto/book-query.dto';

@ApiTags('Books')
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  @ApiOperation({
    summary: 'List all books',
    description:
      'Retrieve a paginated list of books with optional search, filtering, and sorting. This is a public endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of books retrieved successfully',
  })
  async findAll(@Query() query: BookQueryDto) {
    return this.booksService.findAll(query);
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Get all book categories',
    description:
      'Retrieve a list of distinct categories from all non-deleted books. This is a public endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of categories retrieved successfully',
  })
  async getCategories() {
    return this.booksService.getCategories();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single book by ID',
    description:
      'Retrieve detailed information about a specific book, including active reservation count.',
  })
  @ApiParam({
    name: 'id',
    description: 'Book UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Book details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Book not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.booksService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'librarian')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new book',
    description:
      'Add a new book to the library catalog. Requires librarian or admin role.',
  })
  @ApiResponse({ status: 201, description: 'Book created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient role' })
  @ApiResponse({ status: 409, description: 'Book with this ISBN already exists' })
  async create(@Body() dto: CreateBookDto) {
    return this.booksService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'librarian')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update an existing book',
    description:
      'Update book details. Requires librarian or admin role. All fields are optional.',
  })
  @ApiParam({
    name: 'id',
    description: 'Book UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 200, description: 'Book updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient role' })
  @ApiResponse({ status: 404, description: 'Book not found' })
  @ApiResponse({ status: 409, description: 'ISBN conflict with another book' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookDto,
  ) {
    return this.booksService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete a book',
    description:
      'Mark a book as deleted (soft delete). The book record is retained but hidden from queries. Requires admin role. Active reservations are cancelled automatically.',
  })
  @ApiParam({
    name: 'id',
    description: 'Book UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({ status: 200, description: 'Book deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin only' })
  @ApiResponse({ status: 404, description: 'Book not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete book with active transactions',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.booksService.remove(id);
  }

  @Post('bulk-import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Bulk import books from CSV',
    description:
      'Upload a CSV file to import multiple books at once. The CSV should have headers matching book fields (title, author, isbn, publisher, publicationYear, edition, category, language, pages, shelfLocation, callNumber, totalCopies, availableCopies, condition, purchaseDate, price, description, coverImageUrl). Requires admin role.',
  })
  @ApiBody({
    description: 'CSV file containing book records',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'CSV file with book data',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Bulk import completed',
    schema: {
      type: 'object',
      properties: {
        imported: { type: 'number', example: 15 },
        skipped: { type: 'number', example: 2 },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              row: { type: 'number', example: 3 },
              isbn: { type: 'string', example: '978-0132350884' },
              error: { type: 'string', example: 'A book with this ISBN already exists' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file or CSV format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin only' })
  async bulkImport(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    // Validate file type
    const validMimeTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    if (!validMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Please upload a CSV file.',
      );
    }

    const records = await this.parseCsv(file.buffer);

    if (records.length === 0) {
      throw new BadRequestException(
        'CSV file is empty or contains no valid records',
      );
    }

    return this.booksService.bulkImport(records);
  }

  private parseCsv(buffer: Buffer): Promise<Record<string, string>[]> {
    return new Promise((resolve, reject) => {
      const records: Record<string, string>[] = [];
      const stream = Readable.from(buffer);

      stream
        .pipe(csvParser())
        .on('data', (row: Record<string, string>) => {
          records.push(row);
        })
        .on('end', () => {
          resolve(records);
        })
        .on('error', (error: Error) => {
          reject(
            new BadRequestException(
              `Failed to parse CSV file: ${error.message}`,
            ),
          );
        });
    });
  }
}
