import { z } from 'zod';

export const createPendenciaSchema = z.object({
  ambiente: z.string().min(1).max(120),
  atividade: z.string().min(1),
  disciplina: z.string().max(60).optional(),
  fornecedor: z.string().max(120).optional(),
  apontadoPor: z.enum(['ber', 'cliente']).default('ber'),
  responsavelId: z.string().uuid().optional(),
  tipo: z.enum(['pendencia', 'solicitacao']).default('pendencia'),
  criticidade: z.enum(['baixa', 'media', 'alta']).default('media'),
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dataTermino: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  observacoes: z.string().optional(),
});

export const updatePendenciaSchema = createPendenciaSchema.partial();

export const mudarStatusSchema = z.object({
  status: z.enum(['aberta', 'em_andamento', 'concluida', 'bloqueada']),
  motivoBloqueio: z.string().optional(),
});

export type CreatePendenciaInput = z.infer<typeof createPendenciaSchema>;
export type UpdatePendenciaInput = z.infer<typeof updatePendenciaSchema>;
export type MudarStatusInput = z.infer<typeof mudarStatusSchema>;
