import { z } from 'zod';

export const createStakeholderSchema = z.object({
  empresa:  z.string().min(1),
  nome:     z.string().min(1),
  cargo:    z.string().optional().nullable(),
  email:    z.string().email().optional().nullable().or(z.literal('')),
  telefone: z.string().optional().nullable(),
  funcao:   z.string().optional().nullable(),
  ordem:    z.number().int().optional(),
});

export const updateStakeholderSchema = createStakeholderSchema.partial();

export type CreateStakeholderInput = z.infer<typeof createStakeholderSchema>;
export type UpdateStakeholderInput = z.infer<typeof updateStakeholderSchema>;
