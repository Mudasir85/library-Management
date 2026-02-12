import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '@/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * In-memory store for password reset tokens.
   * Maps token -> { userId, expiresAt }
   * In production, this should be stored in Redis or the database.
   */
  private readonly resetTokens = new Map<
    string,
    { userId: string; expiresAt: Date }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Register a new user account.
   * Admins can create any role. When role is 'member', a corresponding
   * Member record is also created with sensible defaults.
   */
  async register(dto: RegisterDto) {
    // Check for existing username
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException('Username is already taken');
    }

    // Check for existing email
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('Email is already registered');
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    // Create the user (and optionally a member record) in a transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          role: dto.role,
        },
      });

      // If the role is member, create a corresponding Member record
      if (dto.role === 'member') {
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 1);

        await tx.member.create({
          data: {
            userId: newUser.id,
            fullName: dto.fullName,
            email: dto.email,
            phone: '',
            address: '',
            city: '',
            memberType: 'public',
            expiryDate,
          },
        });
      }

      return newUser;
    });

    this.logger.log(
      `User registered: ${user.username} (${user.role}) [${user.id}]`,
    );

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  /**
   * Validate a user's credentials.
   * Returns the user object (without passwordHash) if valid, or null otherwise.
   */
  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return null;
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException(
        'Account is inactive. Please contact an administrator.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const { passwordHash: _, ...result } = user;
    return result;
  }

  /**
   * Generate a JWT access token for an authenticated user.
   */
  async login(user: { id: string; username: string; role: string }) {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }

  /**
   * Retrieve the profile of the currently authenticated user.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        lastLogin: true,
        status: true,
        member: {
          select: {
            id: true,
            memberType: true,
            registrationDate: true,
            expiryDate: true,
            status: true,
            booksIssuedCount: true,
            outstandingFines: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Change the password for the currently authenticated user.
   */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify the old password
    const isOldPasswordValid = await bcrypt.compare(
      oldPassword,
      user.passwordHash,
    );
    if (!isOldPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Ensure new password is different from old password
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    // Hash and save the new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    this.logger.log(`Password changed for user [${userId}]`);

    return { message: 'Password changed successfully' };
  }

  /**
   * Generate a password reset token for the given email.
   * In production, this would send an email with the reset link.
   * For now, we store the token in memory and log it.
   */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration attacks
    if (!user) {
      this.logger.warn(
        `Password reset requested for non-existent email: ${email}`,
      );
      return {
        message:
          'If an account with that email exists, a password reset link has been sent.',
      };
    }

    if (user.status !== 'active') {
      this.logger.warn(
        `Password reset requested for inactive account: ${email}`,
      );
      return {
        message:
          'If an account with that email exists, a password reset link has been sent.',
      };
    }

    // Generate a unique reset token
    const resetToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Store the token
    this.resetTokens.set(resetToken, {
      userId: user.id,
      expiresAt,
    });

    // In production, send an email with the reset link
    // For now, log the token
    this.logger.log(
      `Password reset token generated for user [${user.id}]: ${resetToken}`,
    );

    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  /**
   * Reset the user's password using a valid reset token.
   */
  async resetPassword(token: string, newPassword: string) {
    const tokenData = this.resetTokens.get(token);

    if (!tokenData) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if the token has expired
    if (new Date() > tokenData.expiresAt) {
      this.resetTokens.delete(token);
      throw new BadRequestException('Reset token has expired');
    }

    // Verify the user still exists and is active
    const user = await this.prisma.user.findUnique({
      where: { id: tokenData.userId },
    });

    if (!user) {
      this.resetTokens.delete(token);
      throw new NotFoundException('User not found');
    }

    if (user.status !== 'active') {
      this.resetTokens.delete(token);
      throw new BadRequestException(
        'Account is inactive. Please contact an administrator.',
      );
    }

    // Hash and save the new password
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id: tokenData.userId },
      data: { passwordHash: newPasswordHash },
    });

    // Invalidate the token after use
    this.resetTokens.delete(token);

    this.logger.log(`Password reset successfully for user [${tokenData.userId}]`);

    return { message: 'Password has been reset successfully' };
  }
}
