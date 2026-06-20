import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateContratacaoInput, UpdateContratacaoInput } from './types';

const parseDate = (d: string | null | undefined) => (d ? new Date(d) : null);

export async function listByObra(obraId: string) {
  const rows = await prisma.obraContratacao.findMany({
    where: { obraId },
    include: {
      _count: { select: { ocs: true } },
    },
    orderBy: [{ status: 'asc' }, { fornecedor: 'asc' }],
  });
  const totals = rows.reduce(
    (acc, c) => {
      const v = Number(c.valor);
      acc.total += v;
      acc.byStatus[c.status] = (acc.byStatus[c.status] ?? 0) + v;
      return acc;
    },
    { total: 0, byStatus: {} as Record<string, number> },
  );
  return { contratacoes: rows, totals };
}

export async function getOne(id: string) {
  const c = await prisma.obraContratacao.findUnique({
    where: { id },
    include: { ocs: { orderBy: { dataEmissao: 'desc' } } },
  });
  if (!c) throw AppError.notFound('Contratação');
  return c;
}

export async function create(obraId: string, input: CreateContratacaoInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');
  return prisma.obraContratacao.create({
    data: {
      obraId,
      fornecedor:     input.fornecedor,
      disciplina:     input.disciplina ?? null,
      valor:          input.valor,
      dataAssinatura: parseDate(input.dataAssinatura),
      vigenciaInicio: parseDate(input.vigenciaInicio),
      vigenciaFim:    parseDate(input.vigenciaFim),
      observacoes:    input.observacoes ?? null,
    },
  });
}

export async function update(id: string, input: UpdateContratacaoInput) {
  const existing = await prisma.obraContratacao.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Contratação');
  return prisma.obraContratacao.update({
    where: { id },
    data: {
      fornecedor:     input.fornecedor,
      disciplina:     input.disciplina,
      valor:          input.valor,
      dataAssinatura: 'dataAssinatura' in input ? parseDate(input.dataAssinatura) : undefined,
      vigenciaInicio: 'vigenciaInicio' in input ? parseDate(input.vigenciaInicio) : undefined,
      vigenciaFim:    'vigenciaFim'    in input ? parseDate(input.vigenciaFim)    : undefined,
      observacoes:    input.observacoes,
      status:         input.status,
    },
  });
}

export async function remove(id: string) {
  const existing = await prisma.obraContratacao.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Contratação');
  await prisma.attachment.deleteMany({ where: { entityType: 'contratacao', entityId: id } });
  await prisma.obraContratacao.delete({ where: { id } });
}
