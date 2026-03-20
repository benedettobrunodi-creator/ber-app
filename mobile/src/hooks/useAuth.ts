import { useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore, persistUser } from '../stores/authStore';
import { STORAGE_KEYS } from '../services/api';
import api from '../services/api';

// ──────────────────────────────────────────────
// API response shapes
// ──────────────────────────────────────────────

interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'diretoria' | 'coordenacao' | 'gestor' | 'campo';
    phone?: string;
    avatarUrl?: string;
    isActive: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const setUser = useAuthStore((s) => s.setUser);
  const setToken = useAuthStore((s) => s.setToken);
  const storeLogout = useAuthStore((s) => s.logout);
  const hydrate = useAuthStore((s) => s.hydrate);

  /**
   * Authenticate the user with email and password.
   * Persists tokens + user data to SecureStore and updates Zustand state.
   */
  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const response = await api.post<{ data: LoginResponse }>('/auth/login', {
        email,
        password,
      });

      const { user: userData, accessToken, refreshToken } = response.data.data;

      // Persist tokens
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
        SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
        persistUser(userData),
      ]);

      // Update store
      setToken(accessToken);
      setUser(userData);
    },
    [setUser, setToken],
  );

  /**
   * Sign out: clear tokens, disconnect any socket, and reset store.
   */
  const logout = useCallback(async (): Promise<void> => {
    // Best-effort server-side logout (ignore failures)
    try {
      await api.post('/auth/logout');
    } catch {
      // Swallow – we log out locally regardless
    }

    storeLogout();
  }, [storeLogout]);

  /**
   * Attempt to restore the session from SecureStore and validate the token
   * by fetching the user profile from the API.
   */
  const checkAuth = useCallback(async (): Promise<void> => {
    // First, hydrate from SecureStore so the UI renders immediately
    await hydrate();

    const token = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return;

    try {
      const response = await api.get<{ data: LoginResponse['user'] }>(
        '/auth/me',
      );
      const freshUser = response.data.data;

      await persistUser(freshUser);
      setUser(freshUser);
    } catch {
      // Token invalid / expired and refresh also failed (interceptor handles refresh).
      // The 401 interceptor already clears tokens, so just reset state.
      storeLogout();
    }
  }, [hydrate, setUser, storeLogout]);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuth,
  } as const;
}
