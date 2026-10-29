import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosResponse,
} from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, API_TIMEOUT, STORAGE_KEYS } from '../constants/api';

// ──────────────────────────────────────────
// Axios instance
// ──────────────────────────────────────────
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ──────────────────────────────────────────
// Request interceptor — attach Bearer token
// ──────────────────────────────────────────
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // SecureStore unavailable — continue without token
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ──────────────────────────────────────────
// Response interceptor — normalize errors ONLY
//
// IMPORTANT: We do NOT call clearAuth() here.
// Background polling queries run every 15–30 s; a single transient 401
// (WordPress cookie conflict, brief DB hiccup) would log the user out.
//
// Auth is cleared in exactly two places:
//   1. RootNavigator on mount — validates the stored token via /auth/profile
//   2. ProfileScreen / explicit logout button
//
// All other 401s just surface as error messages that individual screens
// can choose to display or silently ignore (polling queries ignore them).
// ──────────────────────────────────────────
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError<{ success: false; code: string; message: string }>) => {
    if (!error.response) {
      return Promise.reject(new Error('Network error. Please check your connection.'));
    }

    const { status, data } = error.response;

    const message =
      data?.message ||
      (status === 401
        ? 'Session expired. Please log in again.'
        : status === 404
        ? 'Not found.'
        : status >= 500
        ? 'Server error. Please try again later.'
        : 'Request failed.');

    const err = new Error(message) as Error & { status: number };
    err.status = status;
    return Promise.reject(err);
  }
);

export default apiClient;