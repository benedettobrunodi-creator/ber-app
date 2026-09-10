import { z } from 'zod';

export const respostaSchema = z.object({
  categoriaKey: z.string().min(1).max(30),
  itemKey: z.string().min(1).max(30),
  resposta: z.enum(['sim', 'nao', 'na']),
  observacao: z.string().max(2000).nullable().optional(),
  /** URL já subida via /foto-temp (upload em segundo plano) */
  fotoUrl: z.string().url().max(500).nullable().optional(),
});

export const createVistoriaSchema = z.object({
  respostas: z.array(respostaSchema).min(1).max(100),
  observacoes: z.string().max(5000).nullable().optional(),
  /** Data da vistoria (YYYY-MM-DD) — permite registro retroativo; default hoje. */
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Quem acompanhou a visita pela obra (ciência) — vira registro e sai no PDF. */
  cienciaNome: z.string().max(150).nullable().optional(),
  /** Atividades em execução no momento (itCode = IT do catálogo; sem itCode = texto livre). */
  atividades: z.array(z.object({
    itCode: z.string().max(20).nullable().optional(),
    titulo: z.string().min(1).max(200),
    /** Frente de serviço/trecho (reforma 10/09) — vira o trecho da FVS */
    trecho: z.string().max(150).nullable().optional(),
    // Conferência com projeto (Bruno 10/09/26) — categoria 'Aderência ao Projeto'
    projetoDisciplina: z.string().max(80).nullable().optional(),
    revisaoOk: z.enum(['sim', 'nao', 'na']).nullable().optional(),
    conformeProjeto: z.enum(['sim', 'nao', 'na']).nullable().optional(),
    projetoObs: z.string().max(2000).nullable().optional(),
  })).max(40).optional(),
});

export const resolverPendenciaSchema = z.object({
  resolvido: z.boolean(),
});

/** Pendência com dono e prazo (10/09) */
export const atribuirPendenciaSchema = z.object({
  responsavelId: z.string().uuid().nullable().optional(),
  prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const responderFvsSchema = z.object({
  respostas: z.array(z.object({
    itemId: z.string().uuid(),
    resposta: z.enum(['conforme', 'nao_conforme', 'na']),
    observacao: z.string().max(2000).nullable().optional(),
  })).min(1).max(60),
  trecho: z.string().max(150).nullable().optional(),
});

export type CreateVistoriaInput = z.infer<typeof createVistoriaSchema>;
