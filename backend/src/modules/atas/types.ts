import { z } from 'zod';

export const ATA_STATUS = ['concluido', 'em_andamento', 'atrasado'] as const;
export const ATA_IMPACTO = ['sem_impacto', 'custo', 'cronograma', 'projeto'] as const;

export const createTopicoSchema = z.object({
  status:        z.enum(ATA_STATUS).optional(),
  impacto:       z.enum(ATA_IMPACTO).optional(),
  changeOrder:   z.boolean().optional(),
  tema:          z.string().optional().nullable(),
  area:          z.string().max(150).optional().nullable(),
  responsavelId: z.string().uuid().optional().nullable(),
  dataInfo:      z.string().optional().nullable(),
  dataAlvo:      z.string().optional().nullable(),
  dataFinal:     z.string().optional().nullable(),
});

export const updateTopicoSchema = createTopicoSchema.extend({
  ordem: z.number().int().optional(),
});

export const reorderTopicosSchema = z.object({
  ordem: z.array(z.string().uuid()),
});

export const createReuniaoSchema = z.object({
  data: z.string().min(1),
});

export const upsertNotaSchema = z.object({
  topicoId:  z.string().uuid(),
  reuniaoId: z.string().uuid(),
  texto:     z.string(),
});

export type CreateTopicoInput = z.infer<typeof createTopicoSchema>;
export type UpdateTopicoInput = z.infer<typeof updateTopicoSchema>;
export type ReorderTopicosInput = z.infer<typeof reorderTopicosSchema>;
export type CreateReuniaoInput = z.infer<typeof createReuniaoSchema>;
export type UpsertNotaInput = z.infer<typeof upsertNotaSchema>;
