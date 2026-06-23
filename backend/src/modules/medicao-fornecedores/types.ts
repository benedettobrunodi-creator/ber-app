import { z } from 'zod';

export const TipoFornecedor = z.enum(['terceiro_ber_paga', 'terceiro_fatura_direto', 'miscelaneos_ber']);

export const createFornecedorSchema = z.object({
  razaoSocial: z.string().min(1),
  cnpj:        z.string().optional().nullable(),
  contato:     z.string().optional().nullable(),
});

export const updateFornecedorSchema = createFornecedorSchema.partial();

// Quick add — replica adicionarFornecedorRapido do ber-medicao.
// Cria (ou reaproveita) Fornecedor por razão social + cria EtapaFornecedor + cria MedicaoItem
// zerado se medicaoId vier (e estiver em rascunho).
export const quickAddSchema = z.object({
  razaoSocial:     z.string().min(1),
  valorContratado: z.union([z.number(), z.string()]),
  tipo:            TipoFornecedor.default('terceiro_ber_paga'),
  escopo:          z.string().optional().nullable(),
  cnpj:            z.string().optional().nullable(),
  contato:         z.string().optional().nullable(),
  medicaoId:       z.string().uuid().optional(),
});

export const updateEtapaFornecedorSchema = z.object({
  escopo:          z.string().optional().nullable(),
  tipo:            TipoFornecedor.optional(),
  valorContratado: z.union([z.number(), z.string()]).optional(),
  fornecedorId:    z.string().uuid().optional().nullable(),
});

export type CreateFornecedorInput     = z.infer<typeof createFornecedorSchema>;
export type UpdateFornecedorInput     = z.infer<typeof updateFornecedorSchema>;
export type QuickAddInput             = z.infer<typeof quickAddSchema>;
export type UpdateEtapaFornInput      = z.infer<typeof updateEtapaFornecedorSchema>;
