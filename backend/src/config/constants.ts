export const ROLES = ['diretoria', 'coordenacao', 'gestor', 'campo'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_HIERARCHY: Record<Role, number> = {
  diretoria: 4,
  coordenacao: 3,
  gestor: 2,
  campo: 1,
};

export const OBRA_STATUSES = ['planejamento', 'em_andamento', 'pausada', 'concluida'] as const;
export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const PROPOSAL_STATUSES = [
  'leads_info', 'leads_aguardando', 'contato', 'analise',
  'go_aguardando', 'proposta_dev',
  'enviada_alta', 'enviada_media', 'enviada_baixa',
  'ganha', 'perdida',
] as const;
export const ANNOUNCEMENT_CATEGORIES = ['urgente', 'informativo', 'rh', 'operacional'] as const;
export const CHAT_ROOM_TYPES = ['group', 'direct', 'obra'] as const;
export const NOTIFICATION_TYPES = ['proposal_update', 'announcement', 'chat', 'obra_update', 'task'] as const;
export const TIME_ENTRY_TYPES = ['checkin', 'checkout'] as const;

export const BCRYPT_SALT_ROUNDS = 12;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
