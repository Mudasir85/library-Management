import {
  Controller,
  Get,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { successResponse, paginatedResponse } from '@/common/utils/response.util';

@Controller()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('search')
  @ApiTags('Search')
  @ApiOperation({
    summary: 'Search books',
    description: 'Full-text search on books with filtering, sorting, and pagination',
  })
  @ApiResponse({ status: 200, description: 'Search results returned successfully' })
  async search(@Query() query: SearchQueryDto) {
    const result = await this.searchService.search(query);

    return paginatedResponse(
      result.books,
      result.pagination.total,
      result.pagination.page,
      result.pagination.limit,
      'Search results retrieved successfully',
    );
  }

  @Get('search/suggestions')
  @ApiTags('Search')
  @ApiOperation({
    summary: 'Get search suggestions',
    description: 'Return top 10 book titles and authors matching a partial term for autocomplete',
  })
  @ApiQuery({
    name: 'term',
    required: false,
    description: 'Partial search term for autocomplete',
    example: 'harry',
  })
  @ApiResponse({ status: 200, description: 'Suggestions returned successfully' })
  async getSuggestions(@Query('term') term: string) {
    const result = await this.searchService.getSuggestions(term);

    return successResponse(result, 'Suggestions retrieved successfully');
  }

  @Get('catalog/browse')
  @ApiTags('Catalog')
  @ApiOperation({
    summary: 'Browse books by category',
    description: 'Group books by category with counts for browsing',
  })
  @ApiResponse({ status: 200, description: 'Categories with book counts returned successfully' })
  async browseByCategory() {
    const result = await this.searchService.browseByCategory();

    return successResponse(result, 'Categories retrieved successfully');
  }

  @Get('catalog/new')
  @ApiTags('Catalog')
  @ApiOperation({
    summary: 'Get new arrivals',
    description: 'Get the newest books ordered by creation date',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of books to return',
    example: 10,
  })
  @ApiResponse({ status: 200, description: 'New arrivals returned successfully' })
  async getNewArrivals(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const result = await this.searchService.getNewArrivals(limit);

    return successResponse(result, 'New arrivals retrieved successfully');
  }

  @Get('catalog/popular')
  @ApiTags('Catalog')
  @ApiOperation({
    summary: 'Get popular books',
    description: 'Get the most popular books based on borrowing frequency',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of books to return',
    example: 10,
  })
  @ApiResponse({ status: 200, description: 'Popular books returned successfully' })
  async getPopular(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const result = await this.searchService.getPopular(limit);

    return successResponse(result, 'Popular books retrieved successfully');
  }
}
