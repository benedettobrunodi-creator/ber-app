import { z } from 'zod';

export const ATA_TIPOS = ['interna', 'externa'] as const;

const participanteSchema = z.object({
  nome: z.string().min(1),
  papel: z.string().optional().nullable(),
});

const pendenciaInputSchema = z.object({
  descricao: z.string().min(1),
  responsibleId: z.string().uuid().optional().nullable(),
  prazo: z.string().optional().nullable(),
});

export const createAtaSchema = z.object({
  tipo:          z.enum(ATA_TIPOS),
  numero:        z.string().min(1).max(20),
  data:          z.string().min(1),
  local:         z.string().optional().nullable(),
  participantes: z.array(participanteSchema).default([]),
  pauta:         z.string().min(1),
  decisoes:      z.string().optional().nullable(),
  pendencias:    z.array(pendenciaInputSchema).default([]),
});

export const updateAtaSchema = createAtaSchema.partial();

export const addPendenciaSchema = pendenciaInputSchema;

export type CreateAtaInput = z.infer<typeof createAtaSchema>;
export type UpdateAtaInput = z.infer<typeof updateAtaSchema>;
export type AddPendenciaInput = z.infer<typeof addPendenciaSchema>;
