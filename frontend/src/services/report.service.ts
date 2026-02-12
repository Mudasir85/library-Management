import api from './api';
import { ApiResponse, DashboardStats } from '@/types';

export const reportService = {
  async getDashboard(): Promise<ApiResponse<DashboardStats>> {
    const { data } = await api.get('/reports/dashboard');
    return data;
  },

  async getPopularBooks(limit = 10): Promise<ApiResponse<{ bookId: string; title: string; author: string; count: number }[]>> {
    const { data } = await api.get('/reports/books/popular', { params: { limit } });
    return data;
  },

  async getInventoryStatus(): Promise<ApiResponse<Record<string, unknown>>> {
    const { data } = await api.get('/reports/books/inventory');
    return data;
  },

  async getOverdueReport(): Promise<ApiResponse<Record<string, unknown>[]>> {
    const { data } = await api.get('/reports/books/overdue');
    return data;
  },

  async getMemberStats(): Promise<ApiResponse<Record<string, unknown>>> {
    const { data } = await api.get('/reports/members/stats');
    return data;
  },

  async getTransactionReport(
    fromDate?: string,
    toDate?: string,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    const { data } = await api.get('/reports/transactions', { params: { fromDate, toDate } });
    return data;
  },

  async getFinancialReport(
    fromDate?: string,
    toDate?: string,
  ): Promise<ApiResponse<Record<string, unknown>>> {
    const { data } = await api.get('/reports/financial', { params: { fromDate, toDate } });
    return data;
  },

  async exportReport(reportType: string, format: string, params?: Record<string, string>): Promise<Blob> {
    const { data } = await api.post(
      '/reports/export',
      { reportType, format, ...params },
      { responseType: 'blob' },
    );
    return data;
  },
};
