import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateTaskInput, UpdateTaskInput } from './types';

export async function listTasks(obraId: string, status?: string) {
  const where: any = { obraId };
  if (status) where.status = status;

  return prisma.obraTask.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      creator: { select: { id: true, name: true } },
    },
    orderBy: [{ status: 'asc' }, { position: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function createTask(obraId: string, createdBy: string, input: CreateTaskInput) {
  // Get the max position for the target status column
  const maxPos = await prisma.obraTask.aggregate({
    where: { obraId, status: input.status || 'todo' },
    _max: { position: true },
  });

  return prisma.obraTask.create({
    data: {
      obraId,
      createdBy,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      assignedTo: input.assignedTo,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      position: input.position ?? (maxPos._max.position ?? -1) + 1,
    },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      creator: { select: { id: true, name: true } },
    },
  });
}

export async function updateTask(id: string, input: UpdateTaskInput) {
  const task = await prisma.obraTask.findUnique({ where: { id } });
  if (!task) throw AppError.notFound('Task');

  const data: any = { ...input };
  if (input.dueDate !== undefined) {
    data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  }

  return prisma.obraTask.update({
    where: { id },
    data,
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
      creator: { select: { id: true, name: true } },
    },
  });
}

export async function updateStatus(id: string, status: string) {
  const task = await prisma.obraTask.findUnique({
    where: { id },
    select: { id: true, obraId: true, completedAt: true },
  });
  if (!task) throw AppError.notFound('Task');

  // Get max position in the target column
  const maxPos = await prisma.obraTask.aggregate({
    where: { obraId: task.obraId, status },
    _max: { position: true },
  });

  const completedAtUpdate =
    status === 'done' && task.completedAt === null
      ? { completedAt: new Date() }
      : status !== 'done'
      ? { completedAt: null }
      : {};

  return prisma.obraTask.update({
    where: { id },
    data: {
      status,
      position: (maxPos._max.position ?? -1) + 1,
      ...completedAtUpdate,
    },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function getBurndown(obraId: string) {
  const obra = await prisma.obra.findUnique({
    where: { id: obraId },
    select: { startDate: true, expectedEndDate: true },
  });

  if (!obra?.startDate || !obra?.expectedEndDate) {
    return { hasData: false, reason: 'missing_dates' as const, total: 0, series: [], currentRemaining: 0, expectedRemaining: 0, pctComplete: 0, pctExpected: 0, status: 'on_track' as const, startDate: null, endDate: null };
  }

  const tasks = await prisma.obraTask.findMany({
    where: { obraId },
    select: { status: true, completedAt: true },
  });

  const total = tasks.length;
  if (total === 0) return { hasData: false, reason: 'no_tasks' as const, total: 0, series: [], currentRemaining: 0, expectedRemaining: 0, pctComplete: 0, pctExpected: 0, status: 'on_track' as const, startDate: null, endDate: null };

  const start = obra.startDate;
  const end = obra.expectedEndDate;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const totalDays = Math.max(1, (end.getTime() - start.getTime()) / 86400000);

  const completedByDate: Record<string, number> = {};
  for (const t of tasks) {
    if (t.status === 'done' && t.completedAt) {
      const key = t.completedAt.toISOString().split('T')[0];
      completedByDate[key] = (completedByDate[key] ?? 0) + 1;
    }
  }

  const series: { date: string; remaining: number; ideal: number }[] = [];
  let cumDone = 0;
  const chartEnd = today < end ? today : end;
  const cur = new Date(start);

  while (cur <= chartEnd) {
    const key = cur.toISOString().split('T')[0];
    cumDone += completedByDate[key] ?? 0;
    const dayNum = (cur.getTime() - start.getTime()) / 86400000;
    series.push({
      date: key,
      remaining: total - cumDone,
      ideal: Math.max(0, Math.round(total * (1 - dayNum / totalDays))),
    });
    cur.setDate(cur.getDate() + 1);
  }

  const currentRemaining = total - cumDone;
  const latestIdeal = series[series.length - 1]?.ideal ?? total;
  const pctComplete = Math.round(((total - currentRemaining) / total) * 100);
  const pctExpected = Math.round(((total - latestIdeal) / total) * 100);
  const burnStatus: 'ahead' | 'behind' | 'on_track' = currentRemaining < latestIdeal ? 'ahead' : currentRemaining > latestIdeal ? 'behind' : 'on_track';

  return {
    hasData: true,
    total,
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
    series,
    currentRemaining,
    expectedRemaining: latestIdeal,
    pctComplete,
    pctExpected,
    status: burnStatus,
    reason: null,
  };
}

export async function updatePosition(id: string, position: number, status?: string) {
  const task = await prisma.obraTask.findUnique({ where: { id } });
  if (!task) throw AppError.notFound('Task');

  const targetStatus = status || task.status;

  // Shift other tasks to make room
  await prisma.obraTask.updateMany({
    where: {
      obraId: task.obraId,
      status: targetStatus,
      position: { gte: position },
      id: { not: id },
    },
    data: { position: { increment: 1 } },
  });

  return prisma.obraTask.update({
    where: { id },
    data: { position, status: targetStatus },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function deleteTask(id: string) {
  const task = await prisma.obraTask.findUnique({ where: { id } });
  if (!task) throw AppError.notFound('Task');

  await prisma.obraTask.delete({ where: { id } });
}

export async function getTaskObraId(taskId: string): Promise<string> {
  const task = await prisma.obraTask.findUnique({ where: { id: taskId }, select: { obraId: true } });
  if (!task) throw AppError.notFound('Task');
  return task.obraId;
}
