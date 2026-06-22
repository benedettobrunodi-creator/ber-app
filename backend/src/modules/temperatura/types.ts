import { z } from 'zod';

export const TIPOS_TEMPERATURA = ['pos_venda', 'pos_kickoff', 'quinzenal', 'entrega_substancial', 'entrega_final'] as const;
export const AVALIACOES_TEMPERATURA = ['Muito Ruim', 'Ruim', 'Regular', 'Bom', 'Muito Bom', 'Ótimo'] as const;

export const createTemperaturaSchema = z.object({
  tipo:       z.enum(TIPOS_TEMPERATURA),
  data:       z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Data inválida (esperado YYYY-MM-DD)'),
  avaliacao:  z.enum(AVALIACOES_TEMPERATURA),
  observacao: z.string().optional().nullable(),
});

export const updateTemperaturaSchema = createTemperaturaSchema.partial();

export type CreateTemperaturaInput = z.infer<typeof createTemperaturaSchema>;
export type UpdateTemperaturaInput = z.infer<typeof updateTemperaturaSchema>;
