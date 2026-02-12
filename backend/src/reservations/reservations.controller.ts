import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { successResponse } from '@/common/utils/response.util';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';

@ApiTags('Reservations')
@ApiBearerAuth()
@Controller('reservations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @Roles('member', 'librarian', 'admin')
  @ApiOperation({ summary: 'Create a new reservation for a book' })
  async create(
    @Body() dto: CreateReservationDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    // Resolve the member ID from the authenticated user
    const reservation = await this.reservationsService.create(dto, user.id);
    return successResponse(reservation, 'Reservation created successfully');
  }

  @Delete(':id')
  @Roles('member', 'librarian', 'admin')
  @ApiOperation({ summary: 'Cancel a reservation' })
  @ApiParam({ name: 'id', description: 'Reservation ID', type: String })
  async cancel(@Param('id', ParseUUIDPipe) reservationId: string) {
    const reservation = await this.reservationsService.cancel(reservationId);
    return successResponse(reservation, 'Reservation cancelled successfully');
  }

  @Get('member/:id')
  @Roles('member', 'librarian', 'admin')
  @ApiOperation({ summary: "Get a member's reservations" })
  @ApiParam({ name: 'id', description: 'Member ID', type: String })
  async getByMember(@Param('id', ParseUUIDPipe) memberId: string) {
    const reservations = await this.reservationsService.getByMember(memberId);
    return successResponse(
      reservations,
      'Member reservations retrieved successfully',
    );
  }

  @Get('book/:id')
  @Roles('librarian', 'admin')
  @ApiOperation({ summary: 'Get the reservation queue for a book' })
  @ApiParam({ name: 'id', description: 'Book ID', type: String })
  async getByBook(@Param('id', ParseUUIDPipe) bookId: string) {
    const reservations = await this.reservationsService.getByBook(bookId);
    return successResponse(
      reservations,
      'Book reservation queue retrieved successfully',
    );
  }

  @Put(':id/fulfill')
  @Roles('librarian', 'admin')
  @ApiOperation({ summary: 'Fulfill a reservation (mark as checked out)' })
  @ApiParam({ name: 'id', description: 'Reservation ID', type: String })
  async fulfill(@Param('id', ParseUUIDPipe) reservationId: string) {
    const reservation =
      await this.reservationsService.fulfill(reservationId);
    return successResponse(reservation, 'Reservation fulfilled successfully');
  }
}
