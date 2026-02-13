import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import { PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    description: 'Unique username for the user account',
    example: 'johndoe',
    minLength: 3,
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  username?: string;

  @ApiPropertyOptional({
    description: 'User email address (must be unique)',
    example: 'john@example.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Password for the account (minimum 8 chars)',
    example: 'SecurePass1',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password?: string;

  @ApiPropertyOptional({
    description: 'Full name of the user',
    example: 'John Doe',
    minLength: 2,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Full name must be at least 2 characters long' })
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Role assigned to the user',
    enum: UserRole,
    example: UserRole.member,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be admin, librarian, or member' })
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Status of the user account',
    enum: UserStatus,
  })
  @IsOptional()
  @IsEnum(UserStatus, { message: 'Status must be active or inactive' })
  status?: UserStatus;
}
