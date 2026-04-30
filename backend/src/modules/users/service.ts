import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { BCRYPT_SALT_ROUNDS } from '../../config/constants';
import { AppError } from '../../utils/errors';
import type { CreateUserInput, UpdateUserInput, UpdateProfileInput, ChangePasswordInput } from './types';

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  phone: true,
  avatarUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  customRoleId: true,
  customRole: { select: { id: true, name: true, permissions: true } },
};

export async function listUsers(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      select: userSelect,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where: { isActive: true } }),
  ]);
  return { users, total };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });
  if (!user) throw AppError.notFound('Usuário');
  return user;
}

export async function createUser(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict('Email já cadastrado');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role || 'campo',
      phone: input.phone,
      customRoleId: input.customRoleId ?? null,
    },
    select: userSelect,
  });
  return user;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw AppError.notFound('Usuário');

  const updated = await prisma.user.update({
    where: { id },
    data: input,
    select: userSelect,
  });
  return updated;
}

export async function deactivateUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw AppError.notFound('Usuário');

  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: input,
    select: userSelect,
  });
  return updated;
}

export async function updatePushToken(userId: string, pushToken: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { pushToken },
  });
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) throw AppError.notFound('Usuário');

  const isMatch = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!isMatch) throw AppError.badRequest('Senha atual incorreta');

  const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_SALT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}
