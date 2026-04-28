import { z } from 'zod';

export const createRecursoExternoSchema = z.object({
  nome: z.string().min(1).max(255),
  funcao: z.enum(['gestor', 'mestre', 'ajudante']),
});

export type CreateRecursoExternoInput = z.infer<typeof createRecursoExternoSchema>;
