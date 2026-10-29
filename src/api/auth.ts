import apiClient from './client';
import { ENDPOINTS } from '../constants/api';
import {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
  User,
} from '../types';

export const authApi = {
  /**
   * POST /auth/register
   * Creates an ev360_customer account and returns a Bearer token.
   */
  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>(ENDPOINTS.AUTH_REGISTER, {
      ...payload,
      device_name: payload.device_name || 'EV360 Mobile App',
    });
    return data;
  },

  /**
   * POST /auth/login
   */
  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>(ENDPOINTS.AUTH_LOGIN, {
      ...payload,
      device_name: payload.device_name || 'EV360 Mobile App',
    });
    return data;
  },

  /**
   * POST /auth/logout — revokes the current Bearer token
   */
  logout: async (): Promise<void> => {
    await apiClient.post(ENDPOINTS.AUTH_LOGOUT);
  },

  /**
   * GET /auth/profile
   */
  getProfile: async (): Promise<{ success: boolean; user: User }> => {
    const { data } = await apiClient.get(ENDPOINTS.AUTH_PROFILE);
    return data;
  },

  /**
   * PATCH /auth/profile
   */
  updateProfile: async (
    payload: UpdateProfilePayload
  ): Promise<{ success: boolean; user: User }> => {
    const { data } = await apiClient.patch(ENDPOINTS.AUTH_PROFILE, payload);
    return data;
  },
};