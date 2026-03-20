import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateChecklistInput, AnswerItemInput, AddItemInput } from './types';

export async function listTemplates(type?: string, segment?: string) {
  const where: any = {};
  if (type) where.type = type;
  if (segment) where.segment = { in: [segment, 'ambos'] };

  return prisma.checklistTemplate.findMany({
    where,
    include: { items: { orderBy: { order: 'asc' } } },
    orderBy: { name: 'asc' },
  });
}

export async function createChecklist(obraId: string, userId: string, input: CreateChecklistInput) {
  const template = await prisma.checklistTemplate.findUnique({
    where: { id: input.templateId },
    include: { items: { orderBy: { order: 'asc' } } },
  });

  if (!template) throw AppError.notFound('Template de checklist');

  // Check if obra exists
  const obra = await prisma.obra.findUnique({ where: { id: obraId } });
  if (!obra) throw AppError.notFound('Obra');

  return prisma.checklist.create({
    data: {
      obraId,
      templateId: template.id,
      type: template.type,
      segment: template.segment,
      createdBy: userId,
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
    include: {
      items: { orderBy: { order: 'asc' } },
      creator: { select: { id: true, name: true } },
      template: { select: { id: true, name: true } },
    },
  });
}

export async function listByObra(obraId: string) {
  return prisma.checklist.findMany({
    where: { obraId },
    include: {
      creator: { select: { id: true, name: true } },
      template: { select: { id: true, name: true } },
      _count: { select: { items: true } },
      items: { select: { answer: true, required: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getById(id: string) {
  const checklist = await prisma.checklist.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      template: { select: { id: true, name: true } },
      items: {
        orderBy: { order: 'asc' },
        include: {
          responsible: { select: { id: true, name: true } },
          answerer: { select: { id: true, name: true } },
        },
      },
      obra: { select: { id: true, name: true } },
    },
  });

  if (!checklist) throw AppError.notFound('Checklist');
  return checklist;
}

export async function answerItem(checklistId: string, itemId: string, userId: string, input: AnswerItemInput) {
  // Verify item belongs to checklist
  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, checklistId },
  });
  if (!item) throw AppError.notFound('Item do checklist');

  // Check checklist is not completed
  const checklist = await prisma.checklist.findUnique({ where: { id: checklistId } });
  if (checklist?.status === 'concluido') {
    throw AppError.badRequest('Este checklist já foi concluído');
  }

  return prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      answer: input.answer,
      photoUrl: input.photoUrl,
      observation: input.observation,
      responsibleId: input.responsibleId,
      answeredAt: new Date(),
      answeredBy: userId,
    },
    include: {
      responsible: { select: { id: true, name: true } },
      answerer: { select: { id: true, name: true } },
    },
  });
}

export async function addItem(checklistId: string, input: AddItemInput) {
  const checklist = await prisma.checklist.findUnique({
    where: { id: checklistId },
    include: { items: { orderBy: { order: 'desc' }, take: 1 } },
  });
  if (!checklist) throw AppError.notFound('Checklist');
  if (checklist.status === 'concluido') {
    throw AppError.badRequest('Este checklist já foi concluído');
  }

  const nextOrder = (checklist.items[0]?.order ?? 0) + 1;

  return prisma.checklistItem.create({
    data: {
      checklistId,
      title: input.title,
      description: input.description,
      required: input.required ?? false,
      order: nextOrder,
    },
  });
}

export async function completeChecklist(id: string) {
  const checklist = await prisma.checklist.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!checklist) throw AppError.notFound('Checklist');
  if (checklist.status === 'concluido') {
    throw AppError.badRequest('Este checklist já foi concluído');
  }

  // Check all required items are answered
  const unanswered = checklist.items.filter((i) => i.required && !i.answer);
  if (unanswered.length > 0) {
    throw AppError.badRequest(`${unanswered.length} item(ns) obrigatório(s) sem resposta`);
  }

  return prisma.checklist.update({
    where: { id },
    data: {
      status: 'concluido',
      completedAt: new Date(),
    },
  });
}
