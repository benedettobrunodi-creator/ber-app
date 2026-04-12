import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateITInput, UpdateITInput, BulkITInput } from './types';

const itInclude = {
  creator: { select: { id: true, name: true } },
  updater: { select: { id: true, name: true } },
};

export async function list(filters?: { discipline?: string; search?: string; status?: string }) {
  const where: any = {};

  if (filters?.discipline) where.discipline = filters.discipline;
  if (filters?.status) where.status = filters.status;

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
    select: {
      id: true,
      code: true,
      title: true,
      discipline: true,
      objective: true,
      fvsCode: true,
      status: true,
      createdAt: true,
    },
    orderBy: [{ code: 'asc' }],
  });
}

export async function getById(id: string) {
  // Try by id first, then by code
  const it = await prisma.instrucaoTecnica.findFirst({
    where: { OR: [{ id }, { code: id }] },
    include: itInclude,
  });
  if (!it) throw AppError.notFound('Instrução técnica');
  return it;
}

export async function create(userId: string, input: CreateITInput) {
  return prisma.instrucaoTecnica.create({
    data: {
      code: input.code,
      title: input.title,
      discipline: input.discipline,
      objective: input.objective,
      content: input.content,
      materials: input.materials,
      tools: input.tools,
      steps: input.steps,
      attentionPoints: input.attentionPoints,
      approvalCriteria: input.approvalCriteria,
      relatedNormas: input.relatedNormas,
      normas: input.normas,
      epis: input.epis,
      preRequisitos: input.preRequisitos,
      criteriosQualidade: input.criteriosQualidade,
      errosComuns: input.errosComuns,
      fvsCode: input.fvsCode,
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
    data: { ...input, updatedBy: userId },
    include: itInclude,
  });
}

export async function publish(id: string, userId: string, status: string) {
  const existing = await prisma.instrucaoTecnica.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Instrução técnica');

  const updated = await prisma.instrucaoTecnica.update({
    where: { id },
    data: { status, updatedBy: userId },
    include: itInclude,
  });

  if (status === 'publicada') {
    await syncFvsTemplateFromIT(updated);
  }

  return updated;
}

type ItStep = { order: number; title: string; description: string; momento?: string };

async function syncFvsTemplateFromIT(it: { id: string; code: string; title: string; discipline: string; fvsCode: string | null; steps: any }) {
  if (!it.fvsCode) return;

  const steps = (Array.isArray(it.steps) ? it.steps : []) as ItStep[];
  if (steps.length === 0) return;

  let template = await prisma.fvsTemplate.findFirst({ where: { code: it.fvsCode } });
  if (!template) {
    template = await prisma.fvsTemplate.create({
      data: { code: it.fvsCode, name: it.title, disciplina: it.discipline },
    });
  }

  // Snapshot: wipe items previously sourced from this IT, then recreate from current steps.
  // FVSs already instantiated (ObraFvs) are unaffected — their items reference snapshotted copies.
  await prisma.fvsTemplateItem.deleteMany({
    where: { templateId: template.id, sourceItCode: it.code },
  });

  const sorted = [...steps].sort((a, b) => a.order - b.order);
  await prisma.fvsTemplateItem.createMany({
    data: sorted.map((s, i) => ({
      templateId: template!.id,
      momento: s.momento === 'inicio' ? 'inicio' : 'conclusao',
      descricao: s.title ? `${s.title}${s.description ? ' — ' + s.description : ''}` : s.description,
      obrigatorio: true,
      fotoObrigatoria: true,
      sourceItCode: it.code,
      ordem: i + 1,
    })),
  });
}

export async function bulkUpsert(userId: string, input: BulkITInput) {
  const results = { created: 0, updated: 0, errors: [] as string[] };

  for (const item of input.items) {
    try {
      const existing = await prisma.instrucaoTecnica.findUnique({ where: { code: item.code } });
      if (existing) {
        await prisma.instrucaoTecnica.update({
          where: { code: item.code },
          data: {
            title: item.title,
            discipline: item.discipline,
            objective: item.objective,
            content: item.content,
            materials: item.materials,
            tools: item.tools,
            steps: item.steps,
            attentionPoints: item.attentionPoints,
            approvalCriteria: item.approvalCriteria,
            normas: item.normas,
            epis: item.epis,
            preRequisitos: item.preRequisitos,
            criteriosQualidade: item.criteriosQualidade,
            errosComuns: item.errosComuns,
            fvsCode: item.fvsCode,
            status: item.status ?? existing.status,
            updatedBy: userId,
          },
        });
        results.updated++;
      } else {
        await prisma.instrucaoTecnica.create({
          data: {
            code: item.code,
            title: item.title,
            discipline: item.discipline,
            objective: item.objective,
            content: item.content,
            materials: item.materials,
            tools: item.tools,
            steps: item.steps,
            attentionPoints: item.attentionPoints,
            approvalCriteria: item.approvalCriteria,
            normas: item.normas,
            epis: item.epis,
            preRequisitos: item.preRequisitos,
            criteriosQualidade: item.criteriosQualidade,
            errosComuns: item.errosComuns,
            fvsCode: item.fvsCode,
            status: item.status ?? 'rascunho',
            createdBy: userId,
            updatedBy: userId,
          },
        });
        results.created++;
      }
    } catch (e: any) {
      results.errors.push(`${item.code}: ${e.message}`);
    }
  }

  return results;
}
