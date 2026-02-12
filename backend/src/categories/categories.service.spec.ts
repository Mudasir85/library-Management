import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const mockPrismaService = {
  category: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  book: {
    count: jest.fn(),
  },
};

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── findAll ────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return hierarchical category tree', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: 'Fiction',
          description: 'Fiction books',
          parentCategoryId: null,
          subCategories: [
            {
              id: 'cat-2',
              name: 'Science Fiction',
              description: 'Sci-fi books',
              parentCategoryId: 'cat-1',
              subCategories: [],
            },
          ],
        },
        {
          id: 'cat-3',
          name: 'Non-Fiction',
          description: 'Non-fiction books',
          parentCategoryId: null,
          subCategories: [],
        },
      ];

      prisma.category.findMany.mockResolvedValue(mockCategories);

      const result = await service.findAll();

      expect(result).toEqual(mockCategories);
      expect(result).toHaveLength(2);
      expect(prisma.category.findMany).toHaveBeenCalledWith({
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
    });

    it('should return empty array when no categories exist', async () => {
      prisma.category.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return category by ID with parent and sub-categories', async () => {
      const mockCategory = {
        id: 'cat-1',
        name: 'Fiction',
        description: 'Fiction books',
        parentCategoryId: null,
        parentCategory: null,
        subCategories: [
          {
            id: 'cat-2',
            name: 'Science Fiction',
            description: 'Sci-fi books',
            parentCategoryId: 'cat-1',
            subCategories: [],
          },
        ],
      };

      prisma.category.findUnique.mockResolvedValue(mockCategory);

      const result = await service.findOne('cat-1');

      expect(result).toEqual(mockCategory);
      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
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
    });

    it('should throw NotFoundException when category not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        'Category with ID "nonexistent" not found',
      );
    });
  });

  // ─── create ─────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto: CreateCategoryDto = {
      name: 'Science Fiction',
      description: 'Books about futuristic science and technology',
    };

    it('should create a new category successfully', async () => {
      const createdCategory = {
        id: 'cat-new',
        name: 'Science Fiction',
        description: 'Books about futuristic science and technology',
        parentCategoryId: null,
        parentCategory: null,
        subCategories: [],
      };

      prisma.category.findUnique.mockResolvedValue(null); // no name conflict
      prisma.category.create.mockResolvedValue(createdCategory);

      const result = await service.create(createDto);

      expect(result).toEqual(createdCategory);
      expect(prisma.category.findUnique).toHaveBeenCalledWith({
        where: { name: 'Science Fiction' },
      });
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          name: 'Science Fiction',
          description: 'Books about futuristic science and technology',
          parentCategoryId: null,
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
    });

    it('should create a category with a parent category', async () => {
      const dtoWithParent: CreateCategoryDto = {
        name: 'Hard Sci-Fi',
        description: 'Hard science fiction',
        parentCategoryId: 'parent-cat-id',
      };

      const parentCategory = {
        id: 'parent-cat-id',
        name: 'Science Fiction',
      };

      const createdCategory = {
        id: 'cat-new',
        name: 'Hard Sci-Fi',
        description: 'Hard science fiction',
        parentCategoryId: 'parent-cat-id',
        parentCategory: { id: 'parent-cat-id', name: 'Science Fiction' },
        subCategories: [],
      };

      prisma.category.findUnique
        .mockResolvedValueOnce(null) // name check
        .mockResolvedValueOnce(parentCategory); // parent check
      prisma.category.create.mockResolvedValue(createdCategory);

      const result = await service.create(dtoWithParent);

      expect(result).toEqual(createdCategory);
      expect(prisma.category.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException for duplicate name', async () => {
      prisma.category.findUnique.mockResolvedValue({
        id: 'existing-cat',
        name: 'Science Fiction',
      });

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'A category with the name "Science Fiction" already exists',
      );
    });

    it('should throw NotFoundException when parent category does not exist', async () => {
      const dtoWithParent: CreateCategoryDto = {
        name: 'Hard Sci-Fi',
        parentCategoryId: 'nonexistent-parent',
      };

      prisma.category.findUnique
        .mockResolvedValueOnce(null) // name check passes
        .mockResolvedValueOnce(null); // parent check fails

      await expect(service.create(dtoWithParent)).rejects.toThrow(
        new NotFoundException('Parent category with ID "nonexistent-parent" not found'),
      );
    });

    it('should create a category with null description when not provided', async () => {
      const dtoWithoutDesc: CreateCategoryDto = {
        name: 'Mystery',
      };

      prisma.category.findUnique.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({
        id: 'cat-new',
        name: 'Mystery',
        description: null,
        parentCategoryId: null,
        parentCategory: null,
        subCategories: [],
      });

      await service.create(dtoWithoutDesc);

      expect(prisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Mystery',
            description: null,
            parentCategoryId: null,
          }),
        }),
      );
    });
  });

  // ─── update ─────────────────────────────────────────────────────────

  describe('update', () => {
    const existingCategory = {
      id: 'cat-1',
      name: 'Fiction',
      description: 'Fiction books',
      parentCategoryId: null,
    };

    it('should update a category successfully', async () => {
      const updateDto: UpdateCategoryDto = {
        name: 'Literary Fiction',
        description: 'Literary fiction books',
      };

      const updatedCategory = {
        id: 'cat-1',
        name: 'Literary Fiction',
        description: 'Literary fiction books',
        parentCategoryId: null,
        parentCategory: null,
        subCategories: [],
      };

      prisma.category.findUnique
        .mockResolvedValueOnce(existingCategory) // exists check
        .mockResolvedValueOnce(null); // name uniqueness check
      prisma.category.update.mockResolvedValue(updatedCategory);

      const result = await service.update('cat-1', updateDto);

      expect(result).toEqual(updatedCategory);
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: {
          name: 'Literary Fiction',
          description: 'Literary fiction books',
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
    });

    it('should throw NotFoundException when category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.update('nonexistent', { name: 'New Name' }),
      ).rejects.toThrow('Category with ID "nonexistent" not found');
    });

    it('should throw ConflictException when new name conflicts with another category', async () => {
      prisma.category.findUnique
        .mockResolvedValueOnce(existingCategory) // exists check
        .mockResolvedValueOnce({ id: 'cat-other', name: 'Non-Fiction' }); // name conflict

      await expect(
        service.update('cat-1', { name: 'Non-Fiction' }),
      ).rejects.toThrow(
        new ConflictException('A category with the name "Non-Fiction" already exists'),
      );
    });

    it('should not check name uniqueness when name is unchanged', async () => {
      prisma.category.findUnique.mockResolvedValueOnce(existingCategory);
      prisma.category.update.mockResolvedValue({
        ...existingCategory,
        description: 'Updated description',
        parentCategory: null,
        subCategories: [],
      });

      await service.update('cat-1', {
        name: 'Fiction',
        description: 'Updated description',
      });

      // findUnique called only once (for exists check), not for name uniqueness
      expect(prisma.category.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException when setting self as parent', async () => {
      prisma.category.findUnique.mockResolvedValueOnce(existingCategory);

      await expect(
        service.update('cat-1', { parentCategoryId: 'cat-1' }),
      ).rejects.toThrow(
        new BadRequestException('A category cannot be its own parent'),
      );
    });

    it('should throw NotFoundException when parent category does not exist', async () => {
      prisma.category.findUnique
        .mockResolvedValueOnce(existingCategory) // exists check
        .mockResolvedValueOnce(null); // parent check fails

      await expect(
        service.update('cat-1', { parentCategoryId: 'nonexistent-parent' }),
      ).rejects.toThrow(
        new NotFoundException('Parent category with ID "nonexistent-parent" not found'),
      );
    });

    it('should throw BadRequestException for circular reference', async () => {
      // cat-1 is the category being updated
      // cat-child is a child of cat-1
      // We try to set cat-child as parent of cat-1 => circular
      const childCategory = {
        id: 'cat-child',
        name: 'Child Category',
        parentCategoryId: 'cat-1',
      };

      prisma.category.findUnique
        .mockResolvedValueOnce(existingCategory) // exists check for cat-1
        .mockResolvedValueOnce(childCategory) // parent check: cat-child exists
        .mockResolvedValueOnce({ id: 'cat-child', parentCategoryId: 'cat-1' }); // isDescendantOf: cat-child's parent is cat-1

      await expect(
        service.update('cat-1', { parentCategoryId: 'cat-child' }),
      ).rejects.toThrow(
        new BadRequestException('Cannot set a descendant category as the parent (would create circular reference)'),
      );
    });

    it('should allow setting parentCategoryId to null (make top-level)', async () => {
      const categoryWithParent = {
        ...existingCategory,
        parentCategoryId: 'parent-cat',
      };

      prisma.category.findUnique.mockResolvedValueOnce(categoryWithParent);
      prisma.category.update.mockResolvedValue({
        ...categoryWithParent,
        parentCategoryId: null,
        parentCategory: null,
        subCategories: [],
      });

      const result = await service.update('cat-1', {
        parentCategoryId: null as any,
      });

      expect(prisma.category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { parentCategoryId: null },
        }),
      );
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete a category successfully', async () => {
      const category = {
        id: 'cat-1',
        name: 'Fiction',
        description: 'Fiction books',
        parentCategoryId: null,
        subCategories: [],
      };

      prisma.category.findUnique.mockResolvedValue(category);
      prisma.book.count.mockResolvedValue(0);
      prisma.category.delete.mockResolvedValue(category);

      const result = await service.remove('cat-1');

      expect(result).toEqual({
        message: 'Category "Fiction" deleted successfully',
      });
      expect(prisma.category.delete).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
      });
    });

    it('should throw NotFoundException when category does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.remove('nonexistent')).rejects.toThrow(
        'Category with ID "nonexistent" not found',
      );
    });

    it('should throw BadRequestException when category has sub-categories', async () => {
      const category = {
        id: 'cat-1',
        name: 'Fiction',
        description: 'Fiction books',
        parentCategoryId: null,
        subCategories: [
          { id: 'cat-2', name: 'Sci-Fi', parentCategoryId: 'cat-1' },
          { id: 'cat-3', name: 'Fantasy', parentCategoryId: 'cat-1' },
        ],
      };

      prisma.category.findUnique.mockResolvedValue(category);

      await expect(service.remove('cat-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.remove('cat-1')).rejects.toThrow(
        'Cannot delete category "Fiction" because it has 2 sub-categories. Delete or reassign them first.',
      );
    });

    it('should throw BadRequestException when books reference the category', async () => {
      const category = {
        id: 'cat-1',
        name: 'Fiction',
        description: 'Fiction books',
        parentCategoryId: null,
        subCategories: [],
      };

      prisma.category.findUnique.mockResolvedValue(category);
      prisma.book.count.mockResolvedValue(5);

      await expect(service.remove('cat-1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.remove('cat-1')).rejects.toThrow(
        'Cannot delete category "Fiction" because 5 book(s) are assigned to it. Reassign the books first.',
      );
    });

    it('should check books with isDeleted false when counting references', async () => {
      const category = {
        id: 'cat-1',
        name: 'Fiction',
        description: 'Fiction books',
        parentCategoryId: null,
        subCategories: [],
      };

      prisma.category.findUnique.mockResolvedValue(category);
      prisma.book.count.mockResolvedValue(0);
      prisma.category.delete.mockResolvedValue(category);

      await service.remove('cat-1');

      expect(prisma.book.count).toHaveBeenCalledWith({
        where: {
          category: 'Fiction',
          isDeleted: false,
        },
      });
    });
  });
});
