import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreatePlanoInput, UpdatePlanoInput } from './types';

const parseDate = (d: string | null | undefined) => (d ? new Date(d) : null);

/** Calcula status real considerando atraso vs status armazenado */
function effectiveStatus(p: { status: string; dataLimite: Date | null; contratacaoId: string | null }) {
  if (p.contratacaoId) return 'contratado';
  if (p.status === 'contratado' && !p.contratacaoId) return 'a_contratar';
  if (p.dataLimite && p.dataLimite.getTime() < Date.now() && p.status !== 'contratado') return 'atrasado';
  return p.status;
}

export async function listByObra(obraId: string) {
  const rows = await prisma.obraContratacaoPlano.findMany({
    where: { obraId },
    include: { contratacao: { select: { id: true, fornecedor: true, valor: true, status: true } } },
    orderBy: [{ dataIdeal: 'asc' }, { dataLimite: 'asc' }, { pacote: 'asc' }],
  });
  return rows.map(r => ({ ...r, statusEfetivo: effectiveStatus(r) }));
}

export async function create(obraId: string, input: CreatePlanoInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');
  return prisma.obraContratacaoPlano.create({
    data: {
      obraId,
      pacote:     input.pacote,
      dataIdeal:  parseDate(input.dataIdeal),
      dataLimite: parseDate(input.dataLimite),
      observacoes: input.observacoes ?? null,
    },
  });
}

export async function update(id: string, input: UpdatePlanoInput) {
  const existing = await prisma.obraContratacaoPlano.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Plano de contratação');

  // Se vinculou a uma contratação, valida que ela existe e é da mesma obra
  if (input.contratacaoId) {
    const c = await prisma.obraContratacao.findUnique({
      where: { id: input.contratacaoId },
      select: { obraId: true },
    });
    if (!c) throw AppError.notFound('Contratação');
    if (c.obraId !== existing.obraId) {
      throw AppError.badRequest('Contratação não pertence a esta obra');
    }
  }

  return prisma.obraContratacaoPlano.update({
    where: { id },
    data: {
      pacote:        input.pacote,
      dataIdeal:     'dataIdeal'  in input ? parseDate(input.dataIdeal)  : undefined,
      dataLimite:    'dataLimite' in input ? parseDate(input.dataLimite) : undefined,
      observacoes:   input.observacoes,
      status:        input.contratacaoId ? 'contratado' : input.status,
      contratacaoId: input.contratacaoId,
    },
  });
}

export async function remove(id: string) {
  const existing = await prisma.obraContratacaoPlano.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Plano de contratação');
  await prisma.obraContratacaoPlano.delete({ where: { id } });
}
