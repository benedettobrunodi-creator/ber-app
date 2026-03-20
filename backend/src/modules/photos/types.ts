import { z } from 'zod';

export const uploadPhotoSchema = z.object({
  caption: z.string().optional(),
});

export const createCommentSchema = z.object({
  body: z.string().min(1),
});

export type UploadPhotoInput = z.infer<typeof uploadPhotoSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
