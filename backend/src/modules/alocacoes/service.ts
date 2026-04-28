import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateAlocacaoInput, UpdateAlocacaoInput } from './types';

const include = {
  user: { select: { id: true, name: true, role: true, avatarUrl: true } },
  recursoExterno: { select: { id: true, nome: true, funcao: true } },
  obra: { select: { id: true, name: true, status: true, startDate: true, expectedEndDate: true } },
} as const;

export async function listAlocacoes() {
  return prisma.alocacao.findMany({ include, orderBy: { createdAt: 'desc' } });
}

export async function createAlocacao(data: CreateAlocacaoInput) {
  return prisma.alocacao.create({
    data: {
      userId: data.userId ?? null,
      recursoExternoId: data.recursoExternoId ?? null,
      obraId: data.obraId,
      fase: data.fase ?? 'ambas',
      dedicacaoPct: data.dedicacaoPct,
      dataInicio: data.dataInicio ? new Date(data.dataInicio) : null,
      dataFim: data.dataFim ? new Date(data.dataFim) : null,
    },
    include,
  });
}

export async function updateAlocacao(id: string, data: UpdateAlocacaoInput) {
  const existing = await prisma.alocacao.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Alocação');

  return prisma.alocacao.update({
    where: { id },
    data: {
      ...(data.userId !== undefined && { userId: data.userId }),
      ...(data.recursoExternoId !== undefined && { recursoExternoId: data.recursoExternoId }),
      ...(data.obraId !== undefined && { obraId: data.obraId }),
      ...(data.fase !== undefined && { fase: data.fase }),
      ...(data.dedicacaoPct !== undefined && { dedicacaoPct: data.dedicacaoPct }),
      ...(data.dataInicio !== undefined && { dataInicio: data.dataInicio ? new Date(data.dataInicio) : null }),
      ...(data.dataFim !== undefined && { dataFim: data.dataFim ? new Date(data.dataFim) : null }),
    },
    include,
  });
}

export async function deleteAlocacao(id: string) {
  const existing = await prisma.alocacao.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Alocação');
  await prisma.alocacao.delete({ where: { id } });
}
