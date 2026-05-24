import { z } from 'zod';

export const CLIMA_VALUES = ['sol', 'parcialmente_nublado', 'nublado', 'chuva', 'tempestade'] as const;
export const CONDICAO_TRABALHO_VALUES = ['normal', 'parcial', 'interrompido'] as const;
export const ATIVIDADE_STATUS_VALUES = ['em_andamento', 'concluida', 'nao_realizada', 'parcial'] as const;
export const OCORRENCIA_TIPO_VALUES = ['incidente', 'imprevisto', 'atraso', 'qualidade', 'seguranca', 'outro'] as const;
export const VISITA_TIPO_VALUES = ['cliente', 'fiscalizacao', 'fornecedor', 'projetista', 'outro'] as const;
export const EFETIVO_CATEGORIAS = ['pedreiro', 'servente', 'encarregado', 'eletricista', 'carpinteiro', 'armador', 'pintor', 'gesseiro', 'outro'] as const;

export const createDiarioSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data deve ser YYYY-MM-DD'),
  clima: z.enum(CLIMA_VALUES).optional(),
  condicaoTrabalho: z.enum(CONDICAO_TRABALHO_VALUES).optional(),
  observacoesInternas: z.string().optional(),
  observacoesCliente: z.string().optional(),
});

export const updateDiarioSchema = z.object({
  clima: z.enum(CLIMA_VALUES).optional(),
  condicaoTrabalho: z.enum(CONDICAO_TRABALHO_VALUES).optional(),
  observacoesInternas: z.string().optional(),
  observacoesCliente: z.string().optional(),
  avancoDia: z.number().min(0).max(100).optional(),
});

export const createEfetivoSchema = z.object({
  userId: z.string().uuid().optional(),
  nomeExterno: z.string().min(1).optional(),
  funcao: z.string().optional(),
  categoria: z.string().optional(),
  quantidade: z.number().int().min(1).default(1),
  presente: z.boolean().default(true),
  observacao: z.string().optional(),
});

export const createAtividadeSchema = z.object({
  descricao: z.string().min(1),
  status: z.enum(ATIVIDADE_STATUS_VALUES),
  obraEtapaId: z.string().uuid().optional(),
});

export const createOcorrenciaSchema = z.object({
  tipo: z.enum(OCORRENCIA_TIPO_VALUES),
  descricao: z.string().min(1),
  visivelCliente: z.boolean().default(false),
});

export const createVisitaSchema = z.object({
  tipo: z.enum(VISITA_TIPO_VALUES),
  nome: z.string().optional(),
  observacao: z.string().optional(),
  visivelCliente: z.boolean().default(true),
});

export const createMaterialSchema = z.object({
  descricao: z.string().min(1),
  recebimentoMaterialId: z.string().uuid().optional(),
  quantidade: z.number().positive().optional(),
  unidade: z.string().max(20).optional(),
});

export const createFotoSchema = z.object({
  legenda: z.string().optional(),
  ambienteId: z.string().uuid().optional(),
  ordem: z.number().int().default(0),
});

export const createEquipamentoSchema = z.object({
  nome: z.string().min(1),
});

export type CreateDiarioInput = z.infer<typeof createDiarioSchema>;
export type UpdateDiarioInput = z.infer<typeof updateDiarioSchema>;
export type CreateEfetivoInput = z.infer<typeof createEfetivoSchema>;
export type CreateAtividadeInput = z.infer<typeof createAtividadeSchema>;
export type CreateOcorrenciaInput = z.infer<typeof createOcorrenciaSchema>;
export type CreateVisitaInput = z.infer<typeof createVisitaSchema>;
export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type CreateEquipamentoInput = z.infer<typeof createEquipamentoSchema>;
export type CreateFotoInput = z.infer<typeof createFotoSchema>;
