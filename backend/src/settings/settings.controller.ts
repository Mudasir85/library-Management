import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
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
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { successResponse } from '@/common/utils/response.util';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles('admin')
  @ApiOperation({
    summary: 'Get all system settings',
    description: 'Retrieve system settings for all member types. Admin only.',
  })
  @ApiResponse({ status: 200, description: 'Settings returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  async findAll() {
    const settings = await this.settingsService.findAll();

    return successResponse(settings, 'Settings retrieved successfully');
  }

  @Get(':memberType')
  @Roles('admin', 'librarian')
  @ApiOperation({
    summary: 'Get settings for a member type',
    description: 'Retrieve system settings for a specific member type. Admin or librarian.',
  })
  @ApiParam({
    name: 'memberType',
    description: 'Member type to get settings for',
    enum: ['student', 'faculty', 'public'],
    example: 'student',
  })
  @ApiResponse({ status: 200, description: 'Settings returned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid member type' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin or librarian role required' })
  @ApiResponse({ status: 404, description: 'Settings not found for this member type' })
  async findByMemberType(@Param('memberType') memberType: string) {
    const setting = await this.settingsService.findByMemberType(memberType);

    return successResponse(
      setting,
      `Settings for member type "${memberType}" retrieved successfully`,
    );
  }

  @Put(':memberType')
  @Roles('admin')
  @ApiOperation({
    summary: 'Update settings for a member type',
    description:
      'Update system settings for a specific member type. Creates settings if they do not exist. Admin only.',
  })
  @ApiParam({
    name: 'memberType',
    description: 'Member type to update settings for',
    enum: ['student', 'faculty', 'public'],
    example: 'student',
  })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data or member type' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  async update(
    @Param('memberType') memberType: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    const setting = await this.settingsService.update(memberType, dto);

    return successResponse(
      setting,
      `Settings for member type "${memberType}" updated successfully`,
    );
  }
}
