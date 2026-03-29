/**
 * Service: clickup-tasks-sync.ts
 * Propósito: Sincronizar tarefas do ClickUp para obra_tasks no banco
 * Autor: Linux (BER Engenharia)
 * Data: 2026-03-28
 */

import { prisma } from '../config/database';

const CLICKUP_API = 'https://api.clickup.com/api/v2';

function headers() {
  return { Authorization: process.env.CLICKUP_API_KEY || '' };
}

// Mapeamento de status ClickUp → kanban interno
function mapStatus(clickupStatus: string): string {
  const s = clickupStatus.toLowerCase();
  if (s.includes('conclu') || s.includes('complete') || s.includes('closed') || s.includes('done')) return 'done';
  if (s.includes('andamento') || s.includes('progress') || s.includes('sprint') || s.includes('review')) return 'in_progress';
  return 'todo';
}

// Mapeamento de prioridade ClickUp → interna
function mapPriority(p: number | null): string {
  if (!p) return 'medium';
  if (p === 1) return 'urgente';
  if (p === 2) return 'alta';
  if (p === 3) return 'medium';
  return 'baixa';
}

interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  status: { status: string; type: string };
  priority: { priority: string; id: number } | null;
  due_date: string | null;
  orderindex: string;
}

// Busca todas as tasks de uma lista (paginado)
async function fetchAllTasks(listId: string): Promise<ClickUpTask[]> {
  const tasks: ClickUpTask[] = [];
  let page = 0;

  while (true) {
    const url = `${CLICKUP_API}/list/${listId}/task?page=${page}&limit=100&include_closed=true&subtasks=false`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) break;

    const data: { tasks: ClickUpTask[]; last_page?: boolean } = await res.json();
    if (!data.tasks?.length) break;
    tasks.push(...data.tasks);
    if (data.last_page || data.tasks.length < 100) break;
    page++;
  }

  return tasks;
}

// Busca a primeira lista de um folder
async function getFirstList(folderId: string): Promise<{ id: string; name: string } | null> {
  const res = await fetch(`${CLICKUP_API}/folder/${folderId}/list?archived=false`, {
    headers: headers(),
  });
  if (!res.ok) return null;
  const data: { lists: { id: string; name: string }[] } = await res.json();
  return data.lists?.[0] ?? null;
}

export interface TaskSyncResult {
  obraName: string;
  clickupFolderId: string;
  inserted: number;
  updated: number;
  total: number;
  errors: string[];
}

// Mapeamento fixo: folder_id do ClickUp → obra_id do banco
const FOLDER_TO_OBRA: Record<string, string> = {
  '90177682213': 'ad230e86-59bc-411b-85f2-9b6f7b1c090e', // Arbo Pinheiros
  '90177682221': 'a7c3888f-40cb-4a95-8a64-1afeda524895', // Higienópolis
  '90177682231': '852fb53f-9c33-4641-816b-9a4b0b886f49', // Igreja Taboão
  '90177682244': '7a2edf07-542d-40e8-a453-923741ffbf86', // Mackenzie
  '90177682257': '4100e81e-658f-4b38-91e8-e6237cd3a6e5', // Sérgio e Renata
};

export async function syncTasksFromClickUp(): Promise<TaskSyncResult[]> {
  const results: TaskSyncResult[] = [];

  for (const [folderId, obraId] of Object.entries(FOLDER_TO_OBRA)) {
    const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { name: true } });
    const result: TaskSyncResult = {
      obraName: obra?.name ?? obraId,
      clickupFolderId: folderId,
      inserted: 0,
      updated: 0,
      total: 0,
      errors: [],
    };

    try {
      // 1. Pegar a lista do folder
      const list = await getFirstList(folderId);
      if (!list) {
        result.errors.push('Nenhuma lista encontrada no folder');
        results.push(result);
        continue;
      }

      // 2. Buscar todas as tasks
      const tasks = await fetchAllTasks(list.id);
      result.total = tasks.length;

      // 3. Upsert cada task
      let position = 0;
      for (const task of tasks) {
        // Ignorar meta-cards
        if (task.name.toLowerCase().includes('progresso geral')) continue;

        const status = mapStatus(task.status.status);
        const priority = mapPriority(task.priority?.id ?? null);
        const dueDate = task.due_date ? new Date(parseInt(task.due_date)) : null;
        const title = task.name.slice(0, 255);

        try {
          const existing = await prisma.obraTask.findFirst({
            where: { clickupTaskId: task.id },
            select: { id: true },
          });

          if (existing) {
            await prisma.obraTask.update({
              where: { id: existing.id },
              data: { title, status, priority, dueDate, position },
            });
            result.updated++;
          } else {
            await prisma.obraTask.create({
              data: {
                obraId,
                title,
                status,
                priority,
                dueDate,
                position,
                clickupTaskId: task.id,
              },
            });
            result.inserted++;
          }
          position++;
        } catch (err: any) {
          result.errors.push(`Task "${title.slice(0, 40)}": ${err.message}`);
        }
      }
    } catch (err: any) {
      result.errors.push(`Erro geral: ${err.message}`);
    }

    results.push(result);
  }

  return results;
}
