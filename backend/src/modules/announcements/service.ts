import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateAnnouncementInput, UpdateAnnouncementInput } from './types';

export async function listAnnouncements(page: number, limit: number, userRole: string) {
  const skip = (page - 1) * limit;

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where: { targetRoles: { has: userRole } },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { reads: true } },
      },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.announcement.count({ where: { targetRoles: { has: userRole } } }),
  ]);
  return { announcements, total };
}

export async function getAnnouncementById(id: string, userId: string) {
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { reads: true } },
    },
  });
  if (!announcement) throw AppError.notFound('Comunicado');

  // Mark as read
  await prisma.announcementRead.upsert({
    where: { announcementId_userId: { announcementId: id, userId } },
    create: { announcementId: id, userId },
    update: { readAt: new Date() },
  });

  return announcement;
}

export async function createAnnouncement(authorId: string, input: CreateAnnouncementInput) {
  return prisma.announcement.create({
    data: {
      title: input.title,
      body: input.body,
      category: input.category,
      targetRoles: input.targetRoles,
      pinned: input.pinned,
      authorId,
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function updateAnnouncement(id: string, input: UpdateAnnouncementInput) {
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Comunicado');

  return prisma.announcement.update({
    where: { id },
    data: input,
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function deleteAnnouncement(id: string) {
  const existing = await prisma.announcement.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Comunicado');
  await prisma.announcement.delete({ where: { id } });
}

export async function getReads(announcementId: string) {
  const announcement = await prisma.announcement.findUnique({ where: { id: announcementId } });
  if (!announcement) throw AppError.notFound('Comunicado');

  return prisma.announcementRead.findMany({
    where: { announcementId },
    include: { user: { select: { id: true, name: true, role: true, avatarUrl: true } } },
    orderBy: { readAt: 'desc' },
  });
}
