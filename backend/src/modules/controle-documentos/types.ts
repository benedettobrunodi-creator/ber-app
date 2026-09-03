import { z } from 'zod';

// Listas fixas (dropdown) em vez de texto livre — reduz variação de digitação
// que quebra filtro/agrupamento (achado real analisando planilha de controle
// do Bruno: "Instalações Elétricas" vs "Instalaçoes Elétricas").
export const DOCUMENTO_DISCIPLINAS = [
  'Arquitetura',
  'Estrutural',
  'Instalações Elétricas',
  'Hidráulica',
  'Ar Condicionado',
  'Combate a Incêndio',
  'Detecção e Alarme',
  'Cabeamento Estruturado',
  'SPK (Sprinklers)',
  'Divisórias',
  'Pedras',
  'Mobiliário',
  'Marcenaria',
  'Shop Drawings - Outros',
  'Projetos Técnicos - Outros',
  'Comunicação Visual',
  'Interiores',
  'Paisagismo',
  'Projeto Legal',
  'Outra',
] as const;

export const DOCUMENTO_ETAPAS = [
  'Conceito',
  'Anteprojeto (AP)',
  'Executivo (EX)',
  'Locação (LO)',
  'As Built',
] as const;

export const createDocumentoSchema = z.object({
  codigo: z.string().min(1).max(150),
  titulo: z.string().max(255).nullable().optional(),
  disciplina: z.enum(DOCUMENTO_DISCIPLINAS),
  projetista: z.string().max(150).nullable().optional(),
  etapa: z.enum(DOCUMENTO_ETAPAS).nullable().optional(),
});

export const updateDocumentoSchema = createDocumentoSchema.partial().extend({ obsoleto: z.boolean().optional() });

export const createRevisaoSchema = z.object({
  revisao: z.string().min(1).max(20),
  data: z.string().min(1),
  observacao: z.string().nullable().optional(),
});

// Edição de revisão existente (pedido Bruno 03/09: "quem decide a revisão?
// precisa ter como editar") — corrige rótulo/data/observação sem excluir+recriar.
export const updateRevisaoSchema = z.object({
  revisao: z.string().min(1).max(20).optional(),
  data: z.string().min(1).optional(),
  observacao: z.string().nullable().optional(),
});
export type UpdateRevisaoInput = z.infer<typeof updateRevisaoSchema>;

// Metadados por arquivo no upload em lote (03/09/26): o front mostra uma tela
// de conferência antes de subir — usuário confirma código/revisão/disciplina
// de cada arquivo. `nome` casa com o originalname do arquivo no FormData.
export const bulkMetaItemSchema = z.object({
  nome: z.string().min(1).max(255),
  codigo: z.string().min(1).max(150),
  revisao: z.string().min(1).max(20),
  disciplina: z.enum(DOCUMENTO_DISCIPLINAS),
  titulo: z.string().max(255).nullable().optional(),
  projetista: z.string().max(150).nullable().optional(),
  observacao: z.string().max(1000).nullable().optional(), // comentário do lote → observação da revisão
});
export const bulkMetaSchema = z.array(bulkMetaItemSchema).max(200);
export type BulkMetaItem = z.infer<typeof bulkMetaItemSchema>;

export type CreateDocumentoInput = z.infer<typeof createDocumentoSchema>;
export type UpdateDocumentoInput = z.infer<typeof updateDocumentoSchema>;
export type CreateRevisaoInput = z.infer<typeof createRevisaoSchema>;
