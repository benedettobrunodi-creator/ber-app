import { create } from 'zustand';
import api from '@/lib/api';

export type UserRole = 'diretoria' | 'coordenacao' | 'gestor' | 'campo';

export interface CustomRole {
  id: string;
  name: string;
  permissions: Record<string, boolean>;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  customRole?: CustomRole | null;
}

/** Default permissions for built-in roles (fallback when customRole is not set) */
const DEFAULT_PERMS: Record<UserRole, Record<string, boolean>> = {
  diretoria:   { dashboard: true,  obras: true,  kanban: true,  sequenciamento: true,  checklists: true,  recebimentos: true,  pmo: true,  seguranca: true,  normas: true,  instrucoes: true,  ponto: true,  dre: true,  configuracoes: true  },
  coordenacao: { dashboard: true,  obras: true,  kanban: true,  sequenciamento: true,  checklists: true,  recebimentos: true,  pmo: true,  seguranca: true,  normas: true,  instrucoes: true,  ponto: true,  dre: true,  configuracoes: true  },
  gestor:      { dashboard: true,  obras: true,  kanban: true,  sequenciamento: true,  checklists: true,  recebimentos: true,  pmo: true,  seguranca: true,  normas: true,  instrucoes: true,  ponto: true,  dre: false, configuracoes: false },
  campo:       { dashboard: false, obras: false, kanban: false, sequenciamento: false, checklists: false, recebimentos: false, pmo: false, seguranca: false, normas: false, instrucoes: false, ponto: true,  dre: false, configuracoes: false },
};

/** Get the effective permissions for a user */
export function getUserPermissions(user: User | null): Record<string, boolean> {
  if (!user) return {};
  if (user.customRole?.permissions) return user.customRole.permissions;
  return DEFAULT_PERMS[user.role] ?? {};
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,

  login: async (email, password) => {
    const res = await api.post<{
      data: { accessToken: string; refreshToken: string; user: User };
    }>('/auth/login', { email, password });

    const { accessToken, refreshToken, user } = res.data.data;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));

    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  hydrate: () => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const userRaw = localStorage.getItem('user');

    if (accessToken && refreshToken && userRaw) {
      try {
        const user = JSON.parse(userRaw) as User;
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      } catch {
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      }
    }
  },
}));
