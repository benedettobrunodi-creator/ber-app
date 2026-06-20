import { z } from 'zod';

export const PLANO_STATUSES = ['a_contratar', 'em_cotacao', 'contratado', 'atrasado'] as const;

export const createPlanoSchema = z.object({
  pacote:     z.string().min(1),
  dataIdeal:  z.string().optional().nullable(),
  dataLimite: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export const updatePlanoSchema = createPlanoSchema.partial().extend({
  status:        z.enum(PLANO_STATUSES).optional(),
  contratacaoId: z.string().uuid().optional().nullable(),
});

export type CreatePlanoInput = z.infer<typeof createPlanoSchema>;
export type UpdatePlanoInput = z.infer<typeof updatePlanoSchema>;
