import { z } from 'zod';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD');

export const createFeriadoSchema = z.object({
  data: dateStr,
  nome: z.string().min(1),
  tipo: z.enum(['nacional', 'estadual', 'municipal']).default('nacional'),
});

export const updateFeriadoSchema = createFeriadoSchema.partial().extend({
  ativo: z.boolean().optional(),
});

export const upsertAjusteSchema = z.object({
  userId: z.string().uuid(),
  data: dateStr,
  minutosAjustados: z.number().int().min(0).max(1440),
  obraId: z.string().uuid().optional().nullable(),
  motivo: z.string().min(1),
});

export const consumirSchema = z.object({
  userId: z.string().uuid(),
  data: dateStr,
  minutos: z.number().int().positive(),
  motivo: z.string().optional().nullable(),
});

export const processarSchema = z.object({
  startDate: dateStr,
  endDate: dateStr,
  userId: z.string().uuid().optional(),
});

export const marcarPagoSchema = z.object({
  pago: z.boolean(),
});

export type CreateFeriadoInput = z.infer<typeof createFeriadoSchema>;
export type UpdateFeriadoInput = z.infer<typeof updateFeriadoSchema>;
export type UpsertAjusteInput = z.infer<typeof upsertAjusteSchema>;
export type ConsumirInput = z.infer<typeof consumirSchema>;
export type ProcessarInput = z.infer<typeof processarSchema>;
