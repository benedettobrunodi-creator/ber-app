import { z } from 'zod';

export const searchNormasSchema = z.object({
  discipline: z.string().optional(),
  search: z.string().optional(),
});

export const searchExternalSchema = z.object({
  q: z.string().min(1, 'Termo de busca é obrigatório'),
});

export type SearchNormasInput = z.infer<typeof searchNormasSchema>;
export type SearchExternalInput = z.infer<typeof searchExternalSchema>;
