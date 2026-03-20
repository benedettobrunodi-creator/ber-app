import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateITInput, UpdateITInput } from './types';

const itInclude = {
  creator: { select: { id: true, name: true } },
  updater: { select: { id: true, name: true } },
};

export async function list(filters?: { discipline?: string; search?: string }) {
  const where: any = {};

  if (filters?.discipline) {
    where.discipline = filters.discipline;
  }

  if (filters?.search) {
    const term = filters.search;
    where.OR = [
      { code: { contains: term, mode: 'insensitive' } },
      { title: { contains: term, mode: 'insensitive' } },
      { objective: { contains: term, mode: 'insensitive' } },
    ];
  }

  return prisma.instrucaoTecnica.findMany({
    where,
    include: itInclude,
    orderBy: [{ code: 'asc' }],
  });
}

export async function getById(id: string) {
  const it = await prisma.instrucaoTecnica.findUnique({
    where: { id },
    include: itInclude,
  });
  if (!it) throw AppError.notFound('Instrução técnica');

  // Resolve related normas
  let normas: any[] = [];
  if (it.relatedNormas.length > 0) {
    normas = await prisma.normaTecnica.findMany({
      where: { id: { in: it.relatedNormas } },
    });
  }

  return { ...it, normasDetails: normas };
}

export async function create(userId: string, input: CreateITInput) {
  return prisma.instrucaoTecnica.create({
    data: {
      code: input.code,
      title: input.title,
      discipline: input.discipline,
      objective: input.objective,
      materials: input.materials,
      tools: input.tools,
      steps: input.steps,
      attentionPoints: input.attentionPoints,
      approvalCriteria: input.approvalCriteria,
      relatedNormas: input.relatedNormas,
      createdBy: userId,
      updatedBy: userId,
    },
    include: itInclude,
  });
}

export async function update(id: string, userId: string, input: UpdateITInput) {
  const existing = await prisma.instrucaoTecnica.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Instrução técnica');

  return prisma.instrucaoTecnica.update({
    where: { id },
    data: {
      ...input,
      updatedBy: userId,
    },
    include: itInclude,
  });
}

export async function publish(id: string, userId: string, status: string) {
  const existing = await prisma.instrucaoTecnica.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Instrução técnica');

  return prisma.instrucaoTecnica.update({
    where: { id },
    data: { status, updatedBy: userId },
    include: itInclude,
  });
}
