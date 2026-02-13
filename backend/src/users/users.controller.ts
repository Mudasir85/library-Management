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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { successResponse } from '@/common/utils/response.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List all users',
    description: 'Retrieve all users. Admin only.',
  })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async findAll() {
    const users = await this.usersService.findAll();
    return successResponse(users, 'Users retrieved successfully');
  }

  @Post()
  @ApiOperation({
    summary: 'Create a user',
    description: 'Create a new user account. Admin only.',
  })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Username/email already exists' })
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return successResponse(user, 'User created successfully');
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a user',
    description: 'Update an existing user. Admin only.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Username/email already exists' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(id, dto);
    return successResponse(user, 'User updated successfully');
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a user',
    description: 'Permanently delete a user. Admin only.',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.usersService.remove(id);
    return successResponse(result, result.message);
  }
}
