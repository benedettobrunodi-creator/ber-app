import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateTouchpointInput, UpdateTouchpointInput } from './types';

export async function listByObra(obraId: string, page: number, limit: number) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId } });
  if (!obra) throw AppError.notFound('Obra');

  const skip = (page - 1) * limit;
  const [touchpoints, total] = await Promise.all([
    prisma.clientTouchpoint.findMany({
      where: { obraId },
      include: {
        conductedBy: { select: { id: true, name: true, avatarUrl: true } },
        nextActionOwner: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.clientTouchpoint.count({ where: { obraId } }),
  ]);

  return { touchpoints, total };
}

export async function createTouchpoint(obraId: string, userId: string, input: CreateTouchpointInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId } });
  if (!obra) throw AppError.notFound('Obra');

  return prisma.clientTouchpoint.create({
    data: {
      obraId,
      type: input.type,
      title: input.title,
      occurredAt: new Date(input.occurredAt),
      conductedById: input.conductedById,
      clientContacts: input.clientContacts,
      architectContacts: input.architectContacts,
      summary: input.summary,
      nextAction: input.nextAction,
      nextActionDue: input.nextActionDue ? new Date(input.nextActionDue) : undefined,
      nextActionOwnerId: input.nextActionOwnerId,
      attachments: input.attachments,
      status: input.status,
      createdById: userId,
    },
    include: {
      conductedBy: { select: { id: true, name: true, avatarUrl: true } },
      nextActionOwner: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

export async function updateTouchpoint(id: string, input: UpdateTouchpointInput) {
  const existing = await prisma.clientTouchpoint.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Touchpoint');

  const data: any = { ...input };
  if (input.occurredAt) data.occurredAt = new Date(input.occurredAt);
  if (input.nextActionDue) data.nextActionDue = new Date(input.nextActionDue);

  return prisma.clientTouchpoint.update({
    where: { id },
    data,
    include: {
      conductedBy: { select: { id: true, name: true, avatarUrl: true } },
      nextActionOwner: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

export async function getPendingActions(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const where = { nextActionDue: { not: null } };

  const [touchpoints, total] = await Promise.all([
    prisma.clientTouchpoint.findMany({
      where,
      include: {
        obra: { select: { id: true, name: true, client: true } },
        nextActionOwner: { select: { id: true, name: true } },
      },
      orderBy: { nextActionDue: 'asc' },
      skip,
      take: limit,
    }),
    prisma.clientTouchpoint.count({ where }),
  ]);

  return { touchpoints, total };
}
