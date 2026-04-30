import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { BCRYPT_SALT_ROUNDS } from '../../config/constants';
import { AppError } from '../../utils/errors';
import type { LoginInput, ForgotPasswordInput, ResetPasswordInput } from './types';
import type { JwtPayload } from '../../middleware/auth';

// In-memory store for reset tokens (use Redis in production)
const resetTokens = new Map<string, { userId: string; expiresAt: Date }>();

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (!user || !user.isActive) {
    throw AppError.unauthorized('Email ou senha inválidos');
  }

  const validPassword = await bcrypt.compare(input.password, user.passwordHash);
  if (!validPassword) {
    throw AppError.unauthorized('Email ou senha inválidos');
  }

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtAccessExpiry,
  });

  const refreshToken = jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiry,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl,
      permissions: user.permissions as Record<string, boolean>,
    },
  };
}

export async function refresh(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, env.jwtRefreshSecret) as JwtPayload;

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) {
      throw AppError.unauthorized('Usuário não encontrado ou inativo');
    }

    const newPayload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(newPayload, env.jwtSecret, {
      expiresIn: env.jwtAccessExpiry,
    });

    const newRefreshToken = jwt.sign(newPayload, env.jwtRefreshSecret, {
      expiresIn: env.jwtRefreshExpiry,
    });

    return { accessToken, refreshToken: newRefreshToken };
  } catch {
    throw AppError.unauthorized('Refresh token inválido ou expirado');
  }
}

export async function forgotPassword(input: ForgotPasswordInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Always return success to prevent email enumeration
  if (!user || !user.isActive) {
    return { message: 'Se o email existir, enviaremos um link de recuperação' };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + env.resetTokenExpiryHours * 60 * 60 * 1000);

  resetTokens.set(token, { userId: user.id, expiresAt });

  // TODO: Send email with reset link
  // const resetLink = `${env.frontendUrl}/reset-password?token=${token}`;
  console.log(`[DEV] Password reset token for ${user.email}: ${token}`);

  return { message: 'Se o email existir, enviaremos um link de recuperação' };
}

export async function resetPassword(input: ResetPasswordInput) {
  const stored = resetTokens.get(input.token);
  if (!stored || stored.expiresAt < new Date()) {
    throw AppError.badRequest('Token inválido ou expirado', 'INVALID_TOKEN');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
  await prisma.user.update({
    where: { id: stored.userId },
    data: { passwordHash },
  });

  resetTokens.delete(input.token);

  return { message: 'Senha alterada com sucesso' };
}
