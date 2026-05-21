import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Resend } from 'resend';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { BCRYPT_SALT_ROUNDS } from '../../config/constants';
import { AppError } from '../../utils/errors';
import type { LoginInput, ForgotPasswordInput, ResetPasswordInput } from './types';
import type { JwtPayload } from '../../middleware/auth';

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

  // Remove tokens anteriores não usados
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + env.resetTokenExpiryHours * 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { token, userId: user.id, expiresAt },
  });

  const resetLink = `${env.frontendUrl}/reset-password?token=${token}`;

  const resendApiKey = env.resendApiKey;
  const fromEmail = resendApiKey ? env.resendFrom : 'BER App <onboarding@resend.dev>';

  if (resendApiKey) {
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: fromEmail,
      to: user.email,
      subject: 'Recuperação de senha — BER App',
      html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#D8DDD8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#D8DDD8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #e5e7eb;">
              <h1 style="margin:0;font-size:24px;font-weight:900;letter-spacing:0.15em;color:#2D2D2D;">BER</h1>
              <p style="margin:4px 0 0;font-size:10px;font-weight:600;letter-spacing:0.2em;color:#6B7280;text-transform:uppercase;">Engenharia e Gerenciamento</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#2D2D2D;">Olá, ${user.name}.</p>
              <p style="margin:0 0 24px;font-size:14px;color:#4B5563;line-height:1.6;">
                Recebemos uma solicitação para redefinir a senha da sua conta no BER App. Clique no botão abaixo para criar uma nova senha.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display:inline-block;background-color:#2D2D2D;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:6px;letter-spacing:0.05em;">
                      Redefinir senha
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;color:#9CA3AF;line-height:1.6;">
                Este link expira em ${env.resetTokenExpiryHours} horas. Se você não solicitou a redefinição, ignore este email.
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#D1D5DB;word-break:break-all;">
                ${resetLink}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    });
  } else {
    console.log(`[DEV] Password reset link for ${user.email}: ${resetLink}`);
  }

  return { message: 'Se o email existir, enviaremos um link de recuperação' };
}

export async function resetPassword(input: ResetPasswordInput) {
  const stored = await prisma.passwordResetToken.findFirst({
    where: {
      token: input.token,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!stored) {
    throw AppError.badRequest('Token inválido ou expirado', 'INVALID_TOKEN');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

  await prisma.user.update({
    where: { id: stored.userId },
    data: { passwordHash },
  });

  await prisma.passwordResetToken.update({
    where: { id: stored.id },
    data: { usedAt: new Date() },
  });

  return { message: 'Senha alterada com sucesso' };
}
