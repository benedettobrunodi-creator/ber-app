import { z } from 'zod';
import { CARGOS_ALOCACAO } from '../alocacoes/types';

export const createRecursoExternoSchema = z.object({
  nome: z.string().min(1).max(255),
  funcao: z.enum(CARGOS_ALOCACAO),
});

export type CreateRecursoExternoInput = z.infer<typeof createRecursoExternoSchema>;
