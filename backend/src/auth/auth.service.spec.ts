import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RegisterDto, UserRole } from './dto/register.dto';

jest.mock('bcrypt');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid-token'),
}));

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  member: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: typeof mockPrismaService;
  let jwtService: typeof mockJwtService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── register ───────────────────────────────────────────────────────

  describe('register', () => {
    const registerDto: RegisterDto = {
      username: 'johndoe',
      email: 'john@example.com',
      password: 'SecurePass1',
      fullName: 'John Doe',
      role: UserRole.MEMBER,
    };

    it('should register a new user successfully', async () => {
      // No existing username or email
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // username check
        .mockResolvedValueOnce(null); // email check

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const createdUser = {
        id: 'user-1',
        username: 'johndoe',
        email: 'john@example.com',
        fullName: 'John Doe',
        role: 'member',
        status: 'active',
        createdAt: new Date('2024-01-01'),
        passwordHash: 'hashed-password',
      };

      // $transaction receives a callback; we simulate it by invoking the callback
      // with a "tx" proxy that delegates to the same mock
      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue(createdUser),
          },
          member: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });

      const result = await service.register(registerDto);

      expect(result).toEqual({
        id: 'user-1',
        username: 'johndoe',
        email: 'john@example.com',
        fullName: 'John Doe',
        role: 'member',
        status: 'active',
        createdAt: createdUser.createdAt,
      });

      expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'johndoe' },
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass1', 12);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException for duplicate username', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'existing-user',
        username: 'johndoe',
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException('Username is already taken'),
      );
    });

    it('should throw ConflictException for duplicate email', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // username check passes
        .mockResolvedValueOnce({ id: 'existing-user', email: 'john@example.com' }); // email check fails

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create a member record when role is member', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const memberCreateMock = jest.fn().mockResolvedValue({});
      const userCreateMock = jest.fn().mockResolvedValue({
        id: 'user-1',
        username: 'johndoe',
        email: 'john@example.com',
        fullName: 'John Doe',
        role: 'member',
        status: 'active',
        createdAt: new Date(),
        passwordHash: 'hashed-password',
      });

      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
        const tx = {
          user: { create: userCreateMock },
          member: { create: memberCreateMock },
        };
        return fn(tx);
      });

      await service.register(registerDto);

      expect(memberCreateMock).toHaveBeenCalledTimes(1);
      expect(memberCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            fullName: 'John Doe',
            email: 'john@example.com',
            memberType: 'public',
          }),
        }),
      );
    });

    it('should NOT create a member record when role is admin', async () => {
      const adminDto: RegisterDto = {
        ...registerDto,
        role: UserRole.ADMIN,
      };

      prisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const memberCreateMock = jest.fn();
      const userCreateMock = jest.fn().mockResolvedValue({
        id: 'user-1',
        username: 'johndoe',
        email: 'john@example.com',
        fullName: 'John Doe',
        role: 'admin',
        status: 'active',
        createdAt: new Date(),
        passwordHash: 'hashed-password',
      });

      prisma.$transaction.mockImplementation(async (fn: (tx: any) => any) => {
        const tx = {
          user: { create: userCreateMock },
          member: { create: memberCreateMock },
        };
        return fn(tx);
      });

      await service.register(adminDto);

      expect(memberCreateMock).not.toHaveBeenCalled();
    });
  });

  // ─── validateUser ───────────────────────────────────────────────────

  describe('validateUser', () => {
    const mockUser = {
      id: 'user-1',
      username: 'johndoe',
      email: 'john@example.com',
      fullName: 'John Doe',
      passwordHash: 'hashed-password',
      role: 'member',
      status: 'active',
      createdAt: new Date(),
      lastLogin: null,
    };

    it('should validate user with correct credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({ ...mockUser, lastLogin: new Date() });

      const result = await service.validateUser('johndoe', 'SecurePass1');

      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('passwordHash');
      expect(result!.id).toBe('user-1');
      expect(result!.username).toBe('johndoe');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'johndoe' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('SecurePass1', 'hashed-password');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lastLogin: expect.any(Date) },
      });
    });

    it('should return null for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent', 'password');

      expect(result).toBeNull();
    });

    it('should return null for wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('johndoe', 'WrongPass1');

      expect(result).toBeNull();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: 'inactive',
      });

      await expect(
        service.validateUser('johndoe', 'SecurePass1'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.validateUser('johndoe', 'SecurePass1'),
      ).rejects.toThrow('Account is inactive. Please contact an administrator.');
    });
  });

  // ─── login ──────────────────────────────────────────────────────────

  describe('login', () => {
    it('should generate JWT token on login', async () => {
      const user = { id: 'user-1', username: 'johndoe', role: 'member' };
      jwtService.sign.mockReturnValue('jwt-token-string');

      const result = await service.login(user);

      expect(result).toEqual({
        accessToken: 'jwt-token-string',
        user: {
          id: 'user-1',
          username: 'johndoe',
          role: 'member',
        },
      });

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        username: 'johndoe',
        role: 'member',
      });
    });
  });

  // ─── getProfile ─────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('should get user profile', async () => {
      const mockProfile = {
        id: 'user-1',
        username: 'johndoe',
        email: 'john@example.com',
        fullName: 'John Doe',
        role: 'member',
        createdAt: new Date(),
        lastLogin: new Date(),
        status: 'active',
        member: {
          id: 'member-1',
          memberType: 'public',
          registrationDate: new Date(),
          expiryDate: new Date(),
          status: 'active',
          booksIssuedCount: 2,
          outstandingFines: 0,
        },
      };

      prisma.user.findUnique.mockResolvedValue(mockProfile);

      const result = await service.getProfile('user-1');

      expect(result).toEqual(mockProfile);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
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
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getProfile('nonexistent')).rejects.toThrow(
        'User not found',
      );
    });
  });

  // ─── changePassword ─────────────────────────────────────────────────

  describe('changePassword', () => {
    const mockUser = {
      id: 'user-1',
      username: 'johndoe',
      passwordHash: 'old-hashed-password',
    };

    it('should change password successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)   // old password is valid
        .mockResolvedValueOnce(false); // new password is different
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      prisma.user.update.mockResolvedValue({});

      const result = await service.changePassword(
        'user-1',
        'OldSecurePass1',
        'NewSecurePass1',
      );

      expect(result).toEqual({ message: 'Password changed successfully' });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'OldSecurePass1',
        'old-hashed-password',
      );
      expect(bcrypt.hash).toHaveBeenCalledWith('NewSecurePass1', 12);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'new-hashed-password' },
      });
    });

    it('should throw BadRequestException for wrong old password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false); // old password check fails

      await expect(
        service.changePassword('user-1', 'WrongOldPass1', 'NewSecurePass1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.changePassword('user-1', 'WrongOldPass1', 'NewSecurePass1'),
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should throw BadRequestException when new password is same as old', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true)  // old password is valid
        .mockResolvedValueOnce(true); // new password is same as old

      await expect(
        service.changePassword('user-1', 'OldSecurePass1', 'OldSecurePass1'),
      ).rejects.toThrow(
        new BadRequestException(
          'New password must be different from the current password',
        ),
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.changePassword('nonexistent', 'OldPass1', 'NewPass1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── forgotPassword ─────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should handle forgot password and return success message', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        status: 'active',
      });

      const result = await service.forgotPassword('john@example.com');

      expect(result).toEqual({
        message:
          'If an account with that email exists, a password reset link has been sent.',
      });
    });

    it('should return success message even for non-existent email (prevent enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@example.com');

      expect(result).toEqual({
        message:
          'If an account with that email exists, a password reset link has been sent.',
      });
    });

    it('should return success message for inactive account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        status: 'inactive',
      });

      const result = await service.forgotPassword('john@example.com');

      expect(result).toEqual({
        message:
          'If an account with that email exists, a password reset link has been sent.',
      });
    });
  });

  // ─── resetPassword ──────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      // First, trigger forgotPassword to store a token
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        status: 'active',
      });

      await service.forgotPassword('john@example.com');

      // Now reset using the mocked uuid token
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: 'active',
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      prisma.user.update.mockResolvedValue({});

      const result = await service.resetPassword(
        'mocked-uuid-token',
        'NewSecurePass1',
      );

      expect(result).toEqual({
        message: 'Password has been reset successfully',
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('NewSecurePass1', 12);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'new-hashed-password' },
      });
    });

    it('should throw BadRequestException for invalid token', async () => {
      await expect(
        service.resetPassword('invalid-token', 'NewSecurePass1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resetPassword('invalid-token', 'NewSecurePass1'),
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should throw BadRequestException for expired token', async () => {
      // We need to inject an expired token into the service's internal map.
      // We do this by calling forgotPassword and then manipulating the expiry.
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        status: 'active',
      });

      await service.forgotPassword('john@example.com');

      // Access private resetTokens map via type assertion
      const resetTokens = (service as any).resetTokens as Map<
        string,
        { userId: string; expiresAt: Date }
      >;
      const tokenData = resetTokens.get('mocked-uuid-token');
      if (tokenData) {
        tokenData.expiresAt = new Date(Date.now() - 3600000); // Set to 1 hour ago
      }

      await expect(
        service.resetPassword('mocked-uuid-token', 'NewSecurePass1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resetPassword('mocked-uuid-token', 'NewSecurePass1'),
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should throw NotFoundException if user no longer exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        status: 'active',
      });

      await service.forgotPassword('john@example.com');

      // User no longer exists when reset is attempted
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword('mocked-uuid-token', 'NewSecurePass1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user is inactive during reset', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'john@example.com',
        status: 'active',
      });

      await service.forgotPassword('john@example.com');

      // User is now inactive
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        status: 'inactive',
      });

      await expect(
        service.resetPassword('mocked-uuid-token', 'NewSecurePass1'),
      ).rejects.toThrow(
        new BadRequestException(
          'Account is inactive. Please contact an administrator.',
        ),
      );
    });
  });
});
