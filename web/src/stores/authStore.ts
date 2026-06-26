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
  contratacaoPlano: false, histograma: false, gestao360: false,
};

const ALL_ON: Record<string, boolean> = Object.fromEntries(
  Object.keys(ALL_OFF).map(k => [k, true]),
);

/** Pacote "operações de obra" — todos que tocam obra precisam disso pra
 *  preencher RDO, atas, checklists, contratos etc. */
const OBRA_OPS: Record<string, boolean> = {
  ...ALL_OFF,
  dashboard: true, obras: true, kanban: true, checklists: true, diario: true,
  recebimentos: true, seguranca: true, normas: true, instrucoes: true, ponto: true,
  comprasDashboard: true, aditivos: true, contratacoes: true, atas: true,
  documentos: true, stakeholders: true, kickoff: true, raci: true,
  contratacaoPlano: true, histograma: true, gestao360: true,
};

/** Itens sensíveis exclusivos do sócio: salários (organograma), config
 *  de sistema, e gestão de usuários (admin). */
const SOCIO_ONLY: Record<string, boolean> = {
  organograma: false, configuracoes: false, admin: false,
};

/** Defaults por cargo. Espelha backend/middleware/permission.ts — mantenha em sincronia. */
const DEFAULT_PERMS: Record<UserRole, Record<string, boolean>> = {
  socio:       { ...ALL_ON },
  diretoria:   { ...ALL_ON, ...SOCIO_ONLY },
  coordenacao: { ...ALL_ON, ...SOCIO_ONLY },
  pmo:         { ...OBRA_OPS, organograma: true },
  engenharia:  { ...OBRA_OPS },
  gestor:      { ...OBRA_OPS },
  financeiro:  { ...ALL_OFF, dashboard: true, obras: true, recebimentos: true, ponto: true, diario: true,
                 comprasDashboard: true, aditivos: true, contratacoes: true, documentos: true, gestao360: true },
  compras:     { ...ALL_OFF, dashboard: true, obras: true, recebimentos: true, ponto: true, diario: true,
                 comprasDashboard: true, contratacoes: true, contratacaoPlano: true, documentos: true },
  orcamentos:  { ...ALL_OFF, dashboard: true, orcamentos: true, ponto: true, diario: true },
  campo:       { ...ALL_OFF, dashboard: true, obras: true, ponto: true, diario: true, checklists: true,
                 atas: true, stakeholders: true, gestao360: true, seguranca: true },
};

/** Returns merged permissions: role defaults + user customs (customs vencem).
 *  Garante que módulos novos não fiquem bloqueados pra users com permissions
 *  custom legadas. */
export function getUserPermissions(user: User | null): Record<string, boolean> {
  if (!user) return {};
  const baseDefaults = DEFAULT_PERMS[user.role] ?? DEFAULT_PERMS['campo'];
  if (user.permissions && Object.keys(user.permissions).length > 0) {
    return { ...baseDefaults, ...user.permissions };
  }
  return baseDefaults;
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
