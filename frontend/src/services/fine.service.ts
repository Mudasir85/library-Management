import api from './api';
import { Fine, ApiResponse, PaginatedResponse, PaymentMethod } from '@/types';

export const fineService = {
  async getAll(params?: Record<string, string | number>): Promise<PaginatedResponse<Fine>> {
    const { data } = await api.get('/fines', { params });
    return data;
  },

  async getByMember(memberId: string): Promise<ApiResponse<Fine[]>> {
    const { data } = await api.get(`/fines/member/${memberId}`);
    return data;
  },

  async getOutstanding(): Promise<ApiResponse<Fine[]>> {
    const { data } = await api.get('/fines/outstanding');
    return data;
  },

  async processPayment(
    fineId: string,
    amount: number,
    paymentMethod: PaymentMethod,
  ): Promise<ApiResponse<Fine>> {
    const { data } = await api.post('/fines/pay', { fineId, amount, paymentMethod });
    return data;
  },

  async waive(fineId: string): Promise<ApiResponse<Fine>> {
    const { data } = await api.post(`/fines/${fineId}/waive`);
    return data;
  },

  async recordLostBook(payload: {
    transactionId: string;
    memberId: string;
    bookId: string;
    description?: string;
  }): Promise<ApiResponse<Fine>> {
    const { data } = await api.post('/fines/lost-book', payload);
    return data;
  },

  async recordDamage(payload: {
    memberId: string;
    bookId: string;
    damagePercent: number;
    transactionId?: string;
    description?: string;
  }): Promise<ApiResponse<Fine>> {
    const { data } = await api.post('/fines/damage', payload);
    return data;
  },
};
