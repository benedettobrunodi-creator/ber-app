import { z } from 'zod';

const stepSchema = z.object({
  order: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  photoUrl: z.string().optional(),
});

export const createITSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  discipline: z.string().min(1),
  objective: z.string().optional(),
  materials: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  steps: z.array(stepSchema).default([]),
  attentionPoints: z.array(z.string()).default([]),
  approvalCriteria: z.array(z.string()).default([]),
  relatedNormas: z.array(z.string().uuid()).default([]),
});

export const updateITSchema = createITSchema.partial();

export const publishITSchema = z.object({
  status: z.enum(['publicada', 'arquivada']),
});

export type CreateITInput = z.infer<typeof createITSchema>;
export type UpdateITInput = z.infer<typeof updateITSchema>;
