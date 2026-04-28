import { z } from 'zod';

export const createAlocacaoSchema = z.object({
  userId: z.string().uuid().nullable().optional(),
  recursoExternoId: z.string().uuid().nullable().optional(),
  obraId: z.string().uuid(),
  fase: z.enum(['obra', 'projeto', 'ambas']).default('ambas'),
  dedicacaoPct: z.number().int().min(1).max(100),
  dataInicio: z.string().nullable().optional(),
  dataFim: z.string().nullable().optional(),
}).refine(d => d.userId || d.recursoExternoId, {
  message: 'Informe userId ou recursoExternoId',
});

export const updateAlocacaoSchema = z.object({
  userId: z.string().uuid().nullable().optional(),
  recursoExternoId: z.string().uuid().nullable().optional(),
  obraId: z.string().uuid().optional(),
  fase: z.enum(['obra', 'projeto', 'ambas']).optional(),
  dedicacaoPct: z.number().int().min(1).max(100).optional(),
  dataInicio: z.string().nullable().optional(),
  dataFim: z.string().nullable().optional(),
});

export type CreateAlocacaoInput = z.infer<typeof createAlocacaoSchema>;
export type UpdateAlocacaoInput = z.infer<typeof updateAlocacaoSchema>;
