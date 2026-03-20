import { z } from 'zod';

export const answerCanteiroItemSchema = z.object({
  answer: z.enum(['conforme', 'nao_conforme', 'nao_aplicavel']),
  photoUrl: z.string().optional(),
  observation: z.string().optional(),
});

export const approveCanteiroSchema = z.object({
  status: z.enum(['aprovado', 'reprovado']),
});

export type AnswerCanteiroItemInput = z.infer<typeof answerCanteiroItemSchema>;
export type ApproveCanteiroInput = z.infer<typeof approveCanteiroSchema>;
