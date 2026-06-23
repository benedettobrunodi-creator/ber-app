import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { randomUUID } from 'node:crypto';
import type {
  CreateMedicaoInput,
  UpdateMedicaoInput,
  TransitionInput,
  UpdateItemInput,
  PagamentoDiretoInput,
} from './types';

// Transições permitidas no fluxo (mesma máquina de estado do ber-medicao)
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  rascunho:    ['enviada'],
  enviada:     ['aprovada', 'contestada', 'rascunho'],
  contestada:  ['rascunho'],
  aprovada:    ['nf_emitida', 'contestada'],
  nf_emitida:  ['paga', 'contestada'],
  paga:        [],
};

export async function listByObra(obraId: string) {
  return prisma.medicao.findMany({
    where: { obraId },
    orderBy: { numero: 'asc' },
    include: {
      _count: { select: { itens: true } },
    },
  });
}

export async function getDetail(id: string) {
  const m = await prisma.medicao.findUnique({
    where: { id },
    include: {
      obra: true,
      itens: { include: { etapaFornecedor: { include: { etapa: true, fornecedor: true } } } },
      transicoes: { orderBy: { createdAt: 'asc' }, include: { user: { select: { id: true, name: true } } } },
      pagamentosDiretos: true,
    },
  });
  if (!m) throw AppError.notFound('Medição');
  return m;
}

export async function create(obraId: string, userId: string | null, input: CreateMedicaoInput) {
  const obra = await prisma.obra.findUnique({ where: { id: obraId } });
  if (!obra) throw AppError.notFound('Obra');

  // Pré-cria MedicaoItens zerados pra todos os EtapaFornecedor existentes
  const efs = await prisma.etapaFornecedor.findMany({
    where: { etapa: { obraId } },
    select: { id: true, etapa: { select: { obraId: true } } },
  });

  return prisma.$transaction(async (tx) => {
    const m = await tx.medicao.create({
      data: {
        obraId,
        numero:                input.numero,
        periodoInicio:         new Date(input.periodoInicio),
        periodoFim:            new Date(input.periodoFim),
        status:                'rascunho',
        dataPagamentoPrevista: input.dataPagamentoPrevista ? new Date(input.dataPagamentoPrevista) : null,
      },
    });

    // Inicializa o percentual acumulado com o último da medição anterior
    const anteriores = await tx.medicao.findMany({
      where: { obraId, numero: { lt: input.numero } },
      orderBy: { numero: 'desc' },
      take: 1,
      include: { itens: true },
    });
    const percMap = new Map<string, number>(
      (anteriores[0]?.itens ?? []).map((i) => [i.etapaFornecedorId, Number(i.percentualAcumulado)]),
    );

    if (efs.length > 0) {
      await tx.medicaoItem.createMany({
        data: efs.map((ef) => ({
          medicaoId: m.id,
          etapaFornecedorId: ef.id,
          valorQuinzena: 0,
          percentualAcumulado: percMap.get(ef.id) ?? 0,
        })),
      });
    }

    await tx.medicaoTransicao.create({
      data: {
        medicaoId: m.id,
        userId,
        deStatus: null,
        paraStatus: 'rascunho',
        comentario: 'Medição criada',
      },
    });

    return m;
  });
}

export async function update(id: string, input: UpdateMedicaoInput) {
  const m = await prisma.medicao.findUnique({ where: { id } });
  if (!m) throw AppError.notFound('Medição');
  return prisma.medicao.update({
    where: { id },
    data: {
      numero:                 input.numero,
      periodoInicio:          input.periodoInicio ? new Date(input.periodoInicio) : undefined,
      periodoFim:             input.periodoFim ? new Date(input.periodoFim) : undefined,
      dataPagamentoPrevista:
        'dataPagamentoPrevista' in input
          ? (input.dataPagamentoPrevista ? new Date(input.dataPagamentoPrevista) : null)
          : undefined,
      dataPagamentoRealizado:
        'dataPagamentoRealizado' in input
          ? (input.dataPagamentoRealizado ? new Date(input.dataPagamentoRealizado) : null)
          : undefined,
    },
  });
}

export async function remove(id: string) {
  const m = await prisma.medicao.findUnique({ where: { id } });
  if (!m) throw AppError.notFound('Medição');
  if (m.status !== 'rascunho') {
    throw AppError.badRequest('Só é possível excluir medição em rascunho');
  }
  await prisma.medicao.delete({ where: { id } });
}

export async function transition(id: string, userId: string | null, input: TransitionInput) {
  const m = await prisma.medicao.findUnique({ where: { id } });
  if (!m) throw AppError.notFound('Medição');
  const allowed = ALLOWED_TRANSITIONS[m.status] ?? [];
  if (!allowed.includes(input.para)) {
    throw AppError.badRequest(`Transição ${m.status} → ${input.para} não permitida`);
  }

  return prisma.$transaction(async (tx) => {
    // Ao enviar pela primeira vez, gera token público pro portal do cliente
    let tokenPublico = m.tokenPublico;
    if (input.para === 'enviada' && !tokenPublico) {
      tokenPublico = randomUUID();
    }
    if (input.para === 'paga' && !m.dataPagamentoRealizado) {
      await tx.medicao.update({ where: { id }, data: { dataPagamentoRealizado: new Date() } });
    }

    const updated = await tx.medicao.update({
      where: { id },
      data: { status: input.para, tokenPublico: tokenPublico ?? m.tokenPublico },
    });
    await tx.medicaoTransicao.create({
      data: {
        medicaoId: id,
        userId,
        deStatus: m.status,
        paraStatus: input.para,
        comentario: input.comentario ?? null,
      },
    });
    return updated;
  });
}

/**
 * Atualiza % acumulado de um item — replica atualizarPercentualFornecedor do ber-medicao.
 * - Valida que não recua abaixo do max acumulado em medições anteriores.
 * - Recalcula valorQuinzena = (acumulado_atual - acumulado_anterior) / 100 * valorContratado.
 */
export async function updateItem(itemId: string, input: UpdateItemInput) {
  const item = await prisma.medicaoItem.findUnique({
    where: { id: itemId },
    include: {
      medicao: true,
      etapaFornecedor: true,
    },
  });
  if (!item) throw AppError.notFound('MedicaoItem');
  if (item.medicao.status !== 'rascunho') {
    throw AppError.badRequest('Só é possível editar itens em medição rascunho');
  }

  // Acumulado máximo anterior pra esse EF em qualquer medição prévia
  const anteriores = await prisma.medicaoItem.findMany({
    where: {
      etapaFornecedorId: item.etapaFornecedorId,
      medicao: { obraId: item.medicao.obraId, numero: { lt: item.medicao.numero } },
    },
    select: { percentualAcumulado: true },
  });
  const maxAnterior = anteriores.reduce(
    (acc, x) => Math.max(acc, Number(x.percentualAcumulado)),
    0,
  );

  if (input.percentualAcumulado < maxAnterior) {
    throw AppError.badRequest(
      `% acumulado não pode recuar. Anterior: ${maxAnterior.toFixed(0)}%`,
    );
  }

  const periodo = input.percentualAcumulado - maxAnterior;
  const valorQuinzena = (periodo / 100) * Number(item.etapaFornecedor.valorContratado);

  const updated = await prisma.medicaoItem.update({
    where: { id: itemId },
    data: {
      percentualAcumulado: input.percentualAcumulado,
      valorQuinzena,
    },
  });

  return { ...updated, valorQuinzena: Number(updated.valorQuinzena) };
}

/**
 * Upsert pagamento direto (cliente pagou X pro fornecedor entre medições).
 * Valor = 0 remove o registro.
 */
export async function upsertPagamentoDireto(medicaoId: string, input: PagamentoDiretoInput) {
  const m = await prisma.medicao.findUnique({ where: { id: medicaoId } });
  if (!m) throw AppError.notFound('Medição');
  if (m.status !== 'rascunho') {
    throw AppError.badRequest('Pagamento direto só pode ser editado em rascunho');
  }
  const valor = Number(input.valor);
  if (!Number.isFinite(valor) || valor < 0) {
    throw AppError.badRequest('Valor deve ser ≥ 0');
  }

  if (valor === 0) {
    await prisma.medicaoPagamentoDireto.deleteMany({
      where: { medicaoId, fornecedorRazaoSocial: input.fornecedorRazaoSocial },
    });
    return { removed: true };
  }

  return prisma.medicaoPagamentoDireto.upsert({
    where: {
      medicaoId_fornecedorRazaoSocial: {
        medicaoId,
        fornecedorRazaoSocial: input.fornecedorRazaoSocial,
      },
    },
    update: { valor, observacao: input.observacao ?? null },
    create: {
      medicaoId,
      fornecedorRazaoSocial: input.fornecedorRazaoSocial,
      valor,
      observacao: input.observacao ?? null,
    },
  });
}
