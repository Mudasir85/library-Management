import api from './api';
import { AuthResponse, LoginCredentials, User } from '@/types';

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data } = await api.post('/auth/login', credentials);
    return data;
  },

  async register(userData: {
    username: string;
    email: string;
    password: string;
    fullName: string;
    role: string;
  }): Promise<{ data: User }> {
    try {
      const { data } = await api.post('/users', userData);
      return data;
    } catch (error: any) {
      if (error?.response?.status !== 404) {
        throw error;
      }

      const { data } = await api.post('/auth/register', userData);
      return data;
    }
  },

  async getProfile(): Promise<User> {
    const { data } = await api.get('/auth/me');
    return data.data;
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await api.put('/auth/change-password', { oldPassword, newPassword });
  },

  async forgotPassword(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await api.post('/auth/reset-password', { token, newPassword });
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
};
