import api from './api';
import { Reservation, ApiResponse } from '@/types';

export const reservationService = {
  async create(bookId: string): Promise<ApiResponse<Reservation>> {
    const { data } = await api.post('/reservations', { bookId });
    return data;
  },

  async cancel(id: string): Promise<void> {
    await api.delete(`/reservations/${id}`);
  },

  async getByMember(memberId: string): Promise<ApiResponse<Reservation[]>> {
    const { data } = await api.get(`/reservations/member/${memberId}`);
    return data;
  },

  async getByBook(bookId: string): Promise<ApiResponse<Reservation[]>> {
    const { data } = await api.get(`/reservations/book/${bookId}`);
    return data;
  },

  async fulfill(id: string): Promise<ApiResponse<Reservation>> {
    const { data } = await api.put(`/reservations/${id}/fulfill`);
    return data;
  },
};
