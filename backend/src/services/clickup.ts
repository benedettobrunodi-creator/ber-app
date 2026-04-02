/**
 * Service: clickup.ts
 * Propósito: Integração com ClickUp — sync de tarefas, progresso e automações BÈR
 * Autor: Linux (BER Engenharia)
 * Atualizado: 2026-04-02 — migração Trello→ClickUp
 */

import { prisma } from '../config/database';

const CLICKUP_API = 'https://api.clickup.com/api/v2';

// ── Workspace BÈR ENGENHARIA ─────────────────────────────────────────────────
export const TEAM_ID = '90171059840';

// Spaces do novo workspace
export const SPACES = {
  PROJETOS:    '90175014083',
  COMPRAS:     '90175014084',
  ORCAMENTOS:  '90175014085',
  ENGENHARIA:  '90175014086',
} as const;

// Space legado (pré-migração) — mantido para compatibilidade
export const SPACE_ID_LEGADO = '90174871258';

function headers() {
  const key = process.env.CLICKUP_API_KEY || '';
  if (!key) console.warn('[ClickUp] CLICKUP_API_KEY não configurada');
  return { Authorization: key, 'Content-Type': 'application/json' };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClickUpFolder {
  id: string;
  name: string;
  lists: { id: string; name: string; task_count: number }[];
}

export interface ClickUpTask {
  id: string;
  name: string;
  status: { status: string; type: string };
  due_date?: string | null;
  assignees?: { id: string; username: string; email: string }[];
  description?: string;
  date_updated?: string;
}

export interface ClickUpList {
  id: string;
  name: string;
  task_count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extrai nome da obra: "BÈR — Obra | Arbo Pinheiros" → "Arbo Pinheiros" */
function extractObraName(folderName: string): string | null {
  const match = folderName.match(/BÈR\s*[—-]\s*Obra\s*\|\s*(.+)/i);
  return match ? match[1].trim() : null;
}

/** Fuzzy match normalizado */
function nameMatches(obraName: string, clickupName: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, '').trim();
  const a = normalize(obraName);
  const b = normalize(clickupName);
  return a.includes(b) || b.includes(a);
}

// ── API Calls ─────────────────────────────────────────────────────────────────

/** Busca folders de um space */
export async function getFolders(spaceId: string): Promise<ClickUpFolder[]> {
  const res = await fetch(`${CLICKUP_API}/space/${spaceId}/folder?archived=false`, { headers: headers() });
  if (!res.ok) throw new Error(`ClickUp getFolders ${spaceId}: ${res.status} ${await res.text()}`);
  const data = await res.json() as { folders: ClickUpFolder[] };
  return data.folders || [];
}

/** Busca listas diretas de um space (sem pasta) */
export async function getSpaceLists(spaceId: string): Promise<ClickUpList[]> {
  const res = await fetch(`${CLICKUP_API}/space/${spaceId}/list?archived=false`, { headers: headers() });
  if (!res.ok) throw new Error(`ClickUp getSpaceLists: ${res.status}`);
  const data = await res.json() as { lists: ClickUpList[] };
  return data.lists || [];
}

/** Busca listas dentro de uma pasta */
export async function getFolderLists(folderId: string): Promise<ClickUpList[]> {
  const res = await fetch(`${CLICKUP_API}/folder/${folderId}/list?archived=false`, { headers: headers() });
  if (!res.ok) throw new Error(`ClickUp getFolderLists: ${res.status}`);
  const data = await res.json() as { lists: ClickUpList[] };
  return data.lists || [];
}

/** Busca tasks de uma lista (paginado) */
export async function getListTasks(listId: string): Promise<ClickUpTask[]> {
  let page = 0;
  const all: ClickUpTask[] = [];
  while (true) {
    const url = `${CLICKUP_API}/list/${listId}/task?page=${page}&limit=100&include_closed=true&subtasks=false`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) break;
    const data = await res.json() as { tasks: ClickUpTask[]; last_page?: boolean };
    all.push(...(data.tasks || []));
    if (data.last_page || !data.tasks?.length) break;
    page++;
  }
  return all;
}

/** Progresso de uma lista: {total, done} */
async function getListProgress(listId: string): Promise<{ total: number; done: number }> {
  const tasks = await getListTasks(listId);
  const total = tasks.length;
  const done = tasks.filter((t) => t.status?.type === 'closed' || t.status?.status?.toLowerCase() === 'concluído').length;
  return { total, done };
}

// ── Sync de progresso ─────────────────────────────────────────────────────────

/**
 * Sincroniza progresso (%) de todas as obras com pasta no ClickUp.
 * Varre os spaces PROJETOS e ENGENHARIA em busca de pastas "BÈR — Obra | <nome>".
 */
export async function syncProgressoFromClickUp(): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  const obras = await prisma.obra.findMany({
    where: { status: { in: ['em_andamento', 'planejamento'] } },
    select: { id: true, name: true },
  });

  // Buscar folders dos spaces relevantes
  const targetSpaces = [SPACES.PROJETOS, SPACES.ENGENHARIA];
  const allFolders: ClickUpFolder[] = [];

  for (const spaceId of targetSpaces) {
    try {
      const folders = await getFolders(spaceId);
      allFolders.push(...folders);
    } catch (err) {
      console.error(`[ClickUp] Erro ao buscar folders do space ${spaceId}:`, err);
    }
  }

  for (const obra of obras) {
    const folder = allFolders.find((f) => {
      const name = extractObraName(f.name);
      return name && nameMatches(obra.name, name);
    });

    if (!folder) continue;

    try {
      let total = 0;
      let done = 0;

      for (const list of folder.lists) {
        const progress = await getListProgress(list.id);
        total += progress.total;
        done += progress.done;
      }

      if (total === 0) continue;

      const pct = Math.round((done / total) * 100);
      await prisma.obra.update({
        where: { id: obra.id },
        data: { progressPercent: pct },
      });

      console.log(`[ClickUp] Progresso "${obra.name}": ${done}/${total} (${pct}%)`);
      synced++;
    } catch (err) {
      console.error(`[ClickUp] Erro ao sincronizar "${obra.name}":`, err);
      errors++;
    }
  }

  return { synced, errors };
}

/**
 * Sync completo de uma obra a partir de uma pasta ClickUp:
 * cria/atualiza tarefas no banco com base nas tasks do ClickUp.
 */
export async function syncObraFromClickUp(
  obraId: string,
  folderId: string,
): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const lists = await getFolderLists(folderId);

  for (const list of lists) {
    const tasks = await getListTasks(list.id);

    for (const task of tasks) {
      if (!task.name?.trim()) { skipped++; continue; }

      const existing = await prisma.obraTask.findFirst({
        where: { clickupTaskId: task.id },
      });

      const status = task.status?.type === 'closed' ? 'done'
        : task.status?.status?.toLowerCase().includes('progress') ? 'in_progress'
        : 'todo';

      if (existing) {
        await prisma.obraTask.update({
          where: { id: existing.id },
          data: { status, updatedAt: new Date() },
        });
        updated++;
      } else {
        await prisma.obraTask.create({
          data: {
            obraId,
            title: task.name,
            description: task.description || '',
            status,
            priority: 'medium',
            clickupTaskId: task.id,
          },
        });
        created++;
      }
    }
  }

  return { created, updated, skipped };
}
