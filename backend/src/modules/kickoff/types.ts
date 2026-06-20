import { z } from 'zod';

export const upsertKickoffSchema = z.object({
  dataRealizada:  z.string().optional().nullable(),
  participantes:  z.array(z.object({ nome: z.string().min(1), papel: z.string().optional().nullable() })).optional(),
  pautaCoberta:   z.string().optional().nullable(),
  decisoes:       z.string().optional().nullable(),
  premissas:      z.string().optional().nullable(),
  riscosIniciais: z.string().optional().nullable(),
});

export type UpsertKickoffInput = z.infer<typeof upsertKickoffSchema>;
