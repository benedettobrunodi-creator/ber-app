/** Single source of truth for all app modules and their permission keys.
 *  Add a new entry here when a new route/module is created. */
export const APP_MODULES = [
  { key: 'dashboard',    label: 'Dashboard' },
  { key: 'obras',        label: 'Obras' },
  { key: 'kanban',       label: 'Painel de Gestão' },
  { key: 'checklists',   label: 'Checklists' },
  { key: 'diario',       label: 'Diário de Obra' },
  { key: 'recebimentos', label: 'Recebimentos' },
  { key: 'seguranca',    label: 'Segurança' },
  { key: 'normas',       label: 'Normas Técnicas' },
  { key: 'instrucoes',   label: 'Instruções Técnicas' },
  { key: 'ponto',        label: 'Registro de Ponto' },
  { key: 'orcamentos',   label: 'Orçamentos / CRM' },
  { key: 'comprasDashboard', label: 'Metas de Compra (Consolidado)' },
  { key: 'organograma',  label: 'Organograma' },
  { key: 'configuracoes', label: 'Configurações' },
  { key: 'admin',        label: 'Admin (Gestão de Usuários)' },
] as const;

export type ModuleKey = typeof APP_MODULES[number]['key'];
