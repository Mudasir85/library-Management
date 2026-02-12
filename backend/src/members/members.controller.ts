import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
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
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import {
  successResponse,
  paginatedResponse,
} from '@/common/utils/response.util';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MemberQueryDto } from './dto/member-query.dto';

const photoStorage = diskStorage({
  destination: './uploads/photos',
  filename: (_req, file, callback) => {
    const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
    callback(null, uniqueName);
  },
});

const photoFileFilter = (
  _req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return callback(
      new BadRequestException(
        'Only image files are allowed (jpeg, png, gif, webp).',
      ),
      false,
    );
  }

  callback(null, true);
};

@ApiTags('Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @Roles('admin', 'librarian')
  @ApiOperation({
    summary: 'List all members',
    description:
      'Retrieve a paginated list of members with optional search, filtering, and sorting. Accessible by librarians and admins.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of members retrieved successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Requires librarian or admin role.',
  })
  async findAll(@Query() query: MemberQueryDto) {
    const { members, total, page, limit } =
      await this.membersService.findAll(query);

    return paginatedResponse(
      members,
      total,
      page,
      limit,
      'Members retrieved successfully',
    );
  }

  @Get(':id')
  @Roles('admin', 'librarian', 'member')
  @ApiOperation({
    summary: 'Get member details',
    description:
      'Retrieve detailed information for a specific member including user relation and transaction count. Librarians/admins can access any member; members can only access their own profile.',
  })
  @ApiParam({
    name: 'id',
    description: 'Member UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Member details retrieved successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Cannot access another member profile.',
  })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: any,
  ) {
    // If the user is a regular member, verify they are accessing their own profile
    if (currentUser.role === 'member') {
      const memberProfile = await this.membersService.findByUserId(
        currentUser.id,
      );

      if (!memberProfile || memberProfile.id !== id) {
        throw new ForbiddenException(
          'You can only access your own member profile.',
        );
      }
    }

    const member = await this.membersService.findOne(id);

    return successResponse(member, 'Member details retrieved successfully');
  }

  @Post()
  @Roles('admin', 'librarian')
  @ApiOperation({
    summary: 'Register a new member',
    description:
      'Create a new member profile linked to an existing user account. Accessible by librarians and admins.',
  })
  @ApiResponse({
    status: 201,
    description: 'Member registered successfully.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Requires librarian or admin role.',
  })
  @ApiResponse({
    status: 404,
    description: 'User account not found.',
  })
  @ApiResponse({
    status: 409,
    description: 'User already has a member profile.',
  })
  async create(@Body() createMemberDto: CreateMemberDto) {
    const member = await this.membersService.create(createMemberDto);

    return successResponse(member, 'Member registered successfully');
  }

  @Put(':id')
  @Roles('admin', 'librarian')
  @ApiOperation({
    summary: 'Update member details',
    description:
      'Update an existing member profile. Accessible by librarians and admins.',
  })
  @ApiParam({
    name: 'id',
    description: 'Member UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Member updated successfully.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Requires librarian or admin role.',
  })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMemberDto: UpdateMemberDto,
  ) {
    const member = await this.membersService.update(id, updateMemberDto);

    return successResponse(member, 'Member updated successfully');
  }

  @Delete(':id')
  @Roles('admin')
  @ApiOperation({
    summary: 'Deactivate a member',
    description:
      'Soft-delete a member by setting their status to suspended. Admin access only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Member UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Member deactivated successfully.',
  })
  @ApiResponse({ status: 400, description: 'Member is already deactivated.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Requires admin role.',
  })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    const member = await this.membersService.deactivate(id);

    return successResponse(member, 'Member deactivated successfully');
  }

  @Post(':id/renew')
  @Roles('admin', 'librarian')
  @ApiOperation({
    summary: 'Renew membership',
    description:
      'Extend the membership expiry date by 1 year from now and set status to active. Accessible by librarians and admins.',
  })
  @ApiParam({
    name: 'id',
    description: 'Member UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Membership renewed successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Requires librarian or admin role.',
  })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  async renewMembership(@Param('id', ParseUUIDPipe) id: string) {
    const member = await this.membersService.renewMembership(id);

    return successResponse(member, 'Membership renewed successfully');
  }

  @Get(':id/history')
  @Roles('admin', 'librarian', 'member')
  @ApiOperation({
    summary: 'Get borrowing history',
    description:
      'Retrieve the borrowing (transaction) history for a specific member. Librarians/admins can access any member; members can only access their own history.',
  })
  @ApiParam({
    name: 'id',
    description: 'Member UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Borrowing history retrieved successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Cannot access another member borrowing history.',
  })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  async getBorrowingHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
    @CurrentUser() currentUser: any,
  ) {
    // If the user is a regular member, verify they are accessing their own history
    if (currentUser.role === 'member') {
      const memberProfile = await this.membersService.findByUserId(
        currentUser.id,
      );

      if (!memberProfile || memberProfile.id !== id) {
        throw new ForbiddenException(
          'You can only access your own borrowing history.',
        );
      }
    }

    const { transactions, total, page, limit } =
      await this.membersService.getBorrowingHistory(id, query);

    return paginatedResponse(
      transactions,
      total,
      page,
      limit,
      'Borrowing history retrieved successfully',
    );
  }

  @Get(':id/fines')
  @Roles('admin', 'librarian', 'member')
  @ApiOperation({
    summary: 'Get member fines',
    description:
      'Retrieve all fines for a specific member with summary information. Librarians/admins can access any member; members can only access their own fines.',
  })
  @ApiParam({
    name: 'id',
    description: 'Member UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Member fines retrieved successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Cannot access another member fines.',
  })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  async getMemberFines(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: any,
  ) {
    // If the user is a regular member, verify they are accessing their own fines
    if (currentUser.role === 'member') {
      const memberProfile = await this.membersService.findByUserId(
        currentUser.id,
      );

      if (!memberProfile || memberProfile.id !== id) {
        throw new ForbiddenException(
          'You can only access your own fine details.',
        );
      }
    }

    const finesData = await this.membersService.getMemberFines(id);

    return successResponse(finesData, 'Member fines retrieved successfully');
  }

  @Post(':id/id-card')
  @Roles('admin', 'librarian')
  @ApiOperation({
    summary: 'Generate ID card data',
    description:
      'Generate member data formatted for ID card creation. Accessible by librarians and admins.',
  })
  @ApiParam({
    name: 'id',
    description: 'Member UUID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'ID card data generated successfully.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Requires librarian or admin role.',
  })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  async generateIdCard(@Param('id', ParseUUIDPipe) id: string) {
    const idCardData = await this.membersService.generateIdCard(id);

    return successResponse(idCardData, 'ID card data generated successfully');
  }

  @Post(':id/photo')
  @Roles('admin', 'librarian')
  @ApiOperation({
    summary: 'Upload member photo',
    description:
      'Upload a profile photo for a member. Maximum file size: 5MB. Accepted formats: JPEG, PNG, GIF, WebP. Accessible by librarians and admins.',
  })
  @ApiParam({
    name: 'id',
    description: 'Member UUID',
    type: String,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Member photo file',
    schema: {
      type: 'object',
      properties: {
        photo: {
          type: 'string',
          format: 'binary',
          description: 'Photo file (max 5MB, JPEG/PNG/GIF/WebP)',
        },
      },
      required: ['photo'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Photo uploaded successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or no file provided.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Requires librarian or admin role.',
  })
  @ApiResponse({ status: 404, description: 'Member not found.' })
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: photoStorage,
      fileFilter: photoFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No photo file provided. Please upload an image file.',
      );
    }

    const photoUrl = `/uploads/photos/${file.filename}`;
    const member = await this.membersService.updatePhoto(id, photoUrl);

    return successResponse(
      {
        memberId: member.id,
        photoUrl: member.photoUrl,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
      },
      'Photo uploaded successfully',
    );
  }
}
