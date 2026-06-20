import { z } from 'zod';

export const CONTRATACAO_STATUSES = [
  'em_negociacao',
  'aprovado',
  'assinado',
  'em_execucao',
  'concluido',
  'rescindido',
] as const;

export const createContratacaoSchema = z.object({
  fornecedor:     z.string().min(1),
  disciplina:     z.string().optional().nullable(),
  valor:          z.number().positive(),
  dataAssinatura: z.string().optional().nullable(),
  vigenciaInicio: z.string().optional().nullable(),
  vigenciaFim:    z.string().optional().nullable(),
  observacoes:    z.string().optional().nullable(),
});

export const updateContratacaoSchema = createContratacaoSchema.partial().extend({
  status: z.enum(CONTRATACAO_STATUSES).optional(),
});

export type CreateContratacaoInput = z.infer<typeof createContratacaoSchema>;
export type UpdateContratacaoInput = z.infer<typeof updateContratacaoSchema>;
