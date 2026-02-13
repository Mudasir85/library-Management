import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'Unique username for the user account',
    example: 'johndoe',
    minLength: 3,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  username: string;

  @ApiProperty({
    description: 'User email address (must be unique)',
    example: 'john@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Password for the account',
    example: 'SecurePass1',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  password: string;

  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
    minLength: 2,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Full name must be at least 2 characters long' })
  fullName: string;

  @ApiProperty({
    description: 'Role assigned to the user',
    enum: UserRole,
    example: UserRole.member,
  })
  @IsEnum(UserRole, { message: 'Role must be admin, librarian, or member' })
  role: UserRole;

  @ApiPropertyOptional({
    description: 'Status of the user account',
    enum: UserStatus,
    default: UserStatus.active,
  })
  @IsOptional()
  @IsEnum(UserStatus, { message: 'Status must be active or inactive' })
  status?: UserStatus;
}
