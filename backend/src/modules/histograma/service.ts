import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { BulkUpsertInput, UpsertCellInput } from './types';

export async function listByObra(obraId: string) {
  return prisma.obraHistograma.findMany({
    where: { obraId },
    orderBy: [{ ano: 'asc' }, { mes: 'asc' }, { funcao: 'asc' }],
  });
}

export async function upsertCell(obraId: string, c: UpsertCellInput) {
  await prisma.obra.findUniqueOrThrow({ where: { id: obraId }, select: { id: true } })
    .catch(() => { throw AppError.notFound('Obra'); });
  return prisma.obraHistograma.upsert({
    where: { obraId_funcao_ano_mes: { obraId, funcao: c.funcao, ano: c.ano, mes: c.mes } },
    create: { obraId, funcao: c.funcao, ano: c.ano, mes: c.mes, hhPlan: c.hhPlan ?? 0, hhReal: c.hhReal ?? 0 },
    update: { hhPlan: c.hhPlan, hhReal: c.hhReal },
  });
}

export async function bulkUpsert(obraId: string, input: BulkUpsertInput) {
  await prisma.obra.findUniqueOrThrow({ where: { id: obraId }, select: { id: true } })
    .catch(() => { throw AppError.notFound('Obra'); });
  return prisma.$transaction(input.cells.map(c =>
    prisma.obraHistograma.upsert({
      where: { obraId_funcao_ano_mes: { obraId, funcao: c.funcao, ano: c.ano, mes: c.mes } },
      create: { obraId, funcao: c.funcao, ano: c.ano, mes: c.mes, hhPlan: c.hhPlan ?? 0, hhReal: c.hhReal ?? 0 },
      update: { hhPlan: c.hhPlan, hhReal: c.hhReal },
    }),
  ));
}

export async function renameFuncao(obraId: string, from: string, to: string) {
  // Remove all rows of "to" that conflict, depois renomeia "from" -> "to"
  await prisma.$transaction([
    prisma.obraHistograma.deleteMany({ where: { obraId, funcao: to } }),
    prisma.obraHistograma.updateMany({ where: { obraId, funcao: from }, data: { funcao: to } }),
  ]);
}

export async function deleteFuncao(obraId: string, funcao: string) {
  await prisma.obraHistograma.deleteMany({ where: { obraId, funcao } });
}
