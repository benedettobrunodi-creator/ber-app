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

/** Default permissions per cargo — used when user has no explicit permissions set */
const DEFAULT_PERMS: Record<UserRole, Record<string, boolean>> = {
  socio:       { dashboard: true,  obras: true,  kanban: true,  checklists: true,  recebimentos: true,  seguranca: true,  normas: true,  instrucoes: true,  ponto: true,  dre: true,  configuracoes: true,  orcamentos: true,  diario: true,  organograma: true,  admin: true  },
  diretoria:   { dashboard: true,  obras: true,  kanban: true,  checklists: true,  recebimentos: true,  seguranca: true,  normas: true,  instrucoes: true,  ponto: true,  dre: false, configuracoes: true,  orcamentos: true,  diario: true,  organograma: false, admin: false },
  coordenacao: { dashboard: true,  obras: true,  kanban: true,  checklists: true,  recebimentos: true,  seguranca: true,  normas: true,  instrucoes: true,  ponto: true,  dre: false, configuracoes: true,  orcamentos: true,  diario: true,  organograma: false, admin: false },
  pmo:         { dashboard: true,  obras: true,  kanban: true,  checklists: true,  recebimentos: false, seguranca: false, normas: true,  instrucoes: true,  ponto: true,  dre: false, configuracoes: false, orcamentos: false, diario: true,  organograma: false, admin: false },
  engenharia:  { dashboard: true,  obras: true,  kanban: true,  checklists: true,  recebimentos: false, seguranca: true,  normas: true,  instrucoes: true,  ponto: true,  dre: false, configuracoes: false, orcamentos: false, diario: true,  organograma: false, admin: false },
  financeiro:  { dashboard: true,  obras: true,  kanban: false, checklists: false, recebimentos: true,  seguranca: false, normas: false, instrucoes: false, ponto: true,  dre: false, configuracoes: false, orcamentos: false, diario: true,  organograma: false, admin: false },
  gestor:      { dashboard: true,  obras: true,  kanban: true,  checklists: true,  recebimentos: true,  seguranca: true,  normas: true,  instrucoes: true,  ponto: true,  dre: false, configuracoes: false, orcamentos: false, diario: true,  organograma: false, admin: false },
  compras:     { dashboard: true,  obras: true,  kanban: false, checklists: false, recebimentos: true,  seguranca: false, normas: false, instrucoes: false, ponto: true,  dre: false, configuracoes: false, orcamentos: false, diario: true,  organograma: false, admin: false },
  orcamentos:  { dashboard: true,  obras: false, kanban: false, checklists: false, recebimentos: false, seguranca: false, normas: false, instrucoes: false, ponto: true,  dre: false, configuracoes: false, orcamentos: true,  diario: true,  organograma: false, admin: false },
  campo:       { dashboard: false, obras: false, kanban: false, checklists: false, recebimentos: false, seguranca: false, normas: false, instrucoes: false, ponto: true,  dre: false, configuracoes: false, orcamentos: false, diario: true,  organograma: false, admin: false },
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
      }
    }
  },
}));
