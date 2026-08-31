import { z } from 'zod';

// Cargos operacionais que participam do planejamento de mão de obra.
// "gestor" é mantido por compat (dado legado = "Gestor de Obras"); os 5 novos
// nomes pedidos pelo Bruno (30/08) são coordenador/residente/mestre/ajudante/administrativo.
export const CARGOS_ALOCACAO = [
  'coordenador',
  'gestor',
  'residente',
  'mestre',
  'ajudante',
  'administrativo',
] as const;

export const ORIGEM_TIPOS = ['contratada', 'pipeline'] as const;

export const createAlocacaoSchema = z.object({
  userId: z.string().uuid().nullable().optional(),
  recursoExternoId: z.string().uuid().nullable().optional(),
  obraId: z.string().uuid().nullable().optional(),
  crmOportunidadeId: z.string().uuid().nullable().optional(),
  origemTipo: z.enum(ORIGEM_TIPOS).default('contratada'),
  cargoNaAlocacao: z.enum(CARGOS_ALOCACAO).default('gestor'),
  fase: z.enum(['obra', 'projeto', 'ambas']).default('ambas'),
  dedicacaoPct: z.number().int().min(1).max(100),
  dataInicio: z.string().nullable().optional(),
  dataFim: z.string().nullable().optional(),
}).refine(d => !!d.userId !== !!d.recursoExternoId, {
  message: 'Informe userId OU recursoExternoId — nunca os dois nem nenhum',
}).refine(d => (!!d.obraId) !== (!!d.crmOportunidadeId), {
  message: 'Informe obraId (alocação contratada) OU crmOportunidadeId (pipeline) — nunca os dois nem nenhum',
}).refine(d => d.origemTipo !== 'pipeline' || (!!d.dataInicio && !!d.dataFim), {
  message: 'Alocação em pipeline precisa de dataInicio e dataFim estimados (não há datas de obra pra herdar)',
});

export const updateAlocacaoSchema = z.object({
  userId: z.string().uuid().nullable().optional(),
  recursoExternoId: z.string().uuid().nullable().optional(),
  obraId: z.string().uuid().nullable().optional(),
  crmOportunidadeId: z.string().uuid().nullable().optional(),
  origemTipo: z.enum(ORIGEM_TIPOS).optional(),
  cargoNaAlocacao: z.enum(CARGOS_ALOCACAO).optional(),
  fase: z.enum(['obra', 'projeto', 'ambas']).optional(),
  dedicacaoPct: z.number().int().min(1).max(100).optional(),
  dataInicio: z.string().nullable().optional(),
  dataFim: z.string().nullable().optional(),
});

export type CreateAlocacaoInput = z.infer<typeof createAlocacaoSchema>;
export type UpdateAlocacaoInput = z.infer<typeof updateAlocacaoSchema>;
