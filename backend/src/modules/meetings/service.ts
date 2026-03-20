import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateMeetingInput, UpdateMeetingInput } from './types';

export async function listMeetings(page: number, limit: number, startDate?: string, endDate?: string) {
  const skip = (page - 1) * limit;
  const where: any = {};

  if (startDate || endDate) {
    where.startTime = {};
    if (startDate) where.startTime.gte = new Date(startDate);
    if (endDate) where.startTime.lte = new Date(endDate);
  }

  const [meetings, total] = await Promise.all([
    prisma.meeting.findMany({
      where,
      include: {
        proposal: { select: { id: true, title: true, clientName: true } },
        creator: { select: { id: true, name: true } },
      },
      orderBy: { startTime: 'asc' },
      skip,
      take: limit,
    }),
    prisma.meeting.count({ where }),
  ]);
  return { meetings, total };
}

export async function getUpcoming() {
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  return prisma.meeting.findMany({
    where: {
      startTime: { gte: now, lte: in48h },
    },
    include: {
      proposal: { select: { id: true, title: true, clientName: true } },
      creator: { select: { id: true, name: true } },
    },
    orderBy: { startTime: 'asc' },
  });
}

export async function createMeeting(createdBy: string, input: CreateMeetingInput) {
  return prisma.meeting.create({
    data: {
      title: input.title,
      description: input.description,
      clientName: input.clientName,
      location: input.location,
      startTime: new Date(input.startTime),
      endTime: new Date(input.endTime),
      proposalId: input.proposalId,
      createdBy,
    },
    include: {
      proposal: { select: { id: true, title: true } },
      creator: { select: { id: true, name: true } },
    },
  });
}

export async function updateMeeting(id: string, input: UpdateMeetingInput) {
  const existing = await prisma.meeting.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Reunião');

  const data: any = { ...input };
  if (input.startTime) data.startTime = new Date(input.startTime);
  if (input.endTime) data.endTime = new Date(input.endTime);
  if (input.proposalId === null) data.proposalId = null;

  return prisma.meeting.update({
    where: { id },
    data,
    include: {
      proposal: { select: { id: true, title: true } },
      creator: { select: { id: true, name: true } },
    },
  });
}

export async function deleteMeeting(id: string) {
  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting) throw AppError.notFound('Reunião');
  await prisma.meeting.delete({ where: { id } });
}

// Google Calendar sync placeholder
export async function syncFromGoogleCalendar() {
  // TODO: Implement Google Calendar API sync
  // 1. Authenticate with Google service account
  // 2. Fetch events from calendar using env.googleCalendarId
  // 3. Upsert meetings with googleEventId
  // 4. Send push notifications for upcoming meetings
  console.log('[Google Calendar Sync] Placeholder - not yet implemented');
  return { synced: 0, created: 0, updated: 0, message: 'Google Calendar sync not yet configured' };
}
