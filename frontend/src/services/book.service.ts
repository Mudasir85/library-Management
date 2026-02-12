import api from './api';
import { Book, PaginatedResponse, ApiResponse, Category } from '@/types';

export const bookService = {
  async getAll(params?: Record<string, string | number | boolean>): Promise<PaginatedResponse<Book>> {
    const { data } = await api.get('/books', { params });
    return data;
  },

  async getById(id: string): Promise<ApiResponse<Book>> {
    const { data } = await api.get(`/books/${id}`);
    return data;
  },

  async create(bookData: Partial<Book>): Promise<ApiResponse<Book>> {
    const { data } = await api.post('/books', bookData);
    return data;
  },

  async update(id: string, bookData: Partial<Book>): Promise<ApiResponse<Book>> {
    const { data } = await api.put(`/books/${id}`, bookData);
    return data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/books/${id}`);
  },

  async bulkImport(file: File): Promise<ApiResponse<{ imported: number; errors: string[] }>> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/books/bulk-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async getCategories(): Promise<ApiResponse<Category[]>> {
    const { data } = await api.get('/categories');
    return data;
  },
};
