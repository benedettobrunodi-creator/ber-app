import { z } from 'zod';

export const OC_STATUSES = ['aberta', 'aprovada', 'em_entrega', 'entregue', 'cancelada'] as const;

export const createOcSchema = z.object({
  numero:              z.string().min(1).max(30),
  fornecedor:          z.string().min(1),
  descricao:           z.string().min(1),
  valor:               z.number().positive(),
  contratacaoId:       z.string().uuid().optional().nullable(),
  dataPrevistaEntrega: z.string().optional().nullable(),
  observacoes:         z.string().optional().nullable(),
});

export const updateOcSchema = createOcSchema.partial().extend({
  status:          z.enum(OC_STATUSES).optional(),
  dataEntregaReal: z.string().optional().nullable(),
});

export type CreateOcInput = z.infer<typeof createOcSchema>;
export type UpdateOcInput = z.infer<typeof updateOcSchema>;
