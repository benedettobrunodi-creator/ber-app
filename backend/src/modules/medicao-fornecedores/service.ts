import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import type {
  CreateFornecedorInput,
  UpdateFornecedorInput,
  QuickAddInput,
  UpdateEtapaFornInput,
} from './types';

export async function listFornecedoresByObra(obraId: string) {
  return prisma.fornecedor.findMany({
    where: { obraId },
    orderBy: { razaoSocial: 'asc' },
  });
}

export async function createFornecedor(obraId: string, input: CreateFornecedorInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { id: true } });
  if (!obra) throw AppError.notFound('Obra');
  return prisma.fornecedor.create({
    data: {
      obraId,
      razaoSocial: input.razaoSocial,
      cnpj:        input.cnpj ?? '',
      contato:     input.contato ?? null,
    },
  });
}

export async function updateFornecedor(id: string, input: UpdateFornecedorInput) {
  const f = await prisma.fornecedor.findUnique({ where: { id }, select: { id: true } });
  if (!f) throw AppError.notFound('Fornecedor');
  return prisma.fornecedor.update({
    where: { id },
    data: {
      razaoSocial: input.razaoSocial,
      cnpj:        'cnpj'    in input ? input.cnpj ?? '' : undefined,
      contato:     'contato' in input ? input.contato ?? null : undefined,
    },
  });
}

export async function removeFornecedor(id: string) {
  const f = await prisma.fornecedor.findUnique({ where: { id }, select: { id: true } });
  if (!f) throw AppError.notFound('Fornecedor');
  await prisma.fornecedor.delete({ where: { id } });
}

/**
 * Quick add fornecedor numa etapa (replica do ber-medicao).
 * - Reaproveita Fornecedor existente por razão social (case-insensitive) na mesma obra.
 * - Valida saldo da etapa.
 * - Se medicaoId vier e estiver em rascunho, cria MedicaoItem zerado.
 */
export async function quickAdd(etapaId: string, input: QuickAddInput) {
  const etapa = await prisma.etapa.findUnique({
    where: { id: etapaId },
    include: { etapaFornecedores: true },
  });
  if (!etapa) throw AppError.notFound('Etapa');

  const valorContratado = Number(input.valorContratado);
  if (!Number.isFinite(valorContratado) || valorContratado <= 0) {
    throw AppError.badRequest('Valor contratado inválido');
  }

  const somaAtual = etapa.etapaFornecedores.reduce((acc, ef) => acc + Number(ef.valorContratado), 0);
  const saldo = Number(etapa.contratoValor) - somaAtual;
  if (valorContratado > saldo + 0.005) {
    throw AppError.badRequest(
      `Valor excede o saldo disponível da etapa (R$ ${saldo.toFixed(2)})`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const existente = await tx.fornecedor.findFirst({
      where: {
        obraId: etapa.obraId,
        razaoSocial: { equals: input.razaoSocial.trim(), mode: 'insensitive' },
      },
    });
    const fornecedorId = existente
      ? existente.id
      : (await tx.fornecedor.create({
          data: {
            obraId: etapa.obraId,
            razaoSocial: input.razaoSocial.trim(),
            cnpj: input.cnpj ?? '',
            contato: input.contato ?? null,
          },
        })).id;

    const ef = await tx.etapaFornecedor.create({
      data: {
        etapaId,
        fornecedorId,
        escopo: input.escopo ?? null,
        tipo: input.tipo,
        valorContratado,
      },
    });

    if (input.medicaoId) {
      const m = await tx.medicao.findUnique({ where: { id: input.medicaoId } });
      if (m && m.status === 'rascunho') {
        await tx.medicaoItem.create({
          data: {
            medicaoId: input.medicaoId,
            etapaFornecedorId: ef.id,
            valorQuinzena: 0,
            percentualAcumulado: 0,
          },
        });
      }
    }

    return ef;
  });
}

export async function updateEtapaFornecedor(id: string, input: UpdateEtapaFornInput) {
  const ef = await prisma.etapaFornecedor.findUnique({ where: { id }, select: { id: true } });
  if (!ef) throw AppError.notFound('EtapaFornecedor');
  return prisma.etapaFornecedor.update({
    where: { id },
    data: {
      escopo:          'escopo' in input ? input.escopo ?? null : undefined,
      tipo:            input.tipo,
      valorContratado: input.valorContratado != null ? Number(input.valorContratado) : undefined,
      fornecedorId:    'fornecedorId' in input ? input.fornecedorId ?? null : undefined,
    },
  });
}

export async function removeEtapaFornecedor(id: string) {
  const ef = await prisma.etapaFornecedor.findUnique({ where: { id }, select: { id: true } });
  if (!ef) throw AppError.notFound('EtapaFornecedor');
  await prisma.etapaFornecedor.delete({ where: { id } });
}
