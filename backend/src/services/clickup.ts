/**
 * Service: clickup.ts
 * Propósito: Integração com ClickUp para calcular progresso real das obras
 * Autor: Linux (BER Engenharia)
 * Data: 2026-03-28
 */

import { prisma } from '../config/database';

const CLICKUP_API = 'https://api.clickup.com/api/v2';
const TEAM_ID = '90171059840';         // BÈR ENGENHARIA
const SPACE_ID = '90174871258';        // OBRAS BÈR

function headers() {
  return { Authorization: process.env.CLICKUP_API_KEY || '' };
}

interface ClickUpFolder {
  id: string;
  name: string;
  lists: { id: string; name: string; task_count: number }[];
}

interface ClickUpTask {
  id: string;
  name: string;
  status: { status: string; type: string };
}

/** Extrai o nome da obra a partir do nome da pasta: "BÈR — Obra | Arbo Pinheiros" → "Arbo Pinheiros" */
function extractObraName(folderName: string): string | null {
  const match = folderName.match(/BÈR\s*[—-]\s*Obra\s*\|\s*(.+)/i);
  return match ? match[1].trim() : null;
}

/** Fuzzy match: verifica se o nome da obra do banco bate com o nome extraído do ClickUp */
function nameMatches(obraName: string, clickupName: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^a-z0-9 ]/g, '').trim();
  const a = normalize(obraName);
  const b = normalize(clickupName);
  return a.includes(b) || b.includes(a);
}

/** Busca todas as tarefas de uma lista (paginado) e retorna {total, done} */
async function getListProgress(listId: string): Promise<{ total: number; done: number }> {
  let page = 0;
  let total = 0;
  let done = 0;
  let hasMore = true;

  while (hasMore) {
    const url = `${CLICKUP_API}/list/${listId}/task?page=${page}&limit=100&include_closed=true&subtasks=false`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) break;

    const data: { tasks: ClickUpTask[]; last_page?: boolean } = await res.json();
    const tasks = data.tasks || [];

    for (const task of tasks) {
      const statusName = task.status?.status?.toLowerCase() || '';
      // Ignora o card de "Progresso Geral" (meta-card)
      if (task.name.toLowerCase().includes('progresso geral')) continue;
      total++;
      if (statusName.includes('conclu') || task.status?.type === 'closed') {
        done++;
      }
    }

    hasMore = tasks.length === 100 && !data.last_page;
    page++;
  }

  return { total, done };
}

export interface SyncResult {
  synced: { obraName: string; clickupFolder: string; listId: string; total: number; done: number; progress: number }[];
  unmatched: string[];
  errors: string[];
}

/** Sincroniza o progresso de todas as obras com o ClickUp */
export async function syncProgressFromClickUp(): Promise<SyncResult> {
  const result: SyncResult = { synced: [], unmatched: [], errors: [] };

  // 1. Buscar folders do space
  const foldersRes = await fetch(`${CLICKUP_API}/space/${SPACE_ID}/folder?archived=false`, {
    headers: headers(),
  });
  if (!foldersRes.ok) {
    throw new Error(`ClickUp API error: ${foldersRes.status} ${await foldersRes.text()}`);
  }
  const foldersData: { folders: ClickUpFolder[] } = await foldersRes.json();

  // 2. Filtrar apenas pastas de obras reais
  const obraFolders = foldersData.folders.filter(f => extractObraName(f.name));

  // 3. Buscar obras ativas do banco
  const obras = await prisma.obra.findMany({
    where: { status: { in: ['em_andamento', 'planejamento', 'pausada'] } },
    select: { id: true, name: true },
  });

  // 4. Para cada pasta do ClickUp, tentar casar com obra do banco
  for (const folder of obraFolders) {
    const clickupName = extractObraName(folder.name)!;
    const list = folder.lists[0]; // cada pasta tem uma lista "Imported From Trello"
    if (!list) continue;

    const obra = obras.find(o => nameMatches(o.name, clickupName));

    try {
      const { total, done } = await getListProgress(list.id);
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;

      if (obra) {
        await prisma.obra.update({
          where: { id: obra.id },
          data: { progressPercent: progress },
        });
        result.synced.push({ obraName: obra.name, clickupFolder: folder.name, listId: list.id, total, done, progress });
      } else {
        result.unmatched.push(`ClickUp: "${clickupName}" — sem correspondência no banco`);
      }
    } catch (err: any) {
      result.errors.push(`Erro em "${clickupName}": ${err.message}`);
    }
  }

  return result;
}
