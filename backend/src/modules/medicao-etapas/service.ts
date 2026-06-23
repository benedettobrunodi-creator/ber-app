import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type { CreateEtapaInput, UpdateEtapaInput, ReordenarInput } from './types';

export async function listByObra(obraId: string) {
  return prisma.etapa.findMany({
    where: { obraId },
    orderBy: { ordem: 'asc' },
    include: {
      etapaFornecedores: {
        include: { fornecedor: true },
      },
    },
  });
}

export async function getById(id: string) {
  const e = await prisma.etapa.findUnique({
    where: { id },
    include: {
      etapaFornecedores: { include: { fornecedor: true } },
    },
  });
  if (!e) throw AppError.notFound('Etapa');
  return e;
}

export async function create(obraId: string, input: CreateEtapaInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');
  return prisma.etapa.create({
    data: {
      obraId,
      ordem:                 input.ordem,
      nome:                  input.nome,
      descricao:             input.descricao ?? null,
      contratoValor:         input.contratoValor,
      fornecedoresCompletos: input.fornecedoresCompletos ?? false,
      excelLinha:            input.excelLinha ?? null,
    },
  });
}

export async function update(id: string, input: UpdateEtapaInput) {
  const e = await prisma.etapa.findUnique({ where: { id }, select: { id: true } });
  if (!e) throw AppError.notFound('Etapa');
  return prisma.etapa.update({
    where: { id },
    data: {
      ordem:                 input.ordem,
      nome:                  input.nome,
      descricao:             'descricao' in input ? input.descricao ?? null : undefined,
      contratoValor:         input.contratoValor,
      fornecedoresCompletos: input.fornecedoresCompletos,
      excelLinha:            'excelLinha' in input ? input.excelLinha ?? null : undefined,
    },
  });
}

export async function remove(id: string) {
  const e = await prisma.etapa.findUnique({ where: { id }, select: { id: true } });
  if (!e) throw AppError.notFound('Etapa');
  await prisma.etapa.delete({ where: { id } });
}

export async function reordenar(obraId: string, input: ReordenarInput) {
  await prisma.$transaction(
    input.ordens.map(({ id, ordem }) =>
      prisma.etapa.updateMany({ where: { id, obraId }, data: { ordem } }),
    ),
  );
}
