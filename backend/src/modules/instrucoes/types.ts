import { z } from 'zod';

const stepSchema = z.object({
  order: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  photoUrl: z.string().optional(),
  momento: z.enum(['inicio', 'conclusao']).default('conclusao'),
});

export const createITSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  discipline: z.string().min(1),
  objective: z.string().optional(),
  content: z.string().optional(),
  materials: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  steps: z.array(stepSchema).default([]),
  attentionPoints: z.array(z.string()).default([]),
  approvalCriteria: z.array(z.string()).default([]),
  relatedNormas: z.array(z.string().uuid()).default([]),
  normas: z.array(z.string()).default([]),
  epis: z.array(z.string()).default([]),
  preRequisitos: z.string().optional(),
  criteriosQualidade: z.string().optional(),
  errosComuns: z.string().optional(),
  fvsCode: z.string().optional(),
});

export const updateITSchema = createITSchema.partial();

export const publishITSchema = z.object({
  status: z.enum(['publicada', 'arquivada']),
});

export const bulkITSchema = z.object({
  items: z.array(createITSchema.extend({
    status: z.enum(['rascunho', 'publicada']).default('rascunho'),
  })),
});

export type CreateITInput = z.infer<typeof createITSchema>;
export type UpdateITInput = z.infer<typeof updateITSchema>;
export type BulkITInput = z.infer<typeof bulkITSchema>;
