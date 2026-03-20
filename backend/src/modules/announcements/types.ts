import { z } from 'zod';
import { ANNOUNCEMENT_CATEGORIES, ROLES } from '../../config/constants';

export const createAnnouncementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  category: z.enum(ANNOUNCEMENT_CATEGORIES).default('informativo'),
  targetRoles: z.array(z.enum(ROLES)).default(['diretoria', 'coordenacao', 'gestor', 'campo']),
  pinned: z.boolean().default(false),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  category: z.enum(ANNOUNCEMENT_CATEGORIES).optional(),
  targetRoles: z.array(z.enum(ROLES)).optional(),
  pinned: z.boolean().optional(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
