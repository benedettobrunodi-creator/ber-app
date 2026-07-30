import { z } from 'zod';

export const upsertKickoffSchema = z.object({
  dataRealizada:  z.string().optional().nullable(),
  participantes:  z.array(z.object({ nome: z.string().min(1), papel: z.string().optional().nullable() })).optional(),
  pautaCoberta:   z.string().optional().nullable(),
  decisoes:       z.string().optional().nullable(),
  premissas:      z.string().optional().nullable(),
  riscosIniciais: z.string().optional().nullable(),
  // Cabeçalho novo (planilha Kickoff obra)
  coordenador:    z.string().optional().nullable(),
  engenheiro:     z.string().optional().nullable(),
  supervisor:     z.string().optional().nullable(),
  mestreEncarregado: z.string().optional().nullable(),
  inicioObra:     z.string().optional().nullable(),
  terminoObra:    z.string().optional().nullable(),
  dataKickoff:    z.string().optional().nullable(),
  // Comercial x Engenharia: { comercial, pmo, suprimentos, orcamentos, financeiro, coordenador, engenheiro }
  participantesDeptos: z.record(z.string(), z.string()).optional(),
});

export const updateKickoffItemSchema = z.object({
  responsavel: z.string().optional().nullable(),
  naRede:      z.enum(['sim', 'nao', 'na']).optional().nullable(),
  dataAlvo:    z.string().optional().nullable(),
  status:      z.enum(['concluido', 'em_andamento', 'atrasado', 'na']).optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export type UpsertKickoffInput = z.infer<typeof upsertKickoffSchema>;
export type UpdateKickoffItemInput = z.infer<typeof updateKickoffItemSchema>;
