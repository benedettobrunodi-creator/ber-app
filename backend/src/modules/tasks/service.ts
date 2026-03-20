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
  const task = await prisma.obraTask.findUnique({ where: { id } });
  if (!task) throw AppError.notFound('Task');

  // Get max position in the target column
  const maxPos = await prisma.obraTask.aggregate({
    where: { obraId: task.obraId, status },
    _max: { position: true },
  });

  return prisma.obraTask.update({
    where: { id },
    data: {
      status,
      position: (maxPos._max.position ?? -1) + 1,
    },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
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
