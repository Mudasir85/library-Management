import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  Header,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { ReportQueryDto, ExportReportDto } from './dto/report-query.dto';
import { successResponse } from '@/common/utils/response.util';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'librarian')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get dashboard statistics',
    description: 'Retrieve comprehensive library dashboard statistics including book counts, member counts, overdue info, and recent activities',
  })
  @ApiResponse({ status: 200, description: 'Dashboard statistics returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin or librarian role required' })
  async getDashboardStats() {
    const stats = await this.reportsService.getDashboardStats();

    return successResponse(stats, 'Dashboard statistics retrieved successfully');
  }

  @Get('books/popular')
  @ApiOperation({
    summary: 'Get popular books report',
    description: 'Get the most popular books ranked by number of times borrowed',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of books to return',
    example: 10,
  })
  @ApiResponse({ status: 200, description: 'Popular books report returned successfully' })
  async getPopularBooks(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const report = await this.reportsService.getPopularBooks(limit);

    return successResponse(report, 'Popular books report retrieved successfully');
  }

  @Get('books/inventory')
  @ApiOperation({
    summary: 'Get inventory status report',
    description: 'Get inventory grouped by condition, category counts, and low-stock books',
  })
  @ApiResponse({ status: 200, description: 'Inventory status report returned successfully' })
  async getInventoryStatus() {
    const report = await this.reportsService.getInventoryStatus();

    return successResponse(report, 'Inventory status report retrieved successfully');
  }

  @Get('books/overdue')
  @ApiOperation({
    summary: 'Get overdue books report',
    description: 'Get a list of all overdue transactions with member and book details',
  })
  @ApiResponse({ status: 200, description: 'Overdue report returned successfully' })
  async getOverdueReport() {
    const report = await this.reportsService.getOverdueReport();

    return successResponse(report, 'Overdue report retrieved successfully');
  }

  @Get('members/stats')
  @ApiOperation({
    summary: 'Get member statistics report',
    description: 'Get member statistics including counts by type, status, and top borrowers',
  })
  @ApiResponse({ status: 200, description: 'Member statistics returned successfully' })
  async getMemberStats() {
    const report = await this.reportsService.getMemberStats();

    return successResponse(report, 'Member statistics retrieved successfully');
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'Get transaction report',
    description: 'Get transactions in a date range with summary statistics',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    description: 'Start date (ISO 8601)',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    description: 'End date (ISO 8601)',
    example: '2024-12-31',
  })
  @ApiResponse({ status: 200, description: 'Transaction report returned successfully' })
  async getTransactionReport(@Query() query: ReportQueryDto) {
    const report = await this.reportsService.getTransactionReport(
      query.fromDate,
      query.toDate,
    );

    return successResponse(report, 'Transaction report retrieved successfully');
  }

  @Get('financial')
  @ApiOperation({
    summary: 'Get financial report',
    description: 'Get fines collected, outstanding, and waived in a date range',
  })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    description: 'Start date (ISO 8601)',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    description: 'End date (ISO 8601)',
    example: '2024-12-31',
  })
  @ApiResponse({ status: 200, description: 'Financial report returned successfully' })
  async getFinancialReport(@Query() query: ReportQueryDto) {
    const report = await this.reportsService.getFinancialReport(
      query.fromDate,
      query.toDate,
    );

    return successResponse(report, 'Financial report retrieved successfully');
  }

  @Post('export')
  @ApiOperation({
    summary: 'Export report',
    description: 'Export a report in CSV or JSON format',
  })
  @ApiBody({ type: ExportReportDto })
  @ApiResponse({ status: 200, description: 'Report exported successfully' })
  @ApiResponse({ status: 400, description: 'Invalid report type' })
  async exportReport(
    @Body() dto: ExportReportDto,
    @Res() res: Response,
  ) {
    const format = dto.format || 'csv';

    if (format === 'csv') {
      const csvContent = await this.reportsService.exportToCsv(
        dto.reportType,
        dto.params,
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${dto.reportType}-report-${new Date().toISOString().split('T')[0]}.csv"`,
      );

      return res.send(csvContent);
    }

    // JSON format - return data based on report type
    let data: any;

    switch (dto.reportType) {
      case 'popular-books':
        data = await this.reportsService.getPopularBooks(dto.params?.limit);
        break;
      case 'inventory':
        data = await this.reportsService.getInventoryStatus();
        break;
      case 'overdue':
        data = await this.reportsService.getOverdueReport();
        break;
      case 'member-stats':
        data = await this.reportsService.getMemberStats();
        break;
      case 'transactions':
        data = await this.reportsService.getTransactionReport(
          dto.params?.fromDate,
          dto.params?.toDate,
        );
        break;
      case 'financial':
        data = await this.reportsService.getFinancialReport(
          dto.params?.fromDate,
          dto.params?.toDate,
        );
        break;
      default:
        return res.status(400).json({
          success: false,
          error: {
            code: 400,
            message: `Unknown report type: ${dto.reportType}`,
            details: null,
          },
        });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${dto.reportType}-report-${new Date().toISOString().split('T')[0]}.json"`,
    );

    return res.json(successResponse(data, 'Report exported successfully'));
  }
}
