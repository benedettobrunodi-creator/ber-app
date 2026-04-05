import { z } from 'zod';
import { ROLES } from '../../config/constants';

export const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  role: z.enum(ROLES).default('campo'),
  phone: z.string().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(ROLES).optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
  customRoleId: z.string().uuid().nullable().optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

export const pushTokenSchema = z.object({
  pushToken: z.string().min(1, 'Push token é obrigatório'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
