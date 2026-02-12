import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import {
  paginatedResponse,
  successResponse,
} from '@/common/utils/response.util';
import { FinesService } from './fines.service';
import { FineQueryDto } from './dto/fine-query.dto';
import { PayFineDto } from './dto/pay-fine.dto';
import { LostBookDto } from './dto/lost-book.dto';
import { DamageFineDto } from './dto/damage-fine.dto';

@ApiTags('Fines')
@ApiBearerAuth()
@Controller('fines')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinesController {
  constructor(private readonly finesService: FinesService) {}

  @Get()
  @Roles('librarian', 'admin')
  @ApiOperation({ summary: 'List all fines with pagination and filters' })
  async findAll(@Query() query: FineQueryDto) {
    const { fines, total } = await this.finesService.findAll(query);
    return paginatedResponse(fines, total, query.page, query.limit, 'Fines retrieved successfully');
  }

  @Get('outstanding')
  @Roles('librarian', 'admin')
  @ApiOperation({ summary: 'Get all outstanding (unpaid) fines' })
  async getOutstanding() {
    const fines = await this.finesService.getOutstanding();
    return successResponse(fines, 'Outstanding fines retrieved successfully');
  }

  @Get('member/:id')
  @Roles('librarian', 'admin', 'member')
  @ApiOperation({ summary: "Get a member's fines" })
  @ApiParam({ name: 'id', description: 'Member ID', type: String })
  async findByMember(@Param('id', ParseUUIDPipe) memberId: string) {
    const fines = await this.finesService.findByMember(memberId);
    return successResponse(fines, 'Member fines retrieved successfully');
  }

  @Post('pay')
  @Roles('librarian', 'admin')
  @ApiOperation({ summary: 'Process a fine payment (full or partial)' })
  async processPayment(@Body() dto: PayFineDto) {
    const fine = await this.finesService.processPayment(dto);
    return successResponse(fine, 'Payment processed successfully');
  }

  @Post(':id/waive')
  @Roles('admin')
  @ApiOperation({ summary: 'Waive a fine (admin only)' })
  @ApiParam({ name: 'id', description: 'Fine ID', type: String })
  async waiveFine(@Param('id', ParseUUIDPipe) fineId: string) {
    const fine = await this.finesService.waiveFine(fineId);
    return successResponse(fine, 'Fine waived successfully');
  }

  @Post('lost-book')
  @Roles('librarian', 'admin')
  @ApiOperation({ summary: 'Record a lost book and create associated fine' })
  async recordLostBook(@Body() dto: LostBookDto) {
    const fine = await this.finesService.recordLostBook(dto);
    return successResponse(fine, 'Lost book fine recorded successfully');
  }

  @Post('damage')
  @Roles('librarian', 'admin')
  @ApiOperation({ summary: 'Record book damage and create associated fine' })
  async recordDamage(@Body() dto: DamageFineDto) {
    const fine = await this.finesService.recordDamage(dto);
    return successResponse(fine, 'Damage fine recorded successfully');
  }
}
