import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateAditivoInput, UpdateAditivoInput, DecisionInput } from './types';

export async function listByObra(obraId: string) {
  const rows = await prisma.obraAditivo.findMany({
    where: { obraId },
    include: { decididoPor: { select: { id: true, name: true } } },
    orderBy: [{ dataAbertura: 'desc' }, { numero: 'desc' }],
  });

  const totals = rows.reduce(
    (acc, a) => {
      const v = Number(a.valor) * (a.tipo === 'debito' ? -1 : 1);
      acc.total += v;
      acc.byStatus[a.status] = (acc.byStatus[a.status] ?? 0) + v;
      return acc;
    },
    { total: 0, byStatus: {} as Record<string, number> },
  );

  // Contagem de anexos por aditivo (02/09/26 — clipe na lista)
  const counts = rows.length
    ? await prisma.attachment.groupBy({
        by: ['entityId'],
        where: { entityType: 'aditivo', entityId: { in: rows.map((r) => r.id) } },
        _count: { _all: true },
      })
    : [];
  const countMap = new Map(counts.map((c) => [c.entityId, c._count._all]));
  const aditivos = rows.map((r) => ({ ...r, attachmentsCount: countMap.get(r.id) ?? 0 }));

  return { aditivos, totals };
}

export async function getOne(id: string) {
  const a = await prisma.obraAditivo.findUnique({
    where: { id },
    include: { decididoPor: { select: { id: true, name: true } } },
  });
  if (!a) throw AppError.notFound('Aditivo');
  return a;
}

export async function create(obraId: string, input: CreateAditivoInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');

  return prisma.obraAditivo.create({
    data: {
      obraId,
      numero: input.numero,
      descricao: input.descricao,
      valor: input.valor,
      tipo: input.tipo,
      motivo: input.motivo ?? null,
    },
    include: { decididoPor: { select: { id: true, name: true } } },
  });
}

export async function update(id: string, input: UpdateAditivoInput) {
  const existing = await prisma.obraAditivo.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Aditivo');
  return prisma.obraAditivo.update({
    where: { id },
    data: {
      numero: input.numero,
      descricao: input.descricao,
      valor: input.valor,
      tipo: input.tipo,
      motivo: input.motivo,
      status: input.status,
    },
    include: { decididoPor: { select: { id: true, name: true } } },
  });
}

export async function decide(id: string, input: DecisionInput, decisorUserId: string) {
  const existing = await prisma.obraAditivo.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Aditivo');
  if (existing.status !== 'em_analise') {
    throw AppError.conflict(`Aditivo já está em status "${existing.status}" — não pode ser decidido novamente`);
  }
  return prisma.obraAditivo.update({
    where: { id },
    data: {
      status: input.status,
      dataDecisao: new Date(),
      decididoPorId: decisorUserId,
    },
    include: { decididoPor: { select: { id: true, name: true } } },
  });
}

export async function remove(id: string) {
  const existing = await prisma.obraAditivo.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Aditivo');
  await prisma.attachment.deleteMany({ where: { entityType: 'aditivo', entityId: id } });
  await prisma.obraAditivo.delete({ where: { id } });
}
