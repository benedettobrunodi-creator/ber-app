import cron from 'node-cron';
import { prisma } from '../config/database';
import { syncFromAgendor } from '../modules/proposals/service';
import { syncObraFromTrello, syncProgressoFromTrello } from './trello';
import { notifyUsers } from '../modules/notifications/service';

export function startScheduler() {
  // Agendor sync — a cada 30 minutos
  cron.schedule('*/30 * * * *', async () => {
    console.log('[Scheduler] Agendor sync iniciado...');
    try {
      const result = await syncFromAgendor();
      console.log(`[Scheduler] Agendor sync concluído — ${result.created} criados, ${result.updated} atualizados (${result.elapsed})`);
    } catch (err) {
      console.error('[Scheduler] Agendor sync falhou:', (err as Error).message);
    }
  });

  // Trello sync — a cada 1 hora
  cron.schedule('0 * * * *', async () => {
    const obras = await prisma.obra.findMany({
      where: { trelloBoardId: { not: null } },
      select: { id: true, name: true, trelloBoardId: true },
    });

    console.log(`[Scheduler] Trello sync iniciado — ${obras.length} obras`);

    for (const obra of obras) {
      try {
        const result = await syncObraFromTrello(obra.id, obra.trelloBoardId!);
        console.log(`[Scheduler] Trello sync "${obra.name}" — ${result.created} criados, ${result.skipped} pulados`);
      } catch (err) {
        console.error(`[Scheduler] Trello sync "${obra.name}" falhou:`, (err as Error).message);
      }
    }

    console.log('[Scheduler] Trello sync concluído');
    await syncProgressoFromTrello();
  });

  // Checklist pendente notifications — diariamente as 08h
  cron.schedule('0 8 * * *', async () => {
    console.log('[Scheduler] Checklist notifications iniciado...');
    try {
      await checkPendingChecklists();
      console.log('[Scheduler] Checklist notifications concluido');
    } catch (err) {
      console.error('[Scheduler] Checklist notifications falhou:', (err as Error).message);
    }
  });

  console.log('[Scheduler] Jobs registrados — Agendor (*/30min), Trello (*/1h), Checklist notifications (08h)');
}

async function checkPendingChecklists() {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  // Find active checklists with required unanswered items older than 3 days
  const pendingChecklists = await prisma.checklist.findMany({
    where: {
      status: 'em_andamento',
      items: {
        some: {
          required: true,
          answer: null,
          checklist: { createdAt: { lte: threeDaysAgo } },
        },
      },
    },
    include: {
      obra: {
        select: {
          id: true,
          name: true,
          coordinatorId: true,
          members: {
            where: { user: { role: { in: ['gestor', 'coordenacao', 'diretoria'] } } },
            select: { userId: true },
          },
        },
      },
      items: { where: { required: true, answer: null } },
    },
  });

  // Find checklists with non-conforming items (answer = 'nao') without corrective observation
  const nonConformingChecklists = await prisma.checklist.findMany({
    where: {
      status: 'em_andamento',
      items: {
        some: {
          answer: 'nao',
          observation: null,
        },
      },
    },
    include: {
      obra: {
        select: {
          id: true,
          name: true,
          coordinatorId: true,
          members: {
            where: { user: { role: { in: ['gestor', 'coordenacao', 'diretoria'] } } },
            select: { userId: true },
          },
        },
      },
      items: { where: { answer: 'nao', observation: null } },
    },
  });

  // Group pending items by obra
  const pendingByObra = new Map<string, { obraName: string; userIds: Set<string>; count: number }>();
  for (const cl of pendingChecklists) {
    const key = cl.obra.id;
    if (!pendingByObra.has(key)) {
      const userIds = new Set<string>();
      if (cl.obra.coordinatorId) userIds.add(cl.obra.coordinatorId);
      cl.obra.members.forEach((m) => userIds.add(m.userId));
      pendingByObra.set(key, { obraName: cl.obra.name, userIds, count: 0 });
    }
    const entry = pendingByObra.get(key)!;
    entry.count += cl.items.length;
    if (cl.obra.coordinatorId) entry.userIds.add(cl.obra.coordinatorId);
    cl.obra.members.forEach((m) => entry.userIds.add(m.userId));
  }

  // Group non-conforming items by obra
  const ncByObra = new Map<string, { obraName: string; userIds: Set<string>; count: number }>();
  for (const cl of nonConformingChecklists) {
    const key = cl.obra.id;
    if (!ncByObra.has(key)) {
      const userIds = new Set<string>();
      if (cl.obra.coordinatorId) userIds.add(cl.obra.coordinatorId);
      cl.obra.members.forEach((m) => userIds.add(m.userId));
      ncByObra.set(key, { obraName: cl.obra.name, userIds, count: 0 });
    }
    const entry = ncByObra.get(key)!;
    entry.count += cl.items.length;
    if (cl.obra.coordinatorId) entry.userIds.add(cl.obra.coordinatorId);
    cl.obra.members.forEach((m) => entry.userIds.add(m.userId));
  }

  // Send pending notifications
  for (const [obraId, { obraName, userIds, count }] of pendingByObra) {
    if (userIds.size === 0) continue;
    await notifyUsers(
      Array.from(userIds),
      'checklist_pendente',
      `Checklist pendente: ${obraName} tem ${count} ${count === 1 ? 'item em aberto' : 'itens em aberto'}`,
      undefined,
      { obraId },
    );
    console.log(`[Scheduler] Notificacao checklist pendente — ${obraName}: ${count} itens, ${userIds.size} usuarios`);
  }

  // Send non-conformity notifications
  for (const [obraId, { obraName, userIds, count }] of ncByObra) {
    if (userIds.size === 0) continue;
    await notifyUsers(
      Array.from(userIds),
      'checklist_nao_conformidade',
      `Nao conformidade: ${obraName} tem ${count} ${count === 1 ? 'item reprovado' : 'itens reprovados'} sem acao`,
      undefined,
      { obraId },
    );
    console.log(`[Scheduler] Notificacao nao conformidade — ${obraName}: ${count} itens, ${userIds.size} usuarios`);
  }
}
