import { z } from 'zod';

export const AMOSTRA_STATUSES = ['aprovado', 'reprovado', 'pendente'] as const;

export const createAmostraSchema = z.object({
  item: z.string().min(1).max(200),
  marca: z.string().max(120).nullable().optional(),
  especificacao: z.string().nullable().optional(),
  ambiente: z.string().max(120).nullable().optional(),
  status: z.enum(AMOSTRA_STATUSES).default('aprovado'),
  dataAprovacao: z.string().nullable().optional(),
  responsavelStakeholderId: z.string().uuid().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

export const updateAmostraSchema = createAmostraSchema.partial();

export type CreateAmostraInput = z.infer<typeof createAmostraSchema>;
export type UpdateAmostraInput = z.infer<typeof updateAmostraSchema>;
