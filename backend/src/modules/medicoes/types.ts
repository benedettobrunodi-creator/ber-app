import { z } from 'zod';

export const MedicaoStatus = z.enum([
  'rascunho', 'enviada', 'aprovada', 'contestada', 'nf_emitida', 'paga',
]);

export const createMedicaoSchema = z.object({
  numero:                z.number().int().min(1),
  periodoInicio:         z.string(),
  periodoFim:            z.string(),
  dataPagamentoPrevista: z.string().optional().nullable(),
});

export const updateMedicaoSchema = z.object({
  numero:                z.number().int().min(1).optional(),
  periodoInicio:         z.string().optional(),
  periodoFim:            z.string().optional(),
  dataPagamentoPrevista: z.string().optional().nullable(),
  dataPagamentoRealizado: z.string().optional().nullable(),
}).partial();

export const transitionSchema = z.object({
  para:       MedicaoStatus,
  comentario: z.string().optional().nullable(),
});

export const updateItemSchema = z.object({
  percentualAcumulado: z.number().min(0).max(100),
});

export const upsertPagamentoDiretoSchema = z.object({
  fornecedorRazaoSocial: z.string().min(1),
  valor:                 z.union([z.number(), z.string()]),
  observacao:            z.string().optional().nullable(),
});

export type CreateMedicaoInput     = z.infer<typeof createMedicaoSchema>;
export type UpdateMedicaoInput     = z.infer<typeof updateMedicaoSchema>;
export type TransitionInput        = z.infer<typeof transitionSchema>;
export type UpdateItemInput        = z.infer<typeof updateItemSchema>;
export type PagamentoDiretoInput   = z.infer<typeof upsertPagamentoDiretoSchema>;
