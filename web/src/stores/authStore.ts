import { create } from 'zustand';
import api from '@/lib/api';

export type UserRole =
  | 'socio' | 'diretoria' | 'coordenacao' | 'pmo' | 'engenharia'
  | 'financeiro' | 'gestor' | 'compras' | 'orcamentos' | 'campo';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  permissions: Record<string, boolean>;
}

const ALL_OFF: Record<string, boolean> = {
  dashboard: false, obras: false, kanban: false, checklists: false, diario: false,
  recebimentos: false, seguranca: false, normas: false, instrucoes: false, ponto: false,
  orcamentos: false, organograma: false, configuracoes: false, admin: false,
  comprasDashboard: false, aditivos: false, contratacoes: false, atas: false,
  documentos: false, stakeholders: false, kickoff: false, raci: false,
  contratacaoPlano: false, histograma: false,
};

/** Default permissions per cargo — used when user has no explicit permissions set.
 *  All roles start with no access; socio keeps admin so the owner can always manage users. */
const DEFAULT_PERMS: Record<UserRole, Record<string, boolean>> = {
  socio:       { ...ALL_OFF, admin: true, comprasDashboard: true, aditivos: true, contratacoes: true, atas: true,
                 documentos: true, stakeholders: true, kickoff: true, raci: true,
                 contratacaoPlano: true, histograma: true },
  diretoria:   { ...ALL_OFF },
  coordenacao: { ...ALL_OFF },
  pmo:         { ...ALL_OFF },
  engenharia:  { ...ALL_OFF },
  financeiro:  { ...ALL_OFF },
  gestor:      { ...ALL_OFF },
  compras:     { ...ALL_OFF },
  orcamentos:  { ...ALL_OFF },
  campo:       { ...ALL_OFF },
};

/** Returns the user's explicit permissions, or the cargo defaults if none are set */
export function getUserPermissions(user: User | null): Record<string, boolean> {
  if (!user) return {};
  if (user.permissions && Object.keys(user.permissions).length > 0) return user.permissions;
  return DEFAULT_PERMS[user.role] ?? DEFAULT_PERMS['campo'];
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
        return;
      }
      // Refresh user data from server to pick up role/permission changes
      api.get<{ data: User }>('/auth/me').then(res => {
        const fresh = res.data.data;
        localStorage.setItem('user', JSON.stringify(fresh));
        set({ user: fresh });
      }).catch(() => { /* keep cached user if network fails */ });
    }
  },
}));
