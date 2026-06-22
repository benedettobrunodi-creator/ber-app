import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateTemperaturaInput, UpdateTemperaturaInput } from './types';

const includePreenchidoPor = {
  preenchidoPor: { select: { id: true, name: true, avatarUrl: true } },
} as const;

export async function listByObra(obraId: string) {
  return prisma.obraTemperatura.findMany({
    where: { obraId },
    orderBy: { data: 'desc' },
    include: includePreenchidoPor,
  });
}

export async function create(obraId: string, input: CreateTemperaturaInput, userId: string) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');
  return prisma.obraTemperatura.create({
    data: {
      obraId,
      tipo:            input.tipo,
      data:            new Date(input.data),
      avaliacao:       input.avaliacao,
      observacao:      input.observacao ?? null,
      preenchidoPorId: userId,
    },
    include: includePreenchidoPor,
  });
}

export async function update(id: string, input: UpdateTemperaturaInput) {
  const existing = await prisma.obraTemperatura.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Temperatura');
  return prisma.obraTemperatura.update({
    where: { id },
    data: {
      tipo:       input.tipo,
      data:       input.data ? new Date(input.data) : undefined,
      avaliacao:  input.avaliacao,
      observacao: input.observacao,
    },
    include: includePreenchidoPor,
  });
}

export async function remove(id: string) {
  const existing = await prisma.obraTemperatura.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Temperatura');
  await prisma.obraTemperatura.delete({ where: { id } });
}

/**
 * Obras em execução com mais de 15 dias desde a última temperatura quinzenal.
 * Usado pelo cron de lembrete.
 */
export async function obrasComQuinzenalAtrasada(limiteDias = 15) {
  const obras = await prisma.obra.findMany({
    where: { status: 'em_andamento' },
    select: {
      id: true,
      name: true,
      coordinatorId: true,
      temperaturas: {
        where: { tipo: 'quinzenal' },
        orderBy: { data: 'desc' },
        take: 1,
        select: { data: true },
      },
    },
  });

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const limite = limiteDias * 86_400_000;

  return obras.filter(o => {
    const ultima = o.temperaturas[0]?.data;
    if (!ultima) return true; // nunca preencheu
    return hoje.getTime() - new Date(ultima).getTime() >= limite;
  });
}
