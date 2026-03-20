import { z } from 'zod';

export const createChecklistSchema = z.object({
  templateId: z.string().uuid(),
});

export const answerItemSchema = z.object({
  answer: z.enum(['sim', 'nao', 'pendente']),
  photoUrl: z.string().optional(),
  observation: z.string().optional(),
  responsibleId: z.string().uuid().optional(),
});

export const addItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;
export type AnswerItemInput = z.infer<typeof answerItemSchema>;
export type AddItemInput = z.infer<typeof addItemSchema>;
