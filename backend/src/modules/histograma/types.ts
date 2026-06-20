import { z } from 'zod';

export const upsertCellSchema = z.object({
  funcao: z.string().min(1),
  ano:    z.number().int().min(2000).max(2200),
  mes:    z.number().int().min(1).max(12),
  hhPlan: z.number().min(0).optional(),
  hhReal: z.number().min(0).optional(),
});

export const bulkUpsertSchema = z.object({
  cells: z.array(upsertCellSchema).min(1),
});

export const renameFuncaoSchema = z.object({
  from: z.string().min(1),
  to:   z.string().min(1),
});

export const deleteFuncaoSchema = z.object({
  funcao: z.string().min(1),
});

export type UpsertCellInput = z.infer<typeof upsertCellSchema>;
export type BulkUpsertInput = z.infer<typeof bulkUpsertSchema>;
