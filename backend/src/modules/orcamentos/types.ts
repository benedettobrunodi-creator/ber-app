import { z } from 'zod';

export const ORCAMENTO_STATUSES = [
  'A_INICIAR', 'PRODUZINDO', 'REVISAO', 'ENVIADO', 'AGUARDANDO',
  'APROVADO', 'ENTREGUE', 'DECLINADO', 'NO_GO', 'CHANGE_ORDER',
  'FASTERRA', 'PRODUZIR',
] as const;
export type OrcamentoStatus = (typeof ORCAMENTO_STATUSES)[number];

export const ORCAMENTO_CATEGORIAS = ['EM_ANDAMENTO', 'A_INICIAR', 'SEM_ACAO'] as const;
export type OrcamentoCategoria = (typeof ORCAMENTO_CATEGORIAS)[number];

export const ORCAMENTO_TIPOS = ['NOVO', 'REVISAO'] as const;
export type OrcamentoTipo = (typeof ORCAMENTO_TIPOS)[number];

// Deriva categoria automaticamente a partir do status
export function categoriaFromStatus(status: string): OrcamentoCategoria {
  if (status === 'A_INICIAR') return 'A_INICIAR';
  if (['ENTREGUE', 'DECLINADO', 'NO_GO'].includes(status)) return 'SEM_ACAO';
  return 'EM_ANDAMENTO';
}

export const SEGMENTOS = [
  'Corporativo', 'Residencial', 'Industrial', 'Igreja', 'Hotel', 'Outros',
] as const;

const dateOrNull = z.string().nullable().optional().transform((v) =>
  v ? new Date(v) : undefined,
);

export const createOrcamentoSchema = z.object({
  numero: z.string().min(1).max(20),
  cliente: z.string().min(1).max(255),
  descricaoCurta: z.string().max(500).optional(),
  m2: z.number().positive().optional(),
  valorVenda: z.number().positive().optional(),
  segmento: z.enum(SEGMENTOS).optional(),
  estrategico: z.boolean().default(false),
  tipo: z.enum(ORCAMENTO_TIPOS).default('NOVO'),
  status: z.enum(ORCAMENTO_STATUSES).default('A_INICIAR'),
  dataInicio: dateOrNull,
  dataFim: dateOrNull,
  dataEntrega: dateOrNull,
  responsavelId: z.string().uuid().optional().nullable(),
  observacoes: z.string().optional(),
  changeOrderDe: z.string().uuid().optional().nullable(),
});

export const updateOrcamentoSchema = createOrcamentoSchema.partial();

export type CreateOrcamentoInput = z.infer<typeof createOrcamentoSchema>;
export type UpdateOrcamentoInput = z.infer<typeof updateOrcamentoSchema>;
