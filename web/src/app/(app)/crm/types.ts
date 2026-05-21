export const ETAPAS = [
  { value: 'lead',              label: 'Lead',               color: '#868686' },
  { value: 'qualificacao',      label: 'Qualificação',       color: '#5A7A7A' },
  { value: 'proposta_producao', label: 'Proposta Produção',  color: '#E6A23C' },
  { value: 'proposta_enviada',  label: 'Proposta Enviada',   color: '#3B82F6' },
  { value: 'negociacao',        label: 'Negociação',         color: '#8B5CF6' },
  { value: 'ganho',             label: 'Ganho',              color: '#3D9E5F' },
  { value: 'perdido',           label: 'Perdido',            color: '#E05555' },
  { value: 'declinado',         label: 'Declinado',          color: '#F97316' },
  { value: 'cancelado',         label: 'Cancelado',          color: '#6B7280' },
] as const;

export const ETAPA_MAP = Object.fromEntries(ETAPAS.map((e) => [e.value, e]));

export const ORIGENS = [
  { value: 'gerenciadora', label: 'Gerenciadora' },
  { value: 'marketing',    label: 'Marketing' },
  { value: 'outbound',     label: 'Outbound' },
  { value: 'networking',   label: 'Networking' },
  { value: 'broker',       label: 'Broker' },
  { value: 'arquitetura',  label: 'Arquitetura' },
  { value: 'recorrente',   label: 'Recorrente' },
] as const;

export const PROBABILIDADES = [
  { value: 'alta',  label: 'Alta',  pct: 80 },
  { value: 'media', label: 'Média', pct: 50 },
  { value: 'baixa', label: 'Baixa', pct: 20 },
] as const;

export const TIPOS_ATIVIDADE = [
  { value: 'reuniao',  label: 'Reunião' },
  { value: 'ligacao',  label: 'Ligação' },
  { value: 'email',    label: 'E-mail' },
  { value: 'visita',   label: 'Visita' },
  { value: 'outro',    label: 'Outro' },
] as const;

export const SEGMENTOS = ['Corporativo', 'Residencial', 'Industrial', 'Igreja', 'Hotel', 'Outros'];

export interface Empresa {
  id: string;
  razaoSocial: string;
  cnpj: string | null;
  segmento: string | null;
  cidade: string | null;
  nutricao: boolean;
  ultimoContato: string | null;
  contatos: Contato[];
  _count?: { oportunidades: number };
}

export interface Contato {
  id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  principal: boolean;
  empresaId: string | null;
}

export interface Oportunidade {
  id: string;
  titulo: string;
  valor: number | null;
  etapa: string;
  origem: string | null;
  probabilidade: string | null;
  dataFechamentoPrevisto: string | null;
  dataEntradaPipeline: string | null;
  dataGanho: string | null;
  motivoPerda: string | null;
  observacoes: string | null;
  empresa: { id: string; razaoSocial: string; segmento: string | null } | null;
  contato: { id: string; nome: string; cargo: string | null } | null;
  responsavel: { id: string; name: string; avatarUrl: string | null } | null;
  atividades: Atividade[];
  orcamento?: { id: string; numero: string; status: string; valorVenda: number | null; m2: number | null; cliente: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Atividade {
  id: string;
  tipo: string;
  dataHora: string;
  duracao: number | null;
  notas: string | null;
  concluida: boolean;
  oportunidade?: { id: string; titulo: string; empresa: { razaoSocial: string } | null } | null;
  usuario?: { id: string; name: string; avatarUrl: string | null };
}

export interface User {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export function fmt(value: number | string | null | undefined): string {
  if (value == null) return '--';
  const n = Number(value);
  if (isNaN(n)) return '--';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function diasAtras(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias === 0) return 'hoje';
  if (dias === 1) return '1 dia';
  return `${dias} dias`;
}
