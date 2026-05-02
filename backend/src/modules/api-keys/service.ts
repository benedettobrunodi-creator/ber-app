import crypto from 'crypto';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';

function hashKey(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function list(userId: string) {
  return prisma.apiKey.findMany({
    where: { createdById: userId },
    select: { id: true, name: true, keyPrefix: true, active: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function create(userId: string, name: string) {
  const raw = `ber_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = hashKey(raw);
  const keyPrefix = raw.slice(0, 8);

  await prisma.apiKey.create({
    data: { name, keyHash, keyPrefix, createdById: userId },
  });

  return raw; // returned only once
}

export async function revoke(id: string, userId: string) {
  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key) throw AppError.notFound('API Key');
  if (key.createdById !== userId) throw AppError.forbidden();
  await prisma.apiKey.update({ where: { id }, data: { active: false } });
}

export async function validateKey(raw: string) {
  const keyHash = hashKey(raw);
  const key = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!key || !key.active) return null;
  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return key;
}
