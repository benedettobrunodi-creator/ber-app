import { z } from 'zod';

export const CRM_ETAPAS = [
  'lead',
  'qualificacao',
  'proposta_producao',
  'proposta_enviada',
  'negociacao',
  'ganho',
  'perdido',
  'declinado',
  'cancelado',
] as const;
export type CrmEtapa = (typeof CRM_ETAPAS)[number];

export const CRM_ETAPA_MACRO: Record<CrmEtapa, string> = {
  lead: 'qualificacao',
  qualificacao: 'qualificacao',
  proposta_producao: 'propostas',
  proposta_enviada: 'propostas',
  negociacao: 'propostas',
  ganho: 'conversao',
  perdido: 'perdido',
  declinado: 'perdido',
  cancelado: 'perdido',
};

export const CRM_ORIGENS = [
  'gerenciadora',
  'marketing',
  'outbound',
  'networking',
  'broker',
  'arquitetura',
  'recorrente',
] as const;
export type CrmOrigem = (typeof CRM_ORIGENS)[number];

export const CRM_PROBABILIDADES = ['alta', 'media', 'baixa'] as const;
export type CrmProbabilidade = (typeof CRM_PROBABILIDADES)[number];

export const CRM_PROBABILIDADE_PCT: Record<CrmProbabilidade, number> = {
  alta: 0.8,
  media: 0.5,
  baixa: 0.2,
};

export const CRM_ATIVIDADE_TIPOS = [
  'reuniao',
  'ligacao',
  'email',
  'visita',
  'outro',
] as const;
export type CrmAtividadeTipo = (typeof CRM_ATIVIDADE_TIPOS)[number];

export const CRM_SEGMENTOS = [
  'Corporativo',
  'Residencial',
  'Industrial',
  'Igreja',
  'Hotel',
  'Outros',
] as const;

export const CRM_CLASSIFICACOES = [
  'Gerenciadora',
  'Arquitetura',
  'Broker',
  'Incorporadora',
  'End User',
  'Fundo',
  'Fornecedor',
] as const;

// ── Nutrição enums (usados por vários schemas abaixo) ───────────────────────
export const NUTRICAO_ETAPAS      = ['descoberta','consciencia','engajamento','consideracao','ativo','pos_venda'] as const;
export const NUTRICAO_PERFIS      = ['cliente_direto','arquitetura','gerenciadora','broker','incorporadora','fundo'] as const;
export const NUTRICAO_POTENCIAIS  = ['estrategico','padrao','prospect'] as const;
export const NUTRICAO_CANAIS      = ['linkedin','email','whatsapp','ligacao','reuniao'] as const;

// ── Schemas ──────────────────────────────────────────────────────────────────

const dateOrNull = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v ? new Date(v) : undefined));

export const createEmpresaSchema = z.object({
  razaoSocial: z.string().min(1).max(255),
  cnpj: z.string().max(18).optional().nullable(),
  segmento: z.enum(CRM_SEGMENTOS).optional().nullable(),
  classificacao: z.enum(CRM_CLASSIFICACOES).optional().nullable(),
  cidade: z.string().max(100).optional().nullable(),
  site: z.string().max(255).optional().nullable(),
  nutricao: z.boolean().default(false),
  observacoes: z.string().optional().nullable(),
  agendorId: z.string().max(50).optional().nullable(),
});
export const updateEmpresaSchema = createEmpresaSchema.partial();
export type CreateEmpresaInput = z.infer<typeof createEmpresaSchema>;
export type UpdateEmpresaInput = z.infer<typeof updateEmpresaSchema>;

export const createContatoSchema = z.object({
  empresaId: z.string().uuid().optional().nullable(),
  nome: z.string().min(1).max(255),
  cargo: z.string().max(100).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  telefone: z.string().max(20).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  linkedin: z.string().max(255).optional().nullable(),
  aniversario: dateOrNull,
  principal: z.boolean().default(false),
  agendorId: z.string().max(50).optional().nullable(),
  nutricao: z.boolean().optional(),
  papel: z.enum(['decisor','influenciador','neutro']).optional().nullable(),
  estrela: z.boolean().optional(),
  perfil: z.enum(['cliente_direto','arquitetura','gerenciadora','broker','incorporadora','fundo']).optional().nullable(),
  potencial: z.enum(['estrategico','padrao','prospect']).optional().nullable(),
  etapaNutricao: z.enum(['descoberta','consciencia','engajamento','consideracao','ativo','pos_venda']).optional().nullable(),
  ordemNutricao: z.number().int().optional().nullable(),
  proximoContato: z.string().optional().nullable(),
  ultimoContato: z.string().optional().nullable(),
  notasRelacionamento: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  endereco: z.string().optional().nullable(),
});
export const updateContatoSchema = createContatoSchema.partial();
export type CreateContatoInput = z.infer<typeof createContatoSchema>;
export type UpdateContatoInput = z.infer<typeof updateContatoSchema>;

export const CAMPANHA_STATUSES = ['pendente', 'enviado', 'respondeu', 'ignorou', 'descadastrar'] as const;

export const createCampanhaSchema = z.object({
  nome: z.string().min(1).max(255),
  descricao: z.string().optional().nullable(),
  responsavelId: z.string().uuid().optional().nullable(),
  perfilAlvo: z.enum(NUTRICAO_PERFIS).optional().nullable(),
  potencialAlvo: z.enum(NUTRICAO_POTENCIAIS).optional().nullable(),
  etapaAlvo: z.enum(NUTRICAO_ETAPAS).optional().nullable(),
  canal: z.enum(NUTRICAO_CANAIS).optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  modo: z.enum(['snapshot','ao_vivo']).optional(),
  status: z.enum(['rascunho','ativa','pausada','concluida']).optional(),
});
export const updateCampanhaSchema = createCampanhaSchema.partial();
export const addCampanhaContatoSchema = z.object({
  contatoIds: z.array(z.string().uuid()).min(1),
});
export const updateCampanhaContatoSchema = z.object({
  status: z.enum(CAMPANHA_STATUSES).optional(),
  notas: z.string().optional().nullable(),
  contatadoEm: z.string().optional().nullable(),
});
export type CreateCampanhaInput = z.infer<typeof createCampanhaSchema>;
export type UpdateCampanhaInput = z.infer<typeof updateCampanhaSchema>;

export const createOportunidadeSchema = z.object({
  titulo: z.string().min(1).max(500),
  empresaId: z.string().uuid().optional().nullable(),
  contatoId: z.string().uuid().optional().nullable(),
  responsavelId: z.string().uuid().optional().nullable(),
  valor: z.number().positive().optional().nullable(),
  etapa: z.enum(CRM_ETAPAS).default('lead'),
  origem: z.enum(CRM_ORIGENS).optional().nullable(),
  probabilidade: z.enum(CRM_PROBABILIDADES).optional().nullable(),
  dataFechamentoPrevisto: dateOrNull,
  dataEntradaPipeline: dateOrNull,
  dataGanho: dateOrNull,
  motivoPerda: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  estrela: z.boolean().optional(),
  notasEstrategia: z.string().optional().nullable(),
  icpEstrategico: z.boolean().optional(),
  icpLocalizacao: z.boolean().optional(),
  icpTicket: z.boolean().optional(),
  icpCiclo: z.boolean().optional(),
  bantBudget: z.boolean().optional(),
  bantAuthority: z.boolean().optional(),
  bantNeed: z.boolean().optional(),
  bantTimeline: z.boolean().optional(),
  orcamentoId: z.string().uuid().optional().nullable(),
});
export const updateOportunidadeSchema = createOportunidadeSchema.partial();
export type CreateOportunidadeInput = z.infer<typeof createOportunidadeSchema>;
export type UpdateOportunidadeInput = z.infer<typeof updateOportunidadeSchema>;

export const createAtividadeSchema = z.object({
  oportunidadeId: z.string().uuid().optional().nullable(),
  empresaId: z.string().uuid().optional().nullable(),
  tipo: z.enum(CRM_ATIVIDADE_TIPOS),
  dataHora: z.string().transform((v) => new Date(v)),
  duracao: z.number().int().positive().optional().nullable(),
  notas: z.string().optional().nullable(),
  googleEventId: z.string().max(255).optional().nullable(),
  concluida: z.boolean().default(false),
  resultado: z.string().optional().nullable(),
});
export const updateAtividadeSchema = createAtividadeSchema.partial().extend({
  usuarioId: z.string().uuid().optional(),
});
export type CreateAtividadeInput = z.infer<typeof createAtividadeSchema>;
export type UpdateAtividadeInput = z.infer<typeof updateAtividadeSchema>;

export const upsertMetaSchema = z.object({
  ano: z.number().int().min(2020).max(2100),
  mes: z.number().int().min(1).max(12),
  valorMeta: z.number().positive(),
});
export type UpsertMetaInput = z.infer<typeof upsertMetaSchema>;

export const upsertMetasAnuaisSchema = z.object({
  ano: z.number().int().min(2020).max(2100),
  metas: z.array(z.object({ mes: z.number().int().min(1).max(12), valorMeta: z.number().positive() })),
});
export type UpsertMetasAnuaisInput = z.infer<typeof upsertMetasAnuaisSchema>;

// ── Nutrição — templates ────────────────────────────────────────────────────

export const createNutricaoTemplateSchema = z.object({
  etapa: z.enum(NUTRICAO_ETAPAS),
  canal: z.enum(NUTRICAO_CANAIS),
  titulo: z.string().min(1).max(200),
  corpo: z.string().min(1),
  perfilAlvo: z.enum(NUTRICAO_PERFIS).optional().nullable(),
  ordem: z.number().int().optional(),
  ativo: z.boolean().optional(),
});
export const updateNutricaoTemplateSchema = createNutricaoTemplateSchema.partial();
export type CreateNutricaoTemplateInput = z.infer<typeof createNutricaoTemplateSchema>;
export type UpdateNutricaoTemplateInput = z.infer<typeof updateNutricaoTemplateSchema>;

export const reorderNutricaoContatosSchema = z.object({
  ids: z.array(z.string().uuid()),
  etapaNutricao: z.enum(NUTRICAO_ETAPAS).optional(),
});
export type ReorderNutricaoContatosInput = z.infer<typeof reorderNutricaoContatosSchema>;
