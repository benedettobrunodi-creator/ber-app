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
  cidade: z.string().max(100).optional().nullable(),
  site: z.string().max(255).optional().nullable(),
  nutricao: z.boolean().default(false),
  observacoes: z.string().optional().nullable(),
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
  principal: z.boolean().default(false),
});
export const updateContatoSchema = createContatoSchema.partial();
export type CreateContatoInput = z.infer<typeof createContatoSchema>;
export type UpdateContatoInput = z.infer<typeof updateContatoSchema>;

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
  motivoPerda: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
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
});
export const updateAtividadeSchema = createAtividadeSchema.partial();
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
