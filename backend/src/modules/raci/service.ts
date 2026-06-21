import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateRaciInput, UpdateRaciInput } from './types';
import { RACI_DEFAULT_ATIVIDADES } from './templates';

export async function listByObra(obraId: string) {
  return prisma.obraRaci.findMany({
    where: { obraId },
    orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function create(obraId: string, input: CreateRaciInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');
  return prisma.obraRaci.create({
    data: {
      obraId,
      atividade: input.atividade,
      ordem:     input.ordem ?? 0,
      papeis:    input.papeis ?? {},
    },
  });
}

export async function update(id: string, input: UpdateRaciInput) {
  const existing = await prisma.obraRaci.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Item RACI');
  return prisma.obraRaci.update({
    where: { id },
    data: {
      atividade: input.atividade,
      ordem:     input.ordem,
      papeis:    input.papeis,
    },
  });
}

export async function remove(id: string) {
  const existing = await prisma.obraRaci.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Item RACI');
  await prisma.obraRaci.delete({ where: { id } });
}

/**
 * Aplica o template padrão (15 atividades) na obra.
 * Idempotente: pula atividades já cadastradas (match exato por nome).
 */
export async function applyTemplate(obraId: string) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');

  const existing = await prisma.obraRaci.findMany({
    where: { obraId },
    select: { atividade: true, ordem: true },
  });
  const existingNames = new Set(existing.map(e => e.atividade));
  const maxOrdem = existing.reduce((m, e) => Math.max(m, e.ordem), -1);

  const novas = RACI_DEFAULT_ATIVIDADES
    .filter(a => !existingNames.has(a))
    .map((atividade, i) => ({
      obraId,
      atividade,
      ordem: maxOrdem + 1 + i,
      papeis: {},
    }));

  if (novas.length > 0) {
    await prisma.obraRaci.createMany({ data: novas });
  }

  return {
    created: novas.length,
    skipped: RACI_DEFAULT_ATIVIDADES.length - novas.length,
  };
}
