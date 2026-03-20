// ──────────────────────────────────────────────
// Application-wide constants
// ──────────────────────────────────────────────

// Dev: ngrok tunnel pro backend local
// Produção: trocar pra https://api.ber-app.com.br/v1
export const API_URL = __DEV__ ? 'http://192.168.68.60:3000/v1' : 'https://api.ber-app.com.br/v1';

// ── Role hierarchy ──────────────────────────────

export const ROLE_HIERARCHY: Record<string, number> = {
  diretoria: 4,
  coordenacao: 3,
  gestor: 2,
  campo: 1,
} as const;

/**
 * Check whether `userRole` has at least the privilege level of `requiredRole`.
 * Unknown roles are treated as having no privileges.
 */
export function hasMinRole(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}

// ── Status & category options ───────────────────

export interface SelectOption {
  value: string;
  label: string;
}

export const OBRA_STATUSES: SelectOption[] = [
  { value: 'planejamento', label: 'Planejamento' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'pausada', label: 'Pausada' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' },
];

export const PROPOSAL_STATUSES: SelectOption[] = [
  { value: 'leads_info', label: 'Leads - Info de Mercado' },
  { value: 'leads_aguardando', label: 'Leads - Aguardando Entrada' },
  { value: 'contato', label: 'Contato / Identificação' },
  { value: 'analise', label: 'Análise Go x No Go' },
  { value: 'go_aguardando', label: 'Go - Aguardando Início' },
  { value: 'proposta_dev', label: 'Proposta em Desenvolvimento' },
  { value: 'enviada_alta', label: 'Enviada - Prob. Alta' },
  { value: 'enviada_media', label: 'Enviada - Prob. Média' },
  { value: 'enviada_baixa', label: 'Enviada - Prob. Baixa' },
];

export const TASK_STATUSES: SelectOption[] = [
  { value: 'a_fazer', label: 'A Fazer' },
  { value: 'em_progresso', label: 'Em Progresso' },
  { value: 'em_revisao', label: 'Em Revisão' },
  { value: 'concluida', label: 'Concluída' },
];

export const PRIORITY_LEVELS: SelectOption[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

export const ANNOUNCEMENT_CATEGORIES: SelectOption[] = [
  { value: 'informativo', label: 'Informativo' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'obra', label: 'Obra' },
  { value: 'rh', label: 'RH' },
];

// ── Pagination defaults ─────────────────────────

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
} as const;
