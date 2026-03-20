import { z } from 'zod';

export const createSequenciamentoSchema = z.object({
  templateId: z.string().uuid(),
});

export const startEtapaSchema = z.object({
  gestorNotes: z.string().optional(),
});

export const submitEtapaSchema = z.object({
  gestorNotes: z.string().min(1, 'Notas do gestor são obrigatórias'),
});

export const approveEtapaSchema = z.object({
  coordenadorNotes: z.string().optional(),
});

export const rejectEtapaSchema = z.object({
  rejectionReason: z.string().min(1, 'Motivo da rejeição é obrigatório'),
  coordenadorNotes: z.string().optional(),
});

// ─── Edit mode schemas ──────────────────────────────────────────────────────

export const updateEtapaSchema = z.object({
  name: z.string().min(1).optional(),
  estimatedDays: z.number().int().min(0).optional(),
});

export const reorderEtapasSchema = z.object({
  etapaIds: z.array(z.string().uuid()),
});

export const addEtapaSchema = z.object({
  name: z.string().min(1),
  discipline: z.string().min(1),
  estimatedDays: z.number().int().min(0).default(1),
  order: z.number().int().min(1),
});

export type CreateSequenciamentoInput = z.infer<typeof createSequenciamentoSchema>;
export type StartEtapaInput = z.infer<typeof startEtapaSchema>;
export type SubmitEtapaInput = z.infer<typeof submitEtapaSchema>;
export type ApproveEtapaInput = z.infer<typeof approveEtapaSchema>;
export type RejectEtapaInput = z.infer<typeof rejectEtapaSchema>;
export type UpdateEtapaInput = z.infer<typeof updateEtapaSchema>;
export type ReorderEtapasInput = z.infer<typeof reorderEtapasSchema>;
export type AddEtapaInput = z.infer<typeof addEtapaSchema>;
