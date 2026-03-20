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
});

export const updateObraSchema = z.object({
  name: z.string().min(2).optional(),
  client: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(OBRA_STATUSES).optional(),
  startDate: z.string().datetime().optional(),
  expectedEndDate: z.string().datetime().optional(),
  actualEndDate: z.string().datetime().optional(),
  progressPercent: z.number().min(0).max(100).optional(),
  coordinatorId: z.string().uuid().optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['coordenador', 'gestor', 'membro']).default('membro'),
});

export type CreateObraInput = z.infer<typeof createObraSchema>;
export type UpdateObraInput = z.infer<typeof updateObraSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
