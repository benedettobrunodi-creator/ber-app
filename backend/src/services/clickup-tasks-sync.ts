/**
 * Service: clickup-tasks-sync.ts
 * Propósito: Sincronizar tarefas do ClickUp para obra_tasks no banco (dinâmico)
 * Autor: Linux (BER Engenharia)
 */

import { prisma } from '../config/database';
import { getFolders, getFolderLists, getListTasks, SPACES, extractObraName, nameMatches } from './clickup';

function mapStatus(clickupStatus: string): string {
  const s = clickupStatus.toLowerCase();
  if (s.includes('conclu') || s.includes('complete') || s.includes('closed') || s.includes('done')) return 'done';
  if (s.includes('andamento') || s.includes('progress') || s.includes('sprint') || s.includes('review')) return 'in_progress';
  return 'todo';
}

function mapPriority(id: number | null): string {
  if (!id) return 'medium';
  if (id === 1) return 'urgent';
  if (id === 2) return 'high';
  if (id === 3) return 'medium';
  return 'low';
}

export interface TaskSyncResult {
  obraName: string;
  clickupFolderId: string;
  inserted: number;
  updated: number;
  total: number;
  errors: string[];
}

export async function syncAllTasksFromClickUp(): Promise<TaskSyncResult[]> {
  const obras = await prisma.obra.findMany({
    where: { status: { in: ['em_andamento', 'planejamento'] } },
    select: { id: true, name: true },
  });

  const results: TaskSyncResult[] = [];

  for (const spaceId of [SPACES.PROJETOS, SPACES.ENGENHARIA]) {
    let folders;
    try {
      folders = await getFolders(spaceId);
    } catch (err: any) {
      console.error(`[TaskSync] Erro ao buscar folders do space ${spaceId}:`, err.message);
      continue;
    }

    for (const folder of folders) {
      const clickupName = extractObraName(folder.name);
      if (!clickupName) continue;

      const obra = obras.find(o => nameMatches(o.name, clickupName));
      if (!obra) continue;

      const result: TaskSyncResult = {
        obraName: obra.name,
        clickupFolderId: folder.id,
        inserted: 0,
        updated: 0,
        total: 0,
        errors: [],
      };

      try {
        const lists = await getFolderLists(folder.id);
        for (const list of lists) {
          const tasks = await getListTasks(list.id);
          result.total += tasks.length;

          for (const task of tasks) {
            if (!task.name?.trim()) continue;
            if (task.name.toLowerCase().includes('progresso geral')) continue;

            const status = mapStatus(task.status?.status ?? '');
            const priority = mapPriority((task as any).priority?.id ? Number((task as any).priority.id) : null);
            const dueDate = task.due_date ? new Date(parseInt(task.due_date)) : null;
            const title = task.name.slice(0, 255);

            try {
              const existing = await prisma.obraTask.findFirst({
                where: { clickupTaskId: task.id },
                select: { id: true, completedAt: true, status: true },
              });

              if (existing) {
                let completedAt: Date | null | undefined;
                if (status === 'done' && existing.completedAt === null) {
                  completedAt = task.date_done ? new Date(parseInt(task.date_done)) : new Date();
                } else if (status !== 'done') {
                  completedAt = null;
                }

                await prisma.obraTask.update({
                  where: { id: existing.id },
                  data: { title, status, priority, dueDate, ...(completedAt !== undefined ? { completedAt } : {}) },
                });
                result.updated++;
              } else {
                await prisma.obraTask.create({
                  data: {
                    obraId: obra.id,
                    title,
                    description: task.description ?? '',
                    status,
                    priority,
                    dueDate,
                    clickupTaskId: task.id,
                    ...(status === 'done' ? { completedAt: task.date_done ? new Date(parseInt(task.date_done)) : new Date() } : {}),
                  },
                });
                result.inserted++;
              }
            } catch (err: any) {
              result.errors.push(`"${title.slice(0, 40)}": ${err.message}`);
            }
          }
        }
      } catch (err: any) {
        result.errors.push(`Erro geral: ${err.message}`);
      }

      console.log(`[TaskSync] "${obra.name}": +${result.inserted} ~${result.updated} (${result.total} tasks)`);
      results.push(result);
    }
  }

  return results;
}
