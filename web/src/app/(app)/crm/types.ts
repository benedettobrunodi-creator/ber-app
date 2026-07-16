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
export const CLASSIFICACOES = ['Gerenciadora', 'Arquitetura', 'Broker', 'Incorporadora', 'End User', 'Fundo', 'Fornecedor'] as const;

export interface Empresa {
  id: string;
  razaoSocial: string;
  cnpj: string | null;
  segmento: string | null;
  classificacao: string | null;
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
  whatsapp: string | null;
  linkedin: string | null;
  aniversario: string | null;
  principal: boolean;
  empresaId: string | null;
  empresa: { id: string; razaoSocial: string; segmento: string | null; classificacao: string | null } | null;
  nutricao: boolean;
  papel: PapelContato | null;
  estrela: boolean;
  perfil: NutricaoPerfil | null;
  potencial: NutricaoPotencial | null;
  etapaNutricao: NutricaoEtapa | null;
  ordemNutricao: number | null;
  proximoContato: string | null;
  ultimoContato: string | null;
  notasRelacionamento: string | null;
  tags: string[];
  endereco: string | null;
}

export type PapelContato    = 'decisor' | 'influenciador' | 'neutro';
export type NutricaoEtapa    = 'descoberta' | 'consciencia' | 'engajamento' | 'consideracao' | 'ativo' | 'pos_venda';
export type NutricaoPerfil   = 'cliente_direto' | 'arquitetura' | 'gerenciadora' | 'broker' | 'incorporadora' | 'fundo';
export type NutricaoPotencial = 'estrategico' | 'padrao' | 'prospect';
export type NutricaoCanal    = 'linkedin' | 'email' | 'whatsapp' | 'ligacao' | 'reuniao';

export const NUTRICAO_ETAPAS: { value: NutricaoEtapa; label: string; color: string }[] = [
  { value: 'descoberta',   label: 'Descoberta',   color: '#94A3B8' },
  { value: 'consciencia',  label: 'Consciência',  color: '#60A5FA' },
  { value: 'engajamento',  label: 'Engajamento',  color: '#818CF8' },
  { value: 'consideracao', label: 'Consideração', color: '#F59E0B' },
  { value: 'ativo',        label: 'Ativo',        color: '#10B981' },
  { value: 'pos_venda',    label: 'Pós-venda',    color: '#EC4899' },
];

export const NUTRICAO_PERFIS: { value: NutricaoPerfil; label: string }[] = [
  { value: 'cliente_direto', label: 'Cliente Direto' },
  { value: 'arquitetura',    label: 'Escritório de Arquitetura' },
  { value: 'gerenciadora',   label: 'Gerenciadora' },
  { value: 'broker',         label: 'Broker' },
  { value: 'incorporadora',  label: 'Incorporadora' },
  { value: 'fundo',          label: 'Fundo' },
];

export const NUTRICAO_POTENCIAIS: { value: NutricaoPotencial; label: string; cls: string }[] = [
  { value: 'estrategico', label: 'Estratégico', cls: 'bg-amber-100 text-amber-700' },
  { value: 'padrao',      label: 'Padrão',      cls: 'bg-blue-100 text-blue-700' },
  { value: 'prospect',    label: 'Prospect',    cls: 'bg-neutral-200 text-neutral-600' },
];

export const PAPEIS_CONTATO: { value: PapelContato; label: string; cls: string }[] = [
  { value: 'decisor',       label: 'Decisor',       cls: 'bg-red-100 text-red-700' },
  { value: 'influenciador', label: 'Influenciador', cls: 'bg-purple-100 text-purple-700' },
  { value: 'neutro',        label: 'Neutro',        cls: 'bg-neutral-200 text-neutral-600' },
];

export const NUTRICAO_CANAIS: { value: NutricaoCanal; label: string; icon: string }[] = [
  { value: 'linkedin', label: 'LinkedIn', icon: '🔗' },
  { value: 'email',    label: 'E-mail',   icon: '✉️' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { value: 'ligacao',  label: 'Ligação',  icon: '📞' },
  { value: 'reuniao',  label: 'Reunião',  icon: '🤝' },
];

export interface NutricaoTemplate {
  id: string;
  etapa: NutricaoEtapa;
  canal: NutricaoCanal;
  titulo: string;
  corpo: string;
  perfilAlvo: NutricaoPerfil | null;
  ordem: number;
  ativo: boolean;
}

export interface CampanhaNutricao {
  id: string;
  nome: string;
  descricao: string | null;
  perfilAlvo: NutricaoPerfil | null;
  potencialAlvo: NutricaoPotencial | null;
  etapaAlvo: NutricaoEtapa | null;
  canal: NutricaoCanal | null;
  templateId: string | null;
  modo: 'snapshot' | 'ao_vivo';
  status: 'rascunho' | 'ativa' | 'pausada' | 'concluida';
  responsavel: { id: string; name: string; avatarUrl: string | null } | null;
  createdAt: string;
  _count?: { contatos: number };
}

export const CAMPANHA_STATUSES = [
  { value: 'pendente',     label: 'Pendente',     color: 'bg-gray-100 text-gray-600' },
  { value: 'enviado',      label: 'Enviado',       color: 'bg-blue-100 text-blue-700' },
  { value: 'respondeu',    label: 'Respondeu',     color: 'bg-green-100 text-green-700' },
  { value: 'ignorou',      label: 'Ignorou',       color: 'bg-amber-100 text-amber-700' },
  { value: 'descadastrar', label: 'Descadastrar',  color: 'bg-red-100 text-red-700' },
] as const;

export interface Campanha {
  id: string;
  nome: string;
  descricao: string | null;
  responsavel: { id: string; name: string; avatarUrl: string | null } | null;
  createdAt: string;
  _count: { contatos: number };
}

export interface CampanhaDetalhe extends Campanha {
  contatos: {
    id: string;
    status: string;
    notas: string | null;
    contatadoEm: string | null;
    contato: Contato;
  }[];
}

export const NUTRICAO_TAGS = ['Decisor', 'Influenciador', 'Ativo', 'Passivo', 'Novo', 'VIP'] as const;

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
  estrela: boolean;
  notasEstrategia: string | null;
  icpEstrategico: boolean;
  icpLocalizacao: boolean;
  icpTicket: boolean;
  icpCiclo: boolean;
  bantBudget: boolean;
  bantAuthority: boolean;
  bantNeed: boolean;
  bantTimeline: boolean;
  ordem: number | null;
  empresa: { id: string; razaoSocial: string; segmento: string | null } | null;
  contato: { id: string; nome: string; cargo: string | null } | null;
  responsavel: { id: string; name: string; avatarUrl: string | null } | null;
  atividades: Atividade[];
  orcamento?: { id: string; numero: string; status: string; valorVenda: number | null; m2: number | null; cliente: string } | null;
  obra?: { id: string; name: string; status: string; fase: string } | null;
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
  resultado?: string | null;
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
