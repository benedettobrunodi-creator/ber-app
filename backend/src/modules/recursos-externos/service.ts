import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateRecursoExternoInput } from './types';

export async function listRecursosExternos() {
  return prisma.recursoExterno.findMany({ orderBy: { nome: 'asc' } });
}

export async function createRecursoExterno(data: CreateRecursoExternoInput, createdById: string) {
  return prisma.recursoExterno.create({
    data: { nome: data.nome, funcao: data.funcao, createdById },
  });
}

export async function deleteRecursoExterno(id: string) {
  const existing = await prisma.recursoExterno.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Recurso externo');
  await prisma.recursoExterno.delete({ where: { id } });
}
