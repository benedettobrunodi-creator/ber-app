import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateRecebimentoInput, UpdateRecebimentoInput } from './types';

const recebimentoInclude = {
  registrador: { select: { id: true, name: true } },
};

export async function listByObra(obraId: string) {
  return prisma.recebimentoMaterial.findMany({
    where: { obraId },
    include: recebimentoInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getById(id: string) {
  const rec = await prisma.recebimentoMaterial.findUnique({
    where: { id },
    include: recebimentoInclude,
  });
  if (!rec) throw AppError.notFound('Recebimento de material');
  return rec;
}

export async function create(obraId: string, userId: string, input: CreateRecebimentoInput) {
  return prisma.recebimentoMaterial.create({
    data: {
      obraId,
      fornecedor: input.fornecedor,
      material: input.material,
      quantidade: input.quantidade,
      unidade: input.unidade,
      numeroNF: input.numeroNF,
      dataNF: input.dataNF ? new Date(input.dataNF) : undefined,
      dataEntrega: new Date(input.dataEntrega),
      condicao: input.condicao,
      observacao: input.observacao,
      fotosMaterial: input.fotosMaterial,
      fotoNF: input.fotoNF,
      registradoPor: userId,
    },
    include: recebimentoInclude,
  });
}

export async function update(id: string, input: UpdateRecebimentoInput) {
  const existing = await prisma.recebimentoMaterial.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Recebimento de material');

  const data: Record<string, unknown> = { ...input };
  if (input.dataNF) data.dataNF = new Date(input.dataNF);
  if (input.dataEntrega) data.dataEntrega = new Date(input.dataEntrega);

  return prisma.recebimentoMaterial.update({
    where: { id },
    data,
    include: recebimentoInclude,
  });
}
