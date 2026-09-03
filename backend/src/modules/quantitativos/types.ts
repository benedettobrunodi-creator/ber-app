import { z } from 'zod';

export const QUANTITATIVO_STATUSES = ['pendente', 'processando', 'concluido', 'erro'] as const;
export type QuantitativoStatus = (typeof QUANTITATIVO_STATUSES)[number];

export const UNIDADES_VALIDAS = ['m2', 'ml', 'un', 'm3', 'vb'] as const;
export type UnidadeValida = (typeof UNIDADES_VALIDAS)[number];

export const createQuantitativoSchema = z.object({
  observacoes: z.string().max(2000).optional(),
});

export const updateQuantitativoSchema = z.object({
  observacoes: z.string().max(2000).optional(),
  status: z.enum(QUANTITATIVO_STATUSES).optional(),
});

export const createItemSchema = z.object({
  etapa: z.string().min(1).max(100),
  descricao: z.string().min(1),
  unidade: z.enum(UNIDADES_VALIDAS),
  quantidade: z.number().nonnegative(),
  origem: z.string().optional(),
  confianca: z.number().min(0).max(1).optional(),
});

export const updateItemSchema = z.object({
  etapa: z.string().min(1).max(100).optional(),
  descricao: z.string().min(1).optional(),
  unidade: z.enum(UNIDADES_VALIDAS).optional(),
  quantidade: z.number().nonnegative().optional(),
  origem: z.string().nullable().optional(),
  confianca: z.number().min(0).max(1).nullable().optional(),
  marcarRevisado: z.boolean().optional(),
});

export type CreateQuantitativoInput = z.infer<typeof createQuantitativoSchema>;
export type UpdateQuantitativoInput = z.infer<typeof updateQuantitativoSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
