import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateObraInput, UpdateObraInput, AddMemberInput } from './types';

export async function listObras(page: number, limit: number, status?: string, userId?: string, userRole?: string) {
  const skip = (page - 1) * limit;
  const where: any = {};
  if (status) where.status = status;

  // gestor and campo can only see obras they're members of
  if (userRole === 'gestor' || userRole === 'campo') {
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
  return { obras, total };
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

    return newObra;
  });

  return obra;
}

export async function updateObra(id: string, input: UpdateObraInput) {
  const existing = await prisma.obra.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Obra');

  const data: any = { ...input };
  if (input.startDate) data.startDate = new Date(input.startDate);
  if (input.expectedEndDate) data.expectedEndDate = new Date(input.expectedEndDate);
  if (input.actualEndDate) data.actualEndDate = new Date(input.actualEndDate);

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

  return {
    progress: obra.progressPercent,
    members: memberCount,
    photos: photoCount,
    tasks: {
      total: totalTasks,
      ...tasks,
    },
  };
}

export async function isObraMember(obraId: string, userId: string): Promise<boolean> {
  const member = await prisma.obraMember.findUnique({
    where: { obraId_userId: { obraId, userId } },
  });
  return !!member;
}
