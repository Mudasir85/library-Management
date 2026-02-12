import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all categories with their sub-categories (hierarchical tree).
   * Returns only top-level categories (no parent), each with nested subCategories.
   */
  async findAll() {
    const categories = await this.prisma.category.findMany({
      where: { parentCategoryId: null },
      include: {
        subCategories: {
          include: {
            subCategories: {
              include: {
                subCategories: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return categories;
  }

  /**
   * Get a single category by ID with its parent and sub-categories.
   */
  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parentCategory: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        subCategories: {
          include: {
            subCategories: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    return category;
  }

  /**
   * Create a new category. Ensures name uniqueness and validates parentCategoryId if provided.
   */
  async create(dto: CreateCategoryDto) {
    // Check for name uniqueness
    const existingCategory = await this.prisma.category.findUnique({
      where: { name: dto.name },
    });

    if (existingCategory) {
      throw new ConflictException(
        `A category with the name "${dto.name}" already exists`,
      );
    }

    // Validate parent category exists if provided
    if (dto.parentCategoryId) {
      const parentCategory = await this.prisma.category.findUnique({
        where: { id: dto.parentCategoryId },
      });

      if (!parentCategory) {
        throw new NotFoundException(
          `Parent category with ID "${dto.parentCategoryId}" not found`,
        );
      }
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        parentCategoryId: dto.parentCategoryId ?? null,
      },
      include: {
        parentCategory: {
          select: {
            id: true,
            name: true,
          },
        },
        subCategories: true,
      },
    });

    return category;
  }

  /**
   * Update an existing category. Validates uniqueness of name if changed.
   */
  async update(id: string, dto: UpdateCategoryDto) {
    // Verify category exists
    const existing = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    // Check name uniqueness if name is being changed
    if (dto.name && dto.name !== existing.name) {
      const nameConflict = await this.prisma.category.findUnique({
        where: { name: dto.name },
      });

      if (nameConflict) {
        throw new ConflictException(
          `A category with the name "${dto.name}" already exists`,
        );
      }
    }

    // Validate parent category if provided
    if (dto.parentCategoryId !== undefined) {
      if (dto.parentCategoryId !== null) {
        // Prevent setting self as parent
        if (dto.parentCategoryId === id) {
          throw new BadRequestException(
            'A category cannot be its own parent',
          );
        }

        const parentCategory = await this.prisma.category.findUnique({
          where: { id: dto.parentCategoryId },
        });

        if (!parentCategory) {
          throw new NotFoundException(
            `Parent category with ID "${dto.parentCategoryId}" not found`,
          );
        }

        // Prevent circular references: ensure the proposed parent is not a descendant
        const isDescendant = await this.isDescendantOf(
          dto.parentCategoryId,
          id,
        );
        if (isDescendant) {
          throw new BadRequestException(
            'Cannot set a descendant category as the parent (would create circular reference)',
          );
        }
      }
    }

    const updateData: any = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }

    if (dto.parentCategoryId !== undefined) {
      updateData.parentCategoryId = dto.parentCategoryId;
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: updateData,
      include: {
        parentCategory: {
          select: {
            id: true,
            name: true,
          },
        },
        subCategories: true,
      },
    });

    return category;
  }

  /**
   * Delete a category. Prevents deletion if any books reference this category
   * or if the category has sub-categories.
   */
  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        subCategories: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    // Check if category has sub-categories
    if (category.subCategories.length > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}" because it has ${category.subCategories.length} sub-categories. Delete or reassign them first.`,
      );
    }

    // Check if any books reference this category by name
    const booksCount = await this.prisma.book.count({
      where: {
        category: category.name,
        isDeleted: false,
      },
    });

    if (booksCount > 0) {
      throw new BadRequestException(
        `Cannot delete category "${category.name}" because ${booksCount} book(s) are assigned to it. Reassign the books first.`,
      );
    }

    await this.prisma.category.delete({
      where: { id },
    });

    return { message: `Category "${category.name}" deleted successfully` };
  }

  /**
   * Check if a category is a descendant of another category.
   * Used to prevent circular parent-child references.
   */
  private async isDescendantOf(
    categoryId: string,
    potentialAncestorId: string,
  ): Promise<boolean> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { parentCategoryId: true },
    });

    if (!category || !category.parentCategoryId) {
      return false;
    }

    if (category.parentCategoryId === potentialAncestorId) {
      return true;
    }

    return this.isDescendantOf(category.parentCategoryId, potentialAncestorId);
  }
}
