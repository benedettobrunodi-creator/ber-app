import { z } from 'zod';

export const ADITIVO_TIPOS = ['credito', 'debito'] as const;
export const ADITIVO_STATUSES = [
  'em_analise',
  'aprovado',
  'rejeitado',
  'em_execucao',
  'concluido',
] as const;

export const createAditivoSchema = z.object({
  numero: z.string().min(1).max(20),
  descricao: z.string().min(1),
  valor: z.number().positive(),
  tipo: z.enum(ADITIVO_TIPOS),
  motivo: z.string().optional().nullable(),
});

export const updateAditivoSchema = z.object({
  numero: z.string().min(1).max(20).optional(),
  descricao: z.string().min(1).optional(),
  valor: z.number().positive().optional(),
  tipo: z.enum(ADITIVO_TIPOS).optional(),
  motivo: z.string().optional().nullable(),
  status: z.enum(ADITIVO_STATUSES).optional(),
});

export const decisionSchema = z.object({
  status: z.enum(['aprovado', 'rejeitado']),
});

export type CreateAditivoInput = z.infer<typeof createAditivoSchema>;
export type UpdateAditivoInput = z.infer<typeof updateAditivoSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
