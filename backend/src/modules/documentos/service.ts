import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateDocumentoInput, UpdateDocumentoInput } from './types';

const parseDate = (d: string | null | undefined) => (d ? new Date(d) : null);

export async function listByObra(obraId: string) {
  const rows = await prisma.obraDocumento.findMany({
    where: { obraId },
    include: { aprovadoPor: { select: { id: true, name: true } } },
    orderBy: [{ status: 'asc' }, { tipo: 'asc' }, { nome: 'asc' }],
  });
  const totals = rows.reduce((acc, d) => {
    acc.byStatus[d.status] = (acc.byStatus[d.status] ?? 0) + 1;
    return acc;
  }, { byStatus: {} as Record<string, number> });
  return { documentos: rows, totals };
}

export async function create(obraId: string, input: CreateDocumentoInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');
  return prisma.obraDocumento.create({
    data: {
      obraId,
      tipo:        input.tipo,
      nome:        input.nome,
      revisao:     input.revisao ?? null,
      emitidoPor:  input.emitidoPor ?? null,
      dataEmissao: parseDate(input.dataEmissao),
      observacoes: input.observacoes ?? null,
    },
  });
}

export async function update(id: string, input: UpdateDocumentoInput, userId?: string) {
  const existing = await prisma.obraDocumento.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Documento');

  // Aprovação registra quem e quando
  const transitionsToApproved = input.status === 'aprovado' && existing.status !== 'aprovado';

  return prisma.obraDocumento.update({
    where: { id },
    data: {
      tipo:        input.tipo,
      nome:        input.nome,
      revisao:     input.revisao,
      emitidoPor:  input.emitidoPor,
      dataEmissao: 'dataEmissao' in input ? parseDate(input.dataEmissao) : undefined,
      observacoes: input.observacoes,
      status:      input.status,
      aprovadoEm:   transitionsToApproved ? new Date() : undefined,
      aprovadoPorId: transitionsToApproved ? userId ?? null : undefined,
    },
    include: { aprovadoPor: { select: { id: true, name: true } } },
  });
}

export async function remove(id: string) {
  const existing = await prisma.obraDocumento.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Documento');
  await prisma.attachment.deleteMany({ where: { entityType: 'documento', entityId: id } });
  await prisma.obraDocumento.delete({ where: { id } });
}
