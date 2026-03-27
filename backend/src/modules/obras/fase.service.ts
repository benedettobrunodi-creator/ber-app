import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';

const FASE_ORDER = [
  'kickoff_interno',
  'kickoff_externo',
  'suprimentos',
  'pre_obra',
  'execucao',
  'pendencias',
  'encerramento',
] as const;

export type Fase = (typeof FASE_ORDER)[number];

export async function updateFase(obraId: string, novaFase: string, userId: string, notes?: string) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId } });
  if (!obra) throw AppError.notFound('Obra');

  const faseIndex = FASE_ORDER.indexOf(novaFase as Fase);
  if (faseIndex === -1) {
    throw AppError.badRequest(`Fase inválida: ${novaFase}. Fases válidas: ${FASE_ORDER.join(', ')}`);
  }

  const currentIndex = FASE_ORDER.indexOf(obra.fase as Fase);

  // If advancing (not going back), check required checklists of current fase
  if (faseIndex > currentIndex) {
    const incompleteRequired = await prisma.checklist.findMany({
      where: {
        obraId,
        template: {
          fase: obra.fase,
          bluepaperDoc: { not: null },
        },
        status: { not: 'concluido' },
        items: {
          some: {
            required: true,
            answer: null,
          },
        },
      },
      include: {
        template: { select: { name: true, bluepaperDoc: true } },
      },
    });

    if (incompleteRequired.length > 0) {
      const blocking = incompleteRequired.map((c) => ({
        checklistId: c.id,
        templateName: c.template?.name,
        bluepaperDoc: c.template?.bluepaperDoc,
      }));
      return {
        blocked: true,
        message: `Existem ${incompleteRequired.length} checklist(s) obrigatório(s) incompleto(s) na fase "${obra.fase}"`,
        blockingChecklists: blocking,
      };
    }
  }

  // Update in transaction
  const [updatedObra, history] = await prisma.$transaction([
    prisma.obra.update({
      where: { id: obraId },
      data: {
        fase: novaFase,
        faseUpdatedAt: new Date(),
        faseUpdatedById: userId,
      },
    }),
    prisma.obraFaseHistory.create({
      data: {
        obraId,
        faseAnterior: obra.fase,
        faseNova: novaFase,
        changedBy: userId,
        notes,
      },
    }),
  ]);

  return { blocked: false, obra: updatedObra, history };
}

export async function getFaseHistory(obraId: string) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId } });
  if (!obra) throw AppError.notFound('Obra');

  return prisma.obraFaseHistory.findMany({
    where: { obraId },
    include: {
      changer: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { changedAt: 'desc' },
  });
}
