import { z } from 'zod';

// APR
export const createAPRSchema = z.object({
  activityName: z.string().min(1),
  date: z.string(), // ISO date
  responsible: z.string().min(1),
  risks: z.array(z.object({
    description: z.string().min(1),
    severity: z.enum(['baixo', 'medio', 'alto', 'critico']),
    control: z.string().min(1),
  })).default([]),
});

export const updateAPRSchema = createAPRSchema.partial();

export const approveAPRSchema = z.object({
  status: z.enum(['aprovada', 'encerrada']),
});

// EPI
export const createEPISchema = z.object({
  userId: z.string().uuid(),
  epiName: z.string().min(1),
  epiType: z.string().min(1),
  deliveredAt: z.string(),
  expiresAt: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  caNumber: z.string().optional(),
});

export const updateEPISchema = z.object({
  returnedAt: z.string().optional(),
  expiresAt: z.string().optional(),
});

// Incident
export const createIncidentSchema = z.object({
  type: z.enum(['acidente', 'quase_acidente', 'condicao_insegura', 'ato_inseguro']),
  severity: z.enum(['leve', 'moderado', 'grave', 'fatal']),
  description: z.string().min(1),
  immediateAction: z.string().optional(),
  correctiveAction: z.string().optional(),
  occurredAt: z.string(),
  injuredUserId: z.string().uuid().optional(),
  photoUrls: z.array(z.string()).default([]),
  status: z.enum(['aberto', 'em_investigacao', 'encerrado']).default('aberto'),
});

export const updateIncidentSchema = createIncidentSchema.partial();

// Training
export const createTrainingSchema = z.object({
  userId: z.string().uuid(),
  obraId: z.string().uuid().optional(),
  trainingName: z.string().min(1),
  provider: z.string().optional(),
  nr: z.enum(['NR-18', 'NR-35', 'NR-06', 'NR-10', 'NR-33', 'outro']),
  completedAt: z.string(),
  expiresAt: z.string().optional(),
  certificateUrl: z.string().optional(),
});

export type CreateAPRInput = z.infer<typeof createAPRSchema>;
export type UpdateAPRInput = z.infer<typeof updateAPRSchema>;
export type CreateEPIInput = z.infer<typeof createEPISchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;
export type CreateTrainingInput = z.infer<typeof createTrainingSchema>;
