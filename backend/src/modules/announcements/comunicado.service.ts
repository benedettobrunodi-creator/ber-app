import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';

export async function gerarComunicadoSemanal(obraId: string, userId: string) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId } });
  if (!obra) throw AppError.notFound('Obra');

  // Calculate Sunday of current week
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  sunday.setHours(0, 0, 0, 0);

  const weekEnd = new Date(sunday);
  weekEnd.setDate(sunday.getDate() + 7);

  // Gather data for template: tasks completed this week + touchpoints
  const [completedTasks, weekTouchpoints, checklistProgress] = await Promise.all([
    prisma.obraTask.findMany({
      where: {
        obraId,
        status: 'done',
        updatedAt: { gte: sunday, lt: weekEnd },
      },
      select: { title: true, updatedAt: true },
    }),
    prisma.clientTouchpoint.findMany({
      where: {
        obraId,
        occurredAt: { gte: sunday, lt: weekEnd },
      },
      select: { type: true, title: true, occurredAt: true },
    }),
    prisma.checklist.findMany({
      where: { obraId, template: { bluepaperDoc: { not: null } } },
      include: { items: { select: { answer: true } } },
    }),
  ]);

  const totalItems = checklistProgress.reduce((sum, cl) => sum + cl.items.length, 0);
  const answeredItems = checklistProgress.reduce(
    (sum, cl) => sum + cl.items.filter((i) => i.answer !== null).length,
    0,
  );
  const progressPercent = totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0;

  const templateData = {
    obra: { name: obra.name, client: obra.client, fase: obra.fase },
    semana: { inicio: sunday.toISOString(), fim: weekEnd.toISOString() },
    tarefasConcluidas: completedTasks.map((t) => t.title),
    touchpoints: weekTouchpoints.map((tp) => ({ type: tp.type, title: tp.title })),
    progressoGeral: progressPercent,
  };

  const announcement = await prisma.announcement.create({
    data: {
      title: `Comunicado Semanal — ${obra.name} — ${sunday.toLocaleDateString('pt-BR')}`,
      body: `Comunicado semanal da obra ${obra.name}. Progresso: ${progressPercent}%. Tarefas concluídas: ${completedTasks.length}. Touchpoints: ${weekTouchpoints.length}.`,
      category: 'operacional',
      tipo: 'comunicado_semanal',
      obraId,
      semanaReferencia: sunday,
      templateData,
      enviadoCliente: false,
      authorId: userId,
      targetRoles: ['diretoria', 'coordenacao', 'gestor'],
    },
    include: {
      author: { select: { id: true, name: true } },
    },
  });

  return announcement;
}

export async function enviarComunicado(comunicadoId: string) {
  const comunicado = await prisma.announcement.findUnique({ where: { id: comunicadoId } });
  if (!comunicado) throw AppError.notFound('Comunicado');
  if (comunicado.tipo !== 'comunicado_semanal') {
    throw AppError.badRequest('Este comunicado não é do tipo comunicado_semanal');
  }

  return prisma.announcement.update({
    where: { id: comunicadoId },
    data: {
      enviadoCliente: true,
      enviadoEm: new Date(),
    },
    include: {
      author: { select: { id: true, name: true } },
    },
  });
}
