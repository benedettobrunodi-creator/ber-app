import { z } from 'zod';

export const createRaciSchema = z.object({
  atividade: z.string().min(1),
  ordem:     z.number().int().optional(),
  papeis:    z.record(z.enum(['R', 'A', 'C', 'I'])).default({}),
});

export const updateRaciSchema = createRaciSchema.partial();

export type CreateRaciInput = z.infer<typeof createRaciSchema>;
export type UpdateRaciInput = z.infer<typeof updateRaciSchema>;
