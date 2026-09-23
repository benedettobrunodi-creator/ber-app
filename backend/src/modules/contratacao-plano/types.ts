import { z } from 'zod';

export const PLANO_STATUSES = ['a_contratar', 'em_cotacao', 'contratado', 'atrasado'] as const;

export const createPlanoSchema = z.object({
  pacote:     z.string().min(1),
  dataIdeal:  z.string().optional().nullable(),
  dataLimite: z.string().optional().nullable(),
  contato:    z.string().optional().nullable(),
  telefone:   z.string().optional().nullable(),
  email:      z.string().optional().nullable(),
  responsavel:       z.string().optional().nullable(),
  empresaContratada: z.string().optional().nullable(),
  fornecedorId:      z.string().uuid().optional().nullable(), // cadastro único (22/09/26)
  tempoEntrega:      z.string().optional().nullable(),
  dataEmissaoPedido: z.string().optional().nullable(),
  inicioMobilizacao: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export const updatePlanoSchema = createPlanoSchema.partial().extend({
  status:        z.enum(PLANO_STATUSES).optional(),
  contratacaoId: z.string().uuid().optional().nullable(),
});

export type CreatePlanoInput = z.infer<typeof createPlanoSchema>;
export type UpdatePlanoInput = z.infer<typeof updatePlanoSchema>;
