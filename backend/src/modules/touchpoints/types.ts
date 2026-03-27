import { z } from 'zod';

const TOUCHPOINT_TYPES = [
  'kickoff_externo',
  'reuniao_semanal',
  'comunicado_semanal',
  'extra_aditivo',
  'aceite_provisorio',
  'aceite_definitivo',
  'visita_informal',
] as const;

const TOUCHPOINT_STATUSES = ['realizado', 'pendente_ata', 'ata_enviada'] as const;

export const createTouchpointSchema = z.object({
  type: z.enum(TOUCHPOINT_TYPES),
  title: z.string().min(2).max(255),
  occurredAt: z.string().datetime(),
  conductedById: z.string().uuid().optional(),
  clientContacts: z.array(z.string()).default([]),
  architectContacts: z.array(z.string()).default([]),
  summary: z.string().optional(),
  nextAction: z.string().optional(),
  nextActionDue: z.string().optional(),
  nextActionOwnerId: z.string().uuid().optional(),
  attachments: z.array(z.string()).default([]),
  status: z.enum(TOUCHPOINT_STATUSES).default('realizado'),
});

export const updateTouchpointSchema = z.object({
  type: z.enum(TOUCHPOINT_TYPES).optional(),
  title: z.string().min(2).max(255).optional(),
  occurredAt: z.string().datetime().optional(),
  conductedById: z.string().uuid().optional(),
  clientContacts: z.array(z.string()).optional(),
  architectContacts: z.array(z.string()).optional(),
  summary: z.string().optional(),
  nextAction: z.string().optional(),
  nextActionDue: z.string().optional(),
  nextActionOwnerId: z.string().uuid().optional(),
  attachments: z.array(z.string()).optional(),
  status: z.enum(TOUCHPOINT_STATUSES).optional(),
});

export type CreateTouchpointInput = z.infer<typeof createTouchpointSchema>;
export type UpdateTouchpointInput = z.infer<typeof updateTouchpointSchema>;
