import { z } from 'zod';
import { NOTIFICATION_TYPES } from '../../config/constants';

export const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string().min(1),
  body: z.string().optional(),
  data: z.record(z.any()).default({}),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
