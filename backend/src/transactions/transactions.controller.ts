import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  successResponse,
  paginatedResponse,
} from '@/common/utils/response.util';
import { TransactionsService } from './transactions.service';
import { IssueBookDto } from './dto/issue-book.dto';
import { ReturnBookDto } from './dto/return-book.dto';
import { RenewBookDto } from './dto/renew-book.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';

@ApiTags('Transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('issue')
  @Roles('admin', 'librarian')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Issue a book to a member',
    description:
      'Creates a new book issue transaction. Validates member eligibility, ' +
      'book availability, outstanding fines, and reservation conflicts. ' +
      'Only accessible by admin and librarian roles.',
  })
  @ApiResponse({
    status: 201,
    description: 'Book issued successfully.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - member inactive, book unavailable, borrowing limit reached, or outstanding fines too high.',
  })
  @ApiResponse({
    status: 404,
    description: 'Member or book not found.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - book reserved by another member or already issued to this member.',
  })
  async issueBook(
    @Body() dto: IssueBookDto,
    @CurrentUser('id') issuedById: string,
  ) {
    const transaction = await this.transactionsService.issueBook(
      dto,
      issuedById,
    );
    return successResponse(transaction, 'Book issued successfully');
  }

  @Post('return')
  @Roles('admin', 'librarian')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Return a book',
    description:
      'Processes a book return. Calculates overdue fines (accounting for grace period), ' +
      'creates fine records, and updates member/book counts. ' +
      'Provide either transactionId or both bookId and memberId.',
  })
  @ApiResponse({
    status: 200,
    description: 'Book returned successfully. Response includes any fine details.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - insufficient identification or transaction already returned.',
  })
  @ApiResponse({
    status: 404,
    description: 'No active transaction found.',
  })
  async returnBook(
    @Body() dto: ReturnBookDto,
    @CurrentUser('id') returnedToId: string,
  ) {
    const result = await this.transactionsService.returnBook(dto, returnedToId);
    const message = result.fineApplied
      ? `Book returned successfully. Overdue fine of $${Number(result.fineAmount).toFixed(2)} applied (${result.overdueDays} day(s) overdue).`
      : 'Book returned successfully. No fines applied.';
    return successResponse(result, message);
  }

  @Post('renew')
  @Roles('admin', 'librarian', 'member')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renew a book transaction',
    description:
      'Extends the due date by the loan duration for the member type. ' +
      'Checks renewal limits and reservation conflicts. ' +
      'Members can only renew their own books; admins/librarians can renew any.',
  })
  @ApiResponse({
    status: 200,
    description: 'Book renewed successfully with new due date.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - transaction not issued or renewal limit reached.',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - book is reserved by another member.',
  })
  async renewBook(
    @Body() dto: RenewBookDto,
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.transactionsService.renewBook(dto, userId);
    return successResponse(
      result,
      `Book renewed successfully. New due date: ${result.newDueDate.toISOString().split('T')[0]}. ` +
        `${result.renewalsRemaining} renewal(s) remaining.`,
    );
  }

  @Get('overdue')
  @Roles('admin', 'librarian')
  @ApiOperation({
    summary: 'Get all overdue transactions',
    description:
      'Returns all transactions where the book is still issued but the due date has passed. ' +
      'Includes calculated overdue days and estimated fine per transaction.',
  })
  @ApiResponse({
    status: 200,
    description: 'Overdue transactions retrieved successfully.',
  })
  async getOverdue() {
    const result = await this.transactionsService.getOverdue();
    return successResponse(
      result,
      `Found ${result.count} overdue transaction(s).`,
    );
  }

  @Get(':id')
  @Roles('admin', 'librarian', 'member')
  @ApiOperation({
    summary: 'Get transaction details',
    description:
      'Retrieves detailed information about a specific transaction including member, book, staff, and fine details.',
  })
  @ApiParam({
    name: 'id',
    description: 'Transaction UUID',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction details retrieved successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found.',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const transaction = await this.transactionsService.findOne(id);
    return successResponse(transaction, 'Transaction retrieved successfully');
  }

  @Get()
  @Roles('admin', 'librarian')
  @ApiOperation({
    summary: 'List all transactions',
    description:
      'Returns a paginated list of transactions with optional filters by status, member, book, and date range. ' +
      'Supports sorting and pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transactions retrieved successfully.',
  })
  async findAll(@Query() query: TransactionQueryDto) {
    const { transactions, total, page, limit } =
      await this.transactionsService.findAll(query);
    return paginatedResponse(
      transactions,
      total,
      page,
      limit,
      'Transactions retrieved successfully',
    );
  }

  @Post(':id/receipt')
  @Roles('admin', 'librarian', 'member')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate receipt data for a transaction',
    description:
      'Returns structured receipt data for a transaction, including member info, book info, ' +
      'dates, fine breakdown, and payment status. Suitable for display or printing.',
  })
  @ApiParam({
    name: 'id',
    description: 'Transaction UUID',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Receipt generated successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found.',
  })
  async generateReceipt(@Param('id', ParseUUIDPipe) id: string) {
    const receipt = await this.transactionsService.generateReceipt(id);
    return successResponse(receipt, 'Receipt generated successfully');
  }
}
