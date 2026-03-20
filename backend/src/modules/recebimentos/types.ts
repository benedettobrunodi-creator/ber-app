import { z } from 'zod';

export const createRecebimentoSchema = z.object({
  fornecedor: z.string().min(1),
  material: z.string().min(1),
  quantidade: z.number().positive(),
  unidade: z.string().min(1),
  numeroNF: z.string().optional(),
  dataNF: z.string().optional(),
  dataEntrega: z.string().min(1),
  condicao: z.enum(['aprovado', 'aprovado_com_ressalva', 'reprovado']).default('aprovado'),
  observacao: z.string().optional(),
  fotosMaterial: z.array(z.string()).default([]),
  fotoNF: z.string().optional(),
});

export const updateRecebimentoSchema = createRecebimentoSchema.partial();

export type CreateRecebimentoInput = z.infer<typeof createRecebimentoSchema>;
export type UpdateRecebimentoInput = z.infer<typeof updateRecebimentoSchema>;
