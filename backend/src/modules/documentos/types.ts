import { z } from 'zod';

export const DOC_STATUSES = ['em_analise', 'aprovado', 'reprovado', 'pendente'] as const;

export const createDocumentoSchema = z.object({
  tipo:        z.string().min(1).max(50),
  nome:        z.string().min(1).max(255),
  revisao:     z.string().max(20).optional().nullable(),
  emitidoPor:  z.string().max(255).optional().nullable(),
  dataEmissao: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export const updateDocumentoSchema = createDocumentoSchema.partial().extend({
  status: z.enum(DOC_STATUSES).optional(),
});

export type CreateDocumentoInput = z.infer<typeof createDocumentoSchema>;
export type UpdateDocumentoInput = z.infer<typeof updateDocumentoSchema>;
