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

export const updateDocumentoSchema = createDocumentoSchema.partial();

export const createRevisaoSchema = z.object({
  revisao: z.string().min(1).max(20),
  data: z.string().min(1),
  observacao: z.string().nullable().optional(),
});

export type CreateDocumentoInput = z.infer<typeof createDocumentoSchema>;
export type UpdateDocumentoInput = z.infer<typeof updateDocumentoSchema>;
export type CreateRevisaoInput = z.infer<typeof createRevisaoSchema>;
