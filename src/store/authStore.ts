import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User, UserRole } from '../types';
import { STORAGE_KEYS } from '../constants/api';

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;       // true only during the INITIAL startup token check
  isAuthenticated: boolean;

  // Actions
  setAuth: (token: string, user: User) => Promise<void>;
  clearAuth: () => Promise<void>;
  updateUser: (user: User) => void;

  /**
   * Validates the persisted token against /auth/profile.
   *
   * @param isInitial  When true (app startup), shows the splash via isLoading.
   *                   When false (foreground re-validation), DOES NOT touch
   *                   isLoading — so the navigator is NOT unmounted.
   *
   * WHY THIS MATTERS:
   *   RootNavigator returns a splash screen whenever isLoading === true, which
   *   unmounts the ENTIRE navigation tree. Showing a permission dialog (camera,
   *   location) briefly backgrounds the app; on return, the AppState listener
   *   re-validates. If that re-validation set isLoading=true, the navigator
   *   would unmount and remount, dumping the user back on the default screen
   *   (Dashboard) and destroying whatever screen they were on. Passing
   *   isInitial=false keeps the navigator mounted during these silent re-checks.
   */
  loadAndValidateAuth: (isInitial?: boolean) => Promise<void>;

  hasRole: (role: UserRole) => boolean;
  isTechnician: () => boolean;
  isCustomer: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: async (token: string, user: User) => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, token);
      await SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    } catch {
      // Fallback: in-memory only
    }
    set({ token, user, isAuthenticated: true, isLoading: false });
  },

  clearAuth: async () => {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
    } catch {
      // ignore
    }
    set({ token: null, user: null, isAuthenticated: false, isLoading: false });
  },

  updateUser: (user: User) => {
    set({ user });
    SecureStore.setItemAsync(STORAGE_KEYS.USER_DATA, JSON.stringify(user)).catch(() => {});
  },

  loadAndValidateAuth: async (isInitial = false) => {
    // Only show the splash on the very first startup validation.
    // Foreground re-validations must NOT unmount the navigator.
    if (isInitial) {
      set({ isLoading: true });
    }

    let token: string | null = null;
    let cachedUser: User | null = null;

    // Step 1: read from SecureStore
    try {
      const storedToken = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
      const storedUser = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);
      if (storedToken && storedUser) {
        token = storedToken;
        cachedUser = JSON.parse(storedUser) as User;
      }
    } catch {
      // SecureStore read failed — treat as logged out
    }

    if (!token || !cachedUser) {
      // Only flip isAuthenticated on initial load. On a background re-check with
      // no token we still want to end up logged out, which is correct either way.
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    // Step 2: validate token against the server
    // Lazy import avoids a circular dependency at module load time.
    try {
      const { default: apiClient } = await import('./apiClient');
      const response = await apiClient.get('/auth/profile', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000,
      });
      const serverUser: User = response.data?.user ?? cachedUser;
      set({ token, user: serverUser, isAuthenticated: true, isLoading: false });
    } catch (err: any) {
      if (err?.status === 401) {
        // Token genuinely expired/revoked — clear everything
        try {
          await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);
          await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_DATA);
        } catch {}
        set({ token: null, user: null, isAuthenticated: false, isLoading: false });
      } else {
        // Network error or server down — trust the cached token so the user
        // stays logged in and can retry when connectivity is restored.
        set({ token, user: cachedUser, isAuthenticated: true, isLoading: false });
      }
    }
  },

  hasRole: (role: UserRole) => {
    const user = get().user;
    return user?.roles?.includes(role) ?? false;
  },

  isTechnician: () => {
    const user = get().user;
    return (
      user?.roles?.includes('ev360_technician') === true ||
      user?.roles?.includes('administrator') === true
    );
  },

  isCustomer: () => {
    const user = get().user;
    return user?.roles?.includes('ev360_customer') === true;
  },
}));