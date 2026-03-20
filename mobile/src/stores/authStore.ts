import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '../services/api';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type UserRole = 'diretoria' | 'coordenacao' | 'gestor' | 'campo';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

// ──────────────────────────────────────────────
// Store
// ──────────────────────────────────────────────

const STORAGE_USER_KEY = 'ber_user';

export const useAuthStore = create<AuthStore>((set) => ({
  // State
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  // Actions
  setUser: (user) =>
    set({
      user,
      isAuthenticated: user !== null && (user.isActive !== false),
    }),

  setToken: (accessToken) =>
    set({ accessToken }),

  logout: () => {
    // Clear persisted tokens – fire-and-forget so the sync state
    // update is immediate while I/O finishes in the background.
    SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN).catch(() => {});
    SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN).catch(() => {});
    SecureStore.deleteItemAsync(STORAGE_USER_KEY).catch(() => {});

    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  hydrate: async () => {
    set({ isLoading: true });

    try {
      const [token, userJson] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN),
        SecureStore.getItemAsync(STORAGE_USER_KEY),
      ]);

      if (token && userJson) {
        const user: User = JSON.parse(userJson);

        set({
          accessToken: token,
          user,
          isAuthenticated: user.isActive,
          isLoading: false,
        });
      } else {
        set({
          accessToken: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch {
      set({
        accessToken: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));

/**
 * Persist user data to SecureStore.
 * Call this after a successful login / profile update.
 */
export async function persistUser(user: User): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_USER_KEY, JSON.stringify(user));
}
