import api from './api';
import { Member, PaginatedResponse, ApiResponse, Transaction, Fine } from '@/types';

export const memberService = {
  async getAll(params?: Record<string, string | number>): Promise<PaginatedResponse<Member>> {
    const { data } = await api.get('/members', { params });
    return data;
  },

  async getById(id: string): Promise<ApiResponse<Member>> {
    const { data } = await api.get(`/members/${id}`);
    return data;
  },

  async create(memberData: Partial<Member>): Promise<ApiResponse<Member>> {
    const { data } = await api.post('/members', memberData);
    return data;
  },

  async update(id: string, memberData: Partial<Member>): Promise<ApiResponse<Member>> {
    const { data } = await api.put(`/members/${id}`, memberData);
    return data;
  },

  async deactivate(id: string): Promise<void> {
    await api.delete(`/members/${id}`);
  },

  async renew(id: string): Promise<ApiResponse<Member>> {
    const { data } = await api.post(`/members/${id}/renew`);
    return data;
  },

  async getHistory(
    id: string,
    params?: Record<string, string | number>,
  ): Promise<PaginatedResponse<Transaction>> {
    const { data } = await api.get(`/members/${id}/history`, { params });
    return data;
  },

  async getFines(id: string): Promise<ApiResponse<Fine[]>> {
    const { data } = await api.get(`/members/${id}/fines`);
    return data;
  },

  async uploadPhoto(id: string, file: File): Promise<ApiResponse<{ url: string }>> {
    const formData = new FormData();
    formData.append('photo', file);
    const { data } = await api.post(`/members/${id}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};
