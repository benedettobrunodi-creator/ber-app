import { z } from 'zod';

export const CATEGORIAS = [
  'asbuilt', 'art_licencas', 'manuais', 'garantias', 'acabamentos',
  'contatos', 'fotos_finais', 'laudos', 'outros',
] as const;

export const createCloseOutItemSchema = z.object({
  categoria: z.enum(CATEGORIAS),
  titulo: z.string().min(1).max(200),
  descricao: z.string().optional(),
  fornecedor: z.string().max(120).optional(),
  validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateCloseOutItemSchema = createCloseOutItemSchema.partial().extend({
  status: z.enum(['pendente', 'recebido']).optional(),
});

export type CreateCloseOutItemInput = z.infer<typeof createCloseOutItemSchema>;
export type UpdateCloseOutItemInput = z.infer<typeof updateCloseOutItemSchema>;
