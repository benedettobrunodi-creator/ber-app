import { z } from 'zod';

export const createEtapaSchema = z.object({
  ordem:                 z.number().int().min(0),
  nome:                  z.string().min(1),
  descricao:             z.string().optional().nullable(),
  contratoValor:         z.union([z.number(), z.string()]),
  fornecedoresCompletos: z.boolean().optional(),
  excelLinha:            z.number().int().optional().nullable(),
});

export const updateEtapaSchema = createEtapaSchema.partial();

export const reordenarEtapasSchema = z.object({
  ordens: z.array(z.object({ id: z.string().uuid(), ordem: z.number().int().min(0) })),
});

export type CreateEtapaInput   = z.infer<typeof createEtapaSchema>;
export type UpdateEtapaInput   = z.infer<typeof updateEtapaSchema>;
export type ReordenarInput     = z.infer<typeof reordenarEtapasSchema>;
