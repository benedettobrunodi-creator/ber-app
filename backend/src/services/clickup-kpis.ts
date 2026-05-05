/**
 * Service: clickup-kpis.ts
 * Propósito: KPIs de gestão calculados a partir de obra_tasks (origem ClickUp)
 * Autor: Linux (BER Engenharia)
 */

import { prisma } from '../config/database';

const PROXIMOS_MARCOS_DIAS = 14;

export type Farol = 'verde' | 'amarelo' | 'vermelho';

export function calcularFarol(atrasadas: number): Farol {
  if (atrasadas >= 4) return 'vermelho';
  if (atrasadas >= 1) return 'amarelo';
  return 'verde';
}

/** Resumo agregado por obra — usado no painel geral (/dashboard) */
export interface ObraKpiSummary {
  id: string;
  name: string;
  status: string;
  progressPercent: number;
  totalTasks: number;
  doneTasks: number;
  atrasadas: number;
  urgentes: number;
  proximosMarcos: number;
  farol: Farol;
}

export async function getClickUpSummary(): Promise<ObraKpiSummary[]> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const limiteMarcos = new Date(hoje);
  limiteMarcos.setDate(limiteMarcos.getDate() + PROXIMOS_MARCOS_DIAS);

  const obras = await prisma.obra.findMany({
    where: { status: { in: ['em_andamento', 'planejamento'] } },
    select: { id: true, name: true, status: true, progressPercent: true },
    orderBy: { name: 'asc' },
  });

  const result: ObraKpiSummary[] = [];

  for (const obra of obras) {
    const [total, done, atrasadas, urgentes, proximosMarcos] = await Promise.all([
      prisma.obraTask.count({ where: { obraId: obra.id } }),
      prisma.obraTask.count({ where: { obraId: obra.id, status: 'done' } }),
      prisma.obraTask.count({
        where: {
          obraId: obra.id,
          status: { not: 'done' },
          dueDate: { lt: hoje },
        },
      }),
      prisma.obraTask.count({
        where: {
          obraId: obra.id,
          status: { not: 'done' },
          priority: 'urgent',
        },
      }),
      prisma.obraTask.count({
        where: {
          obraId: obra.id,
          status: { not: 'done' },
          dueDate: { gte: hoje, lte: limiteMarcos },
        },
      }),
    ]);

    result.push({
      id: obra.id,
      name: obra.name,
      status: obra.status,
      progressPercent: obra.progressPercent ?? 0,
      totalTasks: total,
      doneTasks: done,
      atrasadas,
      urgentes,
      proximosMarcos,
      farol: calcularFarol(atrasadas),
    });
  }

  return result;
}

/** Detalhe por obra — usado em /obras/[id] */
export interface ObraKpiDetail {
  farol: Farol;
  totals: {
    total: number;
    done: number;
    inProgress: number;
    todo: number;
    urgentes: number;
    atrasadas: number;
    proximosMarcos: number;
  };
  tasksByList: { listName: string; total: number; done: number }[];
  tasksAtrasadas: TaskCard[];
  proximosMarcos: TaskCard[];
}

interface TaskCard {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  clickupListName: string | null;
}

export async function getObraKpiDetail(obraId: string): Promise<ObraKpiDetail> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const limiteMarcos = new Date(hoje);
  limiteMarcos.setDate(limiteMarcos.getDate() + PROXIMOS_MARCOS_DIAS);

  const taskSelect = {
    id: true,
    title: true,
    status: true,
    priority: true,
    dueDate: true,
    clickupListName: true,
  };

  const [allTasks, atrasadas, marcos] = await Promise.all([
    prisma.obraTask.findMany({
      where: { obraId },
      select: { status: true, priority: true, clickupListName: true },
    }),
    prisma.obraTask.findMany({
      where: {
        obraId,
        status: { not: 'done' },
        dueDate: { lt: hoje },
      },
      select: taskSelect,
      orderBy: { dueDate: 'asc' },
      take: 50,
    }),
    prisma.obraTask.findMany({
      where: {
        obraId,
        status: { not: 'done' },
        dueDate: { gte: hoje, lte: limiteMarcos },
      },
      select: taskSelect,
      orderBy: { dueDate: 'asc' },
      take: 50,
    }),
  ]);

  const totals = {
    total: allTasks.length,
    done: allTasks.filter((t) => t.status === 'done').length,
    inProgress: allTasks.filter((t) => t.status === 'in_progress').length,
    todo: allTasks.filter((t) => t.status === 'todo').length,
    urgentes: allTasks.filter((t) => t.priority === 'urgent' && t.status !== 'done').length,
    atrasadas: atrasadas.length,
    proximosMarcos: marcos.length,
  };

  const byListMap = new Map<string, { total: number; done: number }>();
  for (const t of allTasks) {
    const key = t.clickupListName ?? '(sem lista)';
    const entry = byListMap.get(key) ?? { total: 0, done: 0 };
    entry.total++;
    if (t.status === 'done') entry.done++;
    byListMap.set(key, entry);
  }
  const tasksByList = Array.from(byListMap.entries())
    .map(([listName, v]) => ({ listName, ...v }))
    .sort((a, b) => b.total - a.total);

  return {
    farol: calcularFarol(atrasadas.length),
    totals,
    tasksByList,
    tasksAtrasadas: atrasadas,
    proximosMarcos: marcos,
  };
}
