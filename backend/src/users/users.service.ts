import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
        lastLogin: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    try {
      const user = await this.prisma.user.create({
        data: {
          username: dto.username.trim(),
          email: dto.email.trim().toLowerCase(),
          passwordHash,
          fullName: dto.fullName.trim(),
          role: dto.role,
          status: dto.status,
        },
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          createdAt: true,
          lastLogin: true,
        },
      });

      return user;
    } catch (error) {
      this.throwUniqueConstraintError(error, dto.username, dto.email);
      throw error;
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (dto.username !== undefined) {
      updateData.username = dto.username.trim();
    }
    if (dto.email !== undefined) {
      updateData.email = dto.email.trim().toLowerCase();
    }
    if (dto.fullName !== undefined) {
      updateData.fullName = dto.fullName.trim();
    }
    if (dto.role !== undefined) {
      updateData.role = dto.role;
    }
    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }
    if (dto.password !== undefined && dto.password.length > 0) {
      updateData.passwordHash = await bcrypt.hash(
        dto.password,
        BCRYPT_SALT_ROUNDS,
      );
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          createdAt: true,
          lastLogin: true,
        },
      });
    } catch (error) {
      this.throwUniqueConstraintError(
        error,
        dto.username ?? existing.username,
        dto.email ?? existing.email,
      );
      throw error;
    }
  }

  async remove(id: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    await this.prisma.user.delete({ where: { id } });

    return { message: 'User deleted successfully' };
  }

  private throwUniqueConstraintError(
    error: unknown,
    username: string,
    email: string,
  ) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta?.target
        : [];

      if (target.includes('username')) {
        throw new ConflictException(
          `Username "${username}" is already in use`,
        );
      }

      if (target.includes('email')) {
        throw new ConflictException(`Email "${email}" is already in use`);
      }

      throw new ConflictException('A unique field already exists');
    }
  }
}
