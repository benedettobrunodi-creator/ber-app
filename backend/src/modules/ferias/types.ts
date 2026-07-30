import { z } from 'zod';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD');

export const createColaboradorSchema = z.object({
  nome:             z.string().min(1, 'Informe o nome'),
  cargo:            z.string().optional().nullable(),
  feriasATirarDias: z.number().int().min(0).max(365).optional(),
  ativo:            z.boolean().optional(),
});

export const updateColaboradorSchema = createColaboradorSchema.partial().extend({
  ordem: z.number().int().optional(),
});

export const createPeriodoSchema = z.object({
  colaboradorId: z.string().uuid(),
  dataInicio:    dateStr,
  dataFim:       dateStr,
  observacoes:   z.string().optional().nullable(),
});

export const updatePeriodoSchema = z.object({
  dataInicio:  dateStr.optional(),
  dataFim:     dateStr.optional(),
  observacoes: z.string().optional().nullable(),
});

export type CreateColaboradorInput = z.infer<typeof createColaboradorSchema>;
export type UpdateColaboradorInput = z.infer<typeof updateColaboradorSchema>;
export type CreatePeriodoInput = z.infer<typeof createPeriodoSchema>;
export type UpdatePeriodoInput = z.infer<typeof updatePeriodoSchema>;
