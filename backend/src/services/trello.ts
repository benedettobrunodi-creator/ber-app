import { env } from '../config/env';
import { prisma } from '../config/database';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TrelloBoard {
  id: string;
  name: string;
  url: string;
  closed: boolean;
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
  pos: number;
}

export interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  dueComplete: boolean;
  closed: boolean;
  idList: string;
  idMembers: string[];
  members: TrelloMember[];
  pos: number;
  labels: { id: string; name: string; color: string }[];
}

// ─── Client ──────────────────────────────────────────────────────────────────

function authParams(): string {
  const key = env.trelloApiKey;
  const token = env.trelloToken;
  if (!key || !token) {
    throw new Error('TRELLO_API_KEY e TRELLO_TOKEN não configurados');
  }
  return `key=${key}&token=${token}`;
}

async function trelloFetch<T>(path: string): Promise<T> {
  const separator = path.includes('?') ? '&' : '?';
  const url = `https://api.trello.com/1${path}${separator}${authParams()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Trello API ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getBoards(): Promise<TrelloBoard[]> {
  const boards = await trelloFetch<TrelloBoard[]>(
    '/members/me/boards?fields=id,name,url,closed&filter=open'
  );
  return boards.filter((b) => !b.closed);
}

export async function getBoardLists(boardId: string): Promise<TrelloList[]> {
  const lists = await trelloFetch<TrelloList[]>(
    `/boards/${boardId}/lists?filter=open&fields=id,name,closed,pos`
  );
  return lists.filter((l) => !l.closed).sort((a, b) => a.pos - b.pos);
}

export async function getBoardCards(boardId: string): Promise<TrelloCard[]> {
  return trelloFetch<TrelloCard[]>(
    `/boards/${boardId}/cards?fields=id,name,desc,due,dueComplete,closed,idList,idMembers,pos,labels&members=true&member_fields=id,fullName,username`
  );
}

// ─── Sync ────────────────────────────────────────────────────────────────────

const LIST_STATUS_MAP: Record<string, string> = {
  'a fazer': 'todo',
  'to do': 'todo',
  'backlog': 'todo',
  'bloqueado': 'todo',
  'sprint da semana': 'todo',
  'sprint': 'todo',
  'em andamento': 'in_progress',
  'doing': 'in_progress',
  'em progresso': 'in_progress',
  'in progress': 'in_progress',
  'revisão': 'review',
  'revisao': 'review',
  'review': 'review',
  'concluído': 'done',
  'concluido': 'done',
  'done': 'done',
  'finalizado': 'done',
};

function stripEmojis(str: string): string {
  return str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu, '').trim();
}

function mapListToStatus(listName: string): string {
  const normalized = stripEmojis(listName).toLowerCase().trim();
  return LIST_STATUS_MAP[normalized] || 'todo';
}

function mapLabelToPriority(labels: TrelloCard['labels']): string {
  for (const label of labels) {
    const name = label.name.toLowerCase();
    if (name.includes('urgente') || label.color === 'red') return 'urgent';
    if (name.includes('alta') || name.includes('high')) return 'high';
    if (name.includes('baixa') || name.includes('low') || label.color === 'blue') return 'low';
  }
  return 'medium';
}

export async function syncObraFromTrello(obraId: string, boardId: string) {
  console.log(`[Trello Sync] Iniciando sync: obra=${obraId}, board=${boardId}`);
  const startTime = Date.now();

  // Update obra with trelloBoardId
  await prisma.obra.update({
    where: { id: obraId },
    data: { trelloBoardId: boardId },
  });

  // Fetch board data
  const [lists, cards] = await Promise.all([
    getBoardLists(boardId),
    getBoardCards(boardId),
  ]);

  const listMap = new Map(lists.map((l) => [l.id, l.name]));
  const openCards = cards.filter((c) => !c.closed);

  // Get existing tasks for this obra to avoid duplicates
  const existingTasks = await prisma.obraTask.findMany({
    where: { obraId },
    select: { title: true },
  });
  const existingTitles = new Set(existingTasks.map((t) => t.title));

  let created = 0;
  let skipped = 0;

  for (const card of openCards) {
    if (existingTitles.has(card.name)) {
      skipped++;
      continue;
    }

    const listName = listMap.get(card.idList) || 'A Fazer';
    const status = mapListToStatus(listName);
    const priority = mapLabelToPriority(card.labels);

    // Get max position for this status column
    const maxPos = await prisma.obraTask.aggregate({
      where: { obraId, status },
      _max: { position: true },
    });

    await prisma.obraTask.create({
      data: {
        obraId,
        title: card.name,
        description: card.desc || null,
        status,
        priority,
        dueDate: card.due ? new Date(card.due) : null,
        position: (maxPos._max.position ?? -1) + 1,
      },
    });
    created++;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Trello Sync] Concluído em ${elapsed}s — ${created} criados, ${skipped} pulados (já existiam)`);

  return {
    boardId,
    totalCards: openCards.length,
    created,
    skipped,
    elapsed: `${elapsed}s`,
  };
}

// ─── Sync Progresso ──────────────────────────────────────────────────────────

export async function syncProgressoFromTrello() {
  const obras = await prisma.obra.findMany({
    where: { trelloBoardId: { not: null } },
    select: { id: true, trelloBoardId: true, name: true },
  });

  let updated = 0;
  for (const obra of obras) {
    try {
      const cards = await getBoardCards(obra.trelloBoardId!);
      const progressCard = cards.find((c) =>
        c.name.toLowerCase().includes('progresso geral')
      );
      if (!progressCard) continue;

      const match = progressCard.desc.match(/Progresso:\s*(\d+)/i);
      if (!match) continue;

      const progress = Math.min(100, Math.max(0, parseInt(match[1], 10)));
      await prisma.obra.update({
        where: { id: obra.id },
        data: { progressPercent: progress },
      });
      console.log(`[Trello Progresso] ${obra.name}: ${progress}%`);
      updated++;
    } catch (err) {
      console.error(`[Trello Progresso] Erro na obra ${obra.name}:`, err);
    }
  }
  console.log(`[Trello Progresso] ${updated} obras atualizadas`);
  return updated;
}

export async function criarCardsProgresso() {
  const obras = await prisma.obra.findMany({
    where: { trelloBoardId: { not: null } },
    select: { id: true, trelloBoardId: true, name: true },
  });

  for (const obra of obras) {
    try {
      const [lists, cards] = await Promise.all([
        getBoardLists(obra.trelloBoardId!),
        getBoardCards(obra.trelloBoardId!),
      ]);

      const jaExiste = cards.find((c) =>
        c.name.toLowerCase().includes('progresso geral')
      );
      if (jaExiste) {
        console.log(`[Trello] Card já existe em: ${obra.name}`);
        continue;
      }

      const primeiraLista = lists[0];
      if (!primeiraLista) continue;

      const key = process.env.TRELLO_API_KEY || '';
      const token = process.env.TRELLO_TOKEN || '';
      await fetch(
        `https://api.trello.com/1/cards?key=${key}&token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: '📊 Progresso Geral',
            desc: 'Progresso: 0%',
            idList: primeiraLista.id,
            pos: 'top',
          }),
        }
      );
      console.log(`[Trello] Card criado em: ${obra.name}`);
    } catch (err) {
      console.error(`[Trello] Erro em ${obra.name}:`, err);
    }
  }
}
