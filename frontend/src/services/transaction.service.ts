import api from './api';
import { Transaction, PaginatedResponse, ApiResponse } from '@/types';

export const transactionService = {
  async getAll(params?: Record<string, string | number>): Promise<PaginatedResponse<Transaction>> {
    const { data } = await api.get('/transactions', { params });
    return data;
  },

  async getById(id: string): Promise<ApiResponse<Transaction>> {
    const { data } = await api.get(`/transactions/${id}`);
    return data;
  },

  async issueBook(memberId: string, bookId: string): Promise<ApiResponse<Transaction>> {
    const { data } = await api.post('/transactions/issue', { memberId, bookId });
    return data;
  },

  async returnBook(payload: {
    transactionId?: string;
    bookId?: string;
    memberId?: string;
  }): Promise<ApiResponse<Transaction>> {
    const { data } = await api.post('/transactions/return', payload);
    return data;
  },

  async renewBook(transactionId: string): Promise<ApiResponse<Transaction>> {
    const { data } = await api.post('/transactions/renew', { transactionId });
    return data;
  },

  async getOverdue(): Promise<ApiResponse<Transaction[]>> {
    const { data } = await api.get('/transactions/overdue');
    return data;
  },

  async getReceipt(id: string): Promise<ApiResponse<Transaction>> {
    const { data } = await api.post(`/transactions/${id}/receipt`);
    return data;
  },
};
