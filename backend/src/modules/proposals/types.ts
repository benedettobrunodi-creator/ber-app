import { z } from 'zod';
import { PROPOSAL_STATUSES } from '../../config/constants';

export const createProposalSchema = z.object({
  clientName: z.string().min(1),
  title: z.string().min(1),
  value: z.number().positive().optional(),
  status: z.enum(PROPOSAL_STATUSES).default('leads_info'),
  sentDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const updateProposalSchema = z.object({
  clientName: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  value: z.number().positive().optional(),
  status: z.enum(PROPOSAL_STATUSES).optional(),
  sentDate: z.string().datetime().nullable().optional(),
  closedDate: z.string().datetime().nullable().optional(),
  notes: z.string().optional(),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>;
