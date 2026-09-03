import { z } from 'zod';

export const respostaSchema = z.object({
  categoriaKey: z.string().min(1).max(30),
  itemKey: z.string().min(1).max(30),
  resposta: z.enum(['sim', 'nao', 'na']),
  observacao: z.string().max(2000).nullable().optional(),
});

export const createVistoriaSchema = z.object({
  respostas: z.array(respostaSchema).min(1).max(100),
  observacoes: z.string().max(5000).nullable().optional(),
  /** Data da vistoria (YYYY-MM-DD) — permite registro retroativo; default hoje. */
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Atividades em execução no momento (itCode = IT do catálogo; sem itCode = texto livre). */
  atividades: z.array(z.object({
    itCode: z.string().max(20).nullable().optional(),
    titulo: z.string().min(1).max(200),
  })).max(40).optional(),
});

export const resolverPendenciaSchema = z.object({
  resolvido: z.boolean(),
});

export type CreateVistoriaInput = z.infer<typeof createVistoriaSchema>;
