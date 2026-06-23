import { z } from 'zod';

export const issueAcessoSchema = z.object({
  email:    z.string().email(),
  nome:     z.string().min(1),
  expiraEm: z.string().optional().nullable(),
});

export const aprovarSchema = z.object({
  comentario: z.string().optional().nullable(),
});

export const contestarSchema = z.object({
  comentario: z.string().min(1, 'Comentário obrigatório ao contestar'),
});

export type IssueAcessoInput = z.infer<typeof issueAcessoSchema>;
export type AprovarInput     = z.infer<typeof aprovarSchema>;
export type ContestarInput   = z.infer<typeof contestarSchema>;
