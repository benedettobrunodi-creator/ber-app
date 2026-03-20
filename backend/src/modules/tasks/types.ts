import { z } from 'zod';
import { TASK_STATUSES, TASK_PRIORITIES } from '../../config/constants';

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(TASK_STATUSES).default('todo'),
  priority: z.enum(TASK_PRIORITIES).default('medium'),
  assignedTo: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  position: z.number().int().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(TASK_STATUSES),
});

export const updatePositionSchema = z.object({
  position: z.number().int().min(0),
  status: z.enum(TASK_STATUSES).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
