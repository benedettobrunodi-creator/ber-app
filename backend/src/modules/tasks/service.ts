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
  const cronograma = await prisma.cronograma.findFirst({
    where: { obraId },
    orderBy: { createdAt: 'desc' },
  });

  if (!cronograma?.parsedData) {
    return { hasData: false, reason: 'no_cronograma' as const, total: 0, series: [], currentRemaining: 0, expectedRemaining: 0, pctComplete: 0, pctExpected: 0, status: 'on_track' as const, startDate: null, endDate: null };
  }

  const parsed = cronograma.parsedData as {
    tarefas: { wbs: string; nome: string; inicio: string | null; fim: string | null; duracaoDias: number | null; percentualConcluido: number; ehResumo: boolean }[];
  };

  // Leaf tasks with dates and duration
  const leafTasks = parsed.tarefas.filter(
    (t) => !t.ehResumo && t.inicio && t.fim && (t.duracaoDias ?? 0) > 0
  );

  if (leafTasks.length === 0) {
    return { hasData: false, reason: 'no_tasks' as const, total: 0, series: [], currentRemaining: 0, expectedRemaining: 0, pctComplete: 0, pctExpected: 0, status: 'on_track' as const, startDate: null, endDate: null };
  }

  // Fetch kanban tasks synced from cronograma (completedAt = when moved to 'done')
  const kanbanTasks = await prisma.obraTask.findMany({
    where: { obraId, cronogramaRef: { not: null } },
    select: { cronogramaRef: true, completedAt: true, status: true },
  });
  const kanbanByRef = new Map(kanbanTasks.map((t) => [t.cronogramaRef!, t]));

  const totalDias = leafTasks.reduce((s, t) => s + (t.duracaoDias ?? 0), 0);

  const startDates = leafTasks.map((t) => new Date(t.inicio!));
  const endDates   = leafTasks.map((t) => new Date(t.fim!));
  const projectStart = new Date(Math.min(...startDates.map((d) => d.getTime())));
  const projectEnd   = new Date(Math.max(...endDates.map((d) => d.getTime())));
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const chartEnd = today > projectEnd ? today : projectEnd;
  const totalChartDays = Math.ceil((chartEnd.getTime() - projectStart.getTime()) / 86400000);
  const step = Math.max(1, Math.floor(totalChartDays / 60));

  const series: { date: string; remaining: number | null; ideal: number }[] = [];

  for (let d = 0; d <= totalChartDays; d += step) {
    const date = new Date(projectStart.getTime() + d * 86400000);
    const dateStr = date.toISOString().split('T')[0];

    // Ideal: sum of durations of tasks whose planned fim >= this date (not yet done by plan)
    const ideal = leafTasks.reduce((s, t) => {
      const fim = new Date(t.fim!);
      return s + (fim >= date ? (t.duracaoDias ?? 0) : 0);
    }, 0);

    // Real (only up to today): sum of durations of tasks not yet completed by this date
    let remaining: number | null = null;
    if (date <= today) {
      remaining = leafTasks.reduce((s, t) => {
        const ref = t.wbs || t.nome;
        const kt = kanbanByRef.get(ref);
        const doneByDate = kt?.completedAt && new Date(kt.completedAt) <= date;
        return doneByDate ? s : s + (t.duracaoDias ?? 0);
      }, 0);
    }

    series.push({ date: dateStr, remaining, ideal });
  }

  // Ensure last point always included
  const lastDate = new Date(projectStart.getTime() + totalChartDays * 86400000);
  const lastKey = lastDate.toISOString().split('T')[0];
  if (!series.length || series[series.length - 1].date < lastKey) {
    const ideal = leafTasks.reduce((s, t) => s + (new Date(t.fim!) >= lastDate ? (t.duracaoDias ?? 0) : 0), 0);
    const remaining = lastDate <= today
      ? leafTasks.reduce((s, t) => {
          const kt = kanbanByRef.get(t.wbs || t.nome);
          return kt?.completedAt && new Date(kt.completedAt) <= lastDate ? s : s + (t.duracaoDias ?? 0);
        }, 0)
      : null;
    series.push({ date: lastKey, remaining, ideal });
  }

  const completedDias = leafTasks.reduce((s, t) => {
    const kt = kanbanByRef.get(t.wbs || t.nome);
    return kt?.completedAt ? s + (t.duracaoDias ?? 0) : s;
  }, 0);
  const currentRemaining = totalDias - completedDias;
  const todayStr = today.toISOString().split('T')[0];
  const todayIdeal = [...series].reverse().find((p) => p.date <= todayStr)?.ideal ?? totalDias;
  const pctComplete  = Math.round((completedDias / totalDias) * 100);
  const pctExpected  = Math.round(((totalDias - todayIdeal) / totalDias) * 100);
  const burnStatus: 'ahead' | 'behind' | 'on_track' =
    currentRemaining < todayIdeal ? 'ahead' : currentRemaining > todayIdeal ? 'behind' : 'on_track';

  return {
    hasData: true,
    total: totalDias,
    startDate: projectStart.toISOString().split('T')[0],
    endDate: projectEnd.toISOString().split('T')[0],
    series,
    currentRemaining,
    expectedRemaining: todayIdeal,
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
