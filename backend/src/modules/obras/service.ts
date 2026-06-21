import { prisma } from '../../config/database';
import { getClickUpSummary, getObraKpiDetail } from '../../services/clickup-kpis';
import { AppError } from '../../utils/errors';
import type { CreateObraInput, UpdateObraInput, AddMemberInput } from './types';

export async function listObras(page: number, limit: number, status?: string, userId?: string, userRole?: string) {
  const skip = (page - 1) * limit;
  const where: any = {};
  if (status) where.status = status;

  // apenas gestor vê só suas obras; campo e coordenacao veem todas para registro de ponto
  if (userRole === 'gestor') {
    where.members = { some: { userId } };
  }

  const [obras, total] = await Promise.all([
    prisma.obra.findMany({
      where,
      include: {
        coordinator: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { members: true, tasks: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.obra.count({ where }),
  ]);
  // Arquivadas sempre por último
  const sorted = [
    ...obras.filter(o => o.status !== 'cancelada'),
    ...obras.filter(o => o.status === 'cancelada'),
  ];
  return { obras: sorted, total };
}

export async function getObraById(id: string) {
  const obra = await prisma.obra.findUnique({
    where: { id },
    include: {
      coordinator: { select: { id: true, name: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, name: true, role: true, avatarUrl: true } } },
      },
      _count: { select: { tasks: true, photos: true } },
    },
  });
  if (!obra) throw AppError.notFound('Obra');
  return obra;
}

export async function createObra(input: CreateObraInput) {
  const obra = await prisma.$transaction(async (tx) => {
    const newObra = await tx.obra.create({
      data: {
        name: input.name,
        client: input.client,
        address: input.address,
        status: input.status,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        expectedEndDate: input.expectedEndDate ? new Date(input.expectedEndDate) : undefined,
        coordinatorId: input.coordinatorId,
        arquiteturaEscritorio: input.arquiteturaEscritorio,
        gerenciadora: input.gerenciadora,
        areaM2: input.areaM2,
        valorContrato: input.valorContrato,
        crmOportunidadeId: input.crmOportunidadeId,
      },
      include: {
        coordinator: { select: { id: true, name: true } },
      },
    });

    // Auto-create the 4 default checklists from all templates
    const templates = await tx.checklistTemplate.findMany({
      include: { items: { orderBy: { order: 'asc' } } },
    });

    for (const template of templates) {
      await tx.checklist.create({
        data: {
          obraId: newObra.id,
          templateId: template.id,
          type: template.type,
          segment: template.segment,
          createdBy: input.coordinatorId,
          items: {
            create: template.items.map((item) => ({
              templateItemId: item.id,
              title: item.title,
              description: item.description,
              required: item.required,
              order: item.order,
            })),
          },
        },
      });
    }

    // Se veio do CRM, marca oportunidade como ganha (idempotente)
    if (input.crmOportunidadeId) {
      const opp = await tx.crmOportunidade.findUnique({
        where: { id: input.crmOportunidadeId },
        select: { etapa: true },
      });
      if (opp && opp.etapa !== 'ganho') {
        await tx.crmOportunidade.update({
          where: { id: input.crmOportunidadeId },
          data: { etapa: 'ganho', dataGanho: new Date() },
        });
        await tx.crmOportunidadeHistorico.create({
          data: {
            oportunidadeId: input.crmOportunidadeId,
            campo: 'etapa',
            valorAntigo: opp.etapa,
            valorNovo: 'ganho',
            alteradoPor: 'Sistema (conversão em obra)',
          },
        });
      }
    }

    return newObra;
  });

  return obra;
}

export async function updateObra(id: string, input: UpdateObraInput) {
  const existing = await prisma.obra.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Obra');

  const data: any = { ...input };
  if (input.startDate) data.startDate = new Date(input.startDate);
  else if (input.startDate === null) data.startDate = null;
  if (input.expectedEndDate) data.expectedEndDate = new Date(input.expectedEndDate);
  else if (input.expectedEndDate === null) data.expectedEndDate = null;
  if (input.actualEndDate) data.actualEndDate = new Date(input.actualEndDate);
  if ('dataInicioProjeto' in input) data.dataInicioProjeto = input.dataInicioProjeto ? new Date(input.dataInicioProjeto) : null;
  if ('dataFimProjeto' in input) data.dataFimProjeto = input.dataFimProjeto ? new Date(input.dataFimProjeto) : null;
  if ('dataInicioObra' in input) data.dataInicioObra = input.dataInicioObra ? new Date(input.dataInicioObra) : null;
  if ('dataFimObra' in input) data.dataFimObra = input.dataFimObra ? new Date(input.dataFimObra) : null;

  const obra = await prisma.obra.update({
    where: { id },
    data,
    include: {
      coordinator: { select: { id: true, name: true } },
    },
  });
  return obra;
}

export async function getMembers(obraId: string) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId } });
  if (!obra) throw AppError.notFound('Obra');

  return prisma.obraMember.findMany({
    where: { obraId },
    include: { user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } } },
    orderBy: { joinedAt: 'asc' },
  });
}

export async function addMember(obraId: string, input: AddMemberInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId } });
  if (!obra) throw AppError.notFound('Obra');

  const existing = await prisma.obraMember.findUnique({
    where: { obraId_userId: { obraId, userId: input.userId } },
  });
  if (existing) throw AppError.conflict('Usuário já é membro desta obra');

  return prisma.obraMember.create({
    data: { obraId, userId: input.userId, role: input.role },
    include: { user: { select: { id: true, name: true, role: true, avatarUrl: true } } },
  });
}

export async function removeMember(obraId: string, userId: string) {
  const member = await prisma.obraMember.findUnique({
    where: { obraId_userId: { obraId, userId } },
  });
  if (!member) throw AppError.notFound('Membro');

  await prisma.obraMember.delete({
    where: { obraId_userId: { obraId, userId } },
  });
}

export async function getCounts(userId: string, userRole: string) {
  const where: any = {};
  if (userRole === 'gestor') {
    where.members = { some: { userId } };
  }

  const [total, ativas, atrasadas] = await Promise.all([
    prisma.obra.count({ where }),
    prisma.obra.count({ where: { ...where, status: 'em_andamento' } }),
    prisma.obra.count({ where: { ...where, status: 'em_andamento', progressPercent: { lt: 20 } } }),
  ]);

  return { total, ativas, atrasadas };
}

export async function getStats(obraId: string) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId } });
  if (!obra) throw AppError.notFound('Obra');

  const [taskCounts, memberCount, photoCount] = await Promise.all([
    prisma.obraTask.groupBy({
      by: ['status'],
      where: { obraId },
      _count: true,
    }),
    prisma.obraMember.count({ where: { obraId } }),
    prisma.photo.count({ where: { obraId } }),
  ]);

  const tasks: Record<string, number> = {};
  let totalTasks = 0;
  for (const tc of taskCounts) {
    tasks[tc.status] = tc._count;
    totalTasks += tc._count;
  }

  const clickup = await getObraKpiDetail(obraId);
  return {
    progress: obra.progressPercent,
    members: memberCount,
    photos: photoCount,
    tasks: {
      total: totalTasks,
      ...tasks,
    },
    clickup,
  };
}

export async function deleteObraPermanent(id: string) {
  const existing = await prisma.obra.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Obra');

  try {
    await prisma.obra.delete({ where: { id } });
  } catch (err: any) {
    if (err?.code === 'P2003') {
      const meta = (err.meta || {}) as { field_name?: string; constraint?: string };
      const target = meta.field_name || meta.constraint || 'tabela relacionada';
      throw AppError.conflict(
        `Não foi possível excluir a obra: há dados relacionados que bloqueiam a remoção (${target}). ` +
        `Arquive a obra em vez de excluir, ou remova primeiro os dados dependentes.`,
      );
    }
    throw err;
  }
}

export async function archiveObra(id: string) {
  const existing = await prisma.obra.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Obra');
  return prisma.obra.update({ where: { id }, data: { status: 'cancelada' } });
}

export async function isObraMember(obraId: string, userId: string): Promise<boolean> {
  const member = await prisma.obraMember.findUnique({
    where: { obraId_userId: { obraId, userId } },
  });
  return !!member;
}

export async function getClickUpSummaryForDashboard() {
  return getClickUpSummary();
}
