import { z } from 'zod';

export const createAlocacaoSchema = z.object({
  userId: z.string().uuid(),
  obraId: z.string().uuid(),
  fase: z.enum(['obra', 'projeto', 'ambas']).default('ambas'),
  dedicacaoPct: z.number().int().min(1).max(100),
  dataInicio: z.string().nullable().optional(),
  dataFim: z.string().nullable().optional(),
});

export const updateAlocacaoSchema = createAlocacaoSchema.partial();

export type CreateAlocacaoInput = z.infer<typeof createAlocacaoSchema>;
export type UpdateAlocacaoInput = z.infer<typeof updateAlocacaoSchema>;
