import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateOcInput, UpdateOcInput } from './types';

const parseDate = (d: string | null | undefined) => (d ? new Date(d) : null);

export async function listByObra(obraId: string) {
  const rows = await prisma.obraOrdemCompra.findMany({
    where: { obraId },
    include: { contratacao: { select: { id: true, fornecedor: true, disciplina: true } } },
    orderBy: { dataEmissao: 'desc' },
  });
  const totals = rows.reduce(
    (acc, o) => {
      const v = Number(o.valor);
      acc.total += v;
      acc.byStatus[o.status] = (acc.byStatus[o.status] ?? 0) + v;
      return acc;
    },
    { total: 0, byStatus: {} as Record<string, number> },
  );
  return { ocs: rows, totals };
}

export async function create(obraId: string, input: CreateOcInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');

  if (input.contratacaoId) {
    const c = await prisma.obraContratacao.findUnique({
      where: { id: input.contratacaoId },
      select: { obraId: true },
    });
    if (!c) throw AppError.notFound('Contratação');
    if (c.obraId !== obraId) {
      throw AppError.badRequest('Contratação não pertence a esta obra');
    }
  }

  return prisma.obraOrdemCompra.create({
    data: {
      obraId,
      contratacaoId:       input.contratacaoId ?? null,
      numero:              input.numero,
      fornecedor:          input.fornecedor,
      descricao:           input.descricao,
      valor:               input.valor,
      dataPrevistaEntrega: parseDate(input.dataPrevistaEntrega),
      observacoes:         input.observacoes ?? null,
    },
    include: { contratacao: { select: { id: true, fornecedor: true } } },
  });
}

export async function update(id: string, input: UpdateOcInput) {
  const existing = await prisma.obraOrdemCompra.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Ordem de Compra');
  return prisma.obraOrdemCompra.update({
    where: { id },
    data: {
      numero:              input.numero,
      fornecedor:          input.fornecedor,
      descricao:           input.descricao,
      valor:               input.valor,
      contratacaoId:       input.contratacaoId,
      dataPrevistaEntrega: 'dataPrevistaEntrega' in input ? parseDate(input.dataPrevistaEntrega) : undefined,
      dataEntregaReal:     'dataEntregaReal'     in input ? parseDate(input.dataEntregaReal)     : undefined,
      status:              input.status,
      observacoes:         input.observacoes,
    },
    include: { contratacao: { select: { id: true, fornecedor: true } } },
  });
}

export async function remove(id: string) {
  const existing = await prisma.obraOrdemCompra.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Ordem de Compra');
  await prisma.attachment.deleteMany({ where: { entityType: 'ordem_compra', entityId: id } });
  await prisma.obraOrdemCompra.delete({ where: { id } });
}
