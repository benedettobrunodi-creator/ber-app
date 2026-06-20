import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateRaciInput, UpdateRaciInput } from './types';

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
