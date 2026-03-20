import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { AnswerCanteiroItemInput, ApproveCanteiroInput } from './types';

// Get Monday of current week
function getCurrentWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export async function getActiveTemplate() {
  return prisma.canteiroTemplate.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { items: { orderBy: { order: 'asc' } } },
  });
}

export async function listByObra(obraId: string) {
  return prisma.canteiroChecklist.findMany({
    where: { obraId },
    include: {
      creator: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } },
      _count: { select: { items: true } },
      items: { select: { answer: true, required: true } },
    },
    orderBy: { weekStart: 'desc' },
  });
}

export async function createForCurrentWeek(obraId: string, userId: string) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId } });
  if (!obra) throw AppError.notFound('Obra');

  const weekStart = getCurrentWeekStart();

  // Check if already exists for this week
  const existing = await prisma.canteiroChecklist.findUnique({
    where: { obraId_weekStart: { obraId, weekStart } },
    include: {
      items: { orderBy: { order: 'asc' } },
      creator: { select: { id: true, name: true } },
    },
  });
  if (existing) return existing;

  // Get active template
  const template = await getActiveTemplate();
  if (!template) throw AppError.notFound('Template de canteiro');

  return prisma.canteiroChecklist.create({
    data: {
      obraId,
      templateId: template.id,
      weekStart,
      createdBy: userId,
      items: {
        create: template.items.map((item) => ({
          templateItemId: item.id,
          title: item.title,
          category: item.category,
          order: item.order,
          required: item.required,
        })),
      },
    },
    include: {
      items: { orderBy: { order: 'asc' } },
      creator: { select: { id: true, name: true } },
    },
  });
}

export async function getById(id: string) {
  const checklist = await prisma.canteiroChecklist.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } },
      obra: { select: { id: true, name: true } },
      items: {
        orderBy: { order: 'asc' },
        include: {
          answerer: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!checklist) throw AppError.notFound('Checklist de canteiro');
  return checklist;
}

export async function answerItem(checklistId: string, itemId: string, userId: string, input: AnswerCanteiroItemInput) {
  const item = await prisma.canteiroChecklistItem.findFirst({
    where: { id: itemId, checklistId },
  });
  if (!item) throw AppError.notFound('Item do checklist');

  const checklist = await prisma.canteiroChecklist.findUnique({ where: { id: checklistId } });
  if (checklist?.status !== 'em_andamento') {
    throw AppError.badRequest('Este checklist já foi finalizado');
  }

  return prisma.canteiroChecklistItem.update({
    where: { id: itemId },
    data: {
      answer: input.answer,
      photoUrl: input.photoUrl,
      observation: input.observation,
      answeredBy: userId,
      answeredAt: new Date(),
    },
    include: {
      answerer: { select: { id: true, name: true } },
    },
  });
}

export async function approveChecklist(id: string, userId: string, input: ApproveCanteiroInput) {
  const checklist = await prisma.canteiroChecklist.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!checklist) throw AppError.notFound('Checklist de canteiro');
  if (checklist.status !== 'em_andamento') {
    throw AppError.badRequest('Este checklist já foi finalizado');
  }

  // Check all required items are answered
  const unanswered = checklist.items.filter((i) => i.required && !i.answer);
  if (unanswered.length > 0) {
    throw AppError.badRequest(`${unanswered.length} item(ns) obrigatório(s) sem resposta`);
  }

  return prisma.canteiroChecklist.update({
    where: { id },
    data: {
      status: input.status,
      approvedBy: userId,
      approvedAt: new Date(),
    },
  });
}
