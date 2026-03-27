import { prisma } from '../../config/database';

export async function getRadar() {
  const obras = await prisma.obra.findMany({
    where: { status: 'em_andamento' },
    include: {
      coordinator: { select: { id: true, name: true } },
    },
  });

  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const radarItems = await Promise.all(
    obras.map(async (obra) => {
      // Checklist progress for bluepaper checklists in current fase
      const checklists = await prisma.checklist.findMany({
        where: {
          obraId: obra.id,
          template: { bluepaperDoc: { not: null } },
        },
        include: {
          items: { select: { required: true, answer: true } },
          template: { select: { fase: true, bluepaperDoc: true } },
        },
      });

      const total = checklists.length;
      const completed = checklists.filter((c) => c.status === 'concluido').length;
      const percentual = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Required blocking: required items without answer in current fase
      const currentFaseChecklists = checklists.filter((c) => c.template?.fase === obra.fase);
      let requiredBlocking = 0;
      for (const cl of currentFaseChecklists) {
        if (cl.status === 'concluido') continue;
        const hasIncomplete = cl.items.some((i) => i.required && !i.answer);
        if (hasIncomplete) requiredBlocking++;
      }

      // Last touchpoint
      const lastTouchpoint = await prisma.clientTouchpoint.findFirst({
        where: { obraId: obra.id },
        orderBy: { occurredAt: 'desc' },
        select: { type: true, occurredAt: true, title: true },
      });

      // Next touchpoint action
      const nextTouchpoint = await prisma.clientTouchpoint.findFirst({
        where: {
          obraId: obra.id,
          nextActionDue: { not: null, gte: now },
        },
        orderBy: { nextActionDue: 'asc' },
        select: { nextActionDue: true, nextAction: true },
      });

      // Overdue items: next_actions vencidos
      const overdueActions = await prisma.clientTouchpoint.count({
        where: {
          obraId: obra.id,
          nextActionDue: { not: null, lt: now },
        },
      });

      // Overdue touchpoints with status pendente_ata
      const pendingAtas = await prisma.clientTouchpoint.count({
        where: {
          obraId: obra.id,
          status: 'pendente_ata',
        },
      });

      const overdueItems = overdueActions + requiredBlocking;

      // Next 7 days
      const nextSevenDays = await prisma.clientTouchpoint.count({
        where: {
          obraId: obra.id,
          nextActionDue: { gte: now, lte: sevenDaysFromNow },
        },
      });

      // Semaphore logic
      let semaphore: 'verde' | 'amarelo' | 'vermelho' = 'verde';
      if (overdueItems > 0 || pendingAtas > 0) {
        semaphore = 'vermelho';
      } else if (nextSevenDays > 0) {
        semaphore = 'amarelo';
      }

      return {
        obraId: obra.id,
        name: obra.name,
        client: obra.client,
        fase: obra.fase,
        checklistProgress: { total, completed, percentual },
        requiredBlocking,
        lastTouchpoint: lastTouchpoint || null,
        nextTouchpoint: nextTouchpoint || null,
        overdueItems,
        nextSevenDays,
        semaphore,
      };
    }),
  );

  return radarItems;
}
