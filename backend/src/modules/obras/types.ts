import { z } from 'zod';
import { OBRA_STATUSES } from '../../config/constants';

export const createObraSchema = z.object({
  name: z.string().min(2),
  client: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(OBRA_STATUSES).default('planejamento'),
  startDate: z.string().datetime().optional(),
  expectedEndDate: z.string().datetime().optional(),
  coordinatorId: z.string().uuid().optional(),
  arquiteturaEscritorio: z.string().optional(),
  gerenciadora: z.string().optional(),
  areaM2: z.number().positive().optional(),
});

export const updateObraSchema = z.object({
  name: z.string().min(2).optional(),
  client: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(OBRA_STATUSES).optional(),
  startDate: z.string().datetime().optional().nullable(),
  expectedEndDate: z.string().datetime().optional().nullable(),
  actualEndDate: z.string().datetime().optional().nullable(),
  progressPercent: z.number().min(0).max(100).optional(),
  coordinatorId: z.string().uuid().optional(),
  dataInicioProjeto: z.string().optional().nullable(),
  dataFimProjeto: z.string().optional().nullable(),
  dataInicioObra: z.string().optional().nullable(),
  dataFimObra: z.string().optional().nullable(),
  valorContrato: z.number().positive().optional().nullable(),
  situacaoAtual: z.string().optional().nullable(),
  arquiteturaEscritorio: z.string().optional().nullable(),
  gerenciadora: z.string().optional().nullable(),
  areaM2: z.number().positive().optional().nullable(),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum([
    'coordenador', 'gestor', 'engenheiro', 'mestre_obras',
    'encarregado', 'tecnico', 'comprador', 'auxiliar', 'estagiario', 'membro',
  ]).default('membro'),
});

export type CreateObraInput = z.infer<typeof createObraSchema>;
export type UpdateObraInput = z.infer<typeof updateObraSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
