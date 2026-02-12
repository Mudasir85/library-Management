import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsUUID,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';

export enum Gender {
  male = 'male',
  female = 'female',
  other = 'other',
}

export enum MemberType {
  student = 'student',
  faculty = 'faculty',
  public = 'public',
}

export class CreateMemberDto {
  @ApiProperty({
    description: 'UUID of the existing user account to link this member to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Full name of the member',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiPropertyOptional({
    description: 'Date of birth in ISO 8601 format',
    example: '1995-06-15',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Gender of the member',
    enum: Gender,
    example: Gender.male,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({
    description: 'Email address of the member',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Phone number of the member',
    example: '+1-555-123-4567',
  })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({
    description: 'Street address of the member',
    example: '123 Main Street',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'City of residence',
    example: 'Springfield',
  })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({
    description: 'Postal / ZIP code',
    example: '62704',
  })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiProperty({
    description: 'Type of membership',
    enum: MemberType,
    example: MemberType.student,
  })
  @IsEnum(MemberType)
  memberType: MemberType;

  @ApiPropertyOptional({
    description: 'Department or faculty (relevant for student/faculty members)',
    example: 'Computer Science',
  })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    description: 'Student ID or Employee ID',
    example: 'STU-2024-001',
  })
  @IsOptional()
  @IsString()
  studentEmployeeId?: string;
}
