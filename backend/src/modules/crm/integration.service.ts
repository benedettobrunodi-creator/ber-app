import { prisma } from '../../config/database';
import { categoriaFromStatus } from '../orcamentos/types';

/**
 * Cria um Orcamento a partir de uma Oportunidade CRM e os vincula.
 * Chamado quando a oportunidade entra em "proposta_producao".
 */
export async function criarOrcamentoDeOportunidade(
  oportunidadeId: string,
  userId: string,
  overrides: {
    numero: string;
    tipo?: string;
    status?: string;
    dataInicio?: Date;
    dataFim?: Date;
  },
) {
  const oport = await prisma.crmOportunidade.findUniqueOrThrow({
    where: { id: oportunidadeId },
    include: { empresa: true },
  });

  if (oport.orcamentoId) {
    return prisma.orcamento.findUniqueOrThrow({ where: { id: oport.orcamentoId } });
  }

  const status = overrides.status ?? 'A_INICIAR';
  const orcamento = await prisma.orcamento.create({
    data: {
      numero: overrides.numero,
      cliente: oport.empresa?.razaoSocial ?? oport.titulo,
      descricaoCurta: oport.titulo,
      valorVenda: oport.valor,
      segmento: oport.empresa?.segmento ?? undefined,
      status,
      categoria: categoriaFromStatus(status),
      tipo: (overrides.tipo ?? 'NOVO') as 'NOVO' | 'REVISAO' | 'CHANGE_ORDER',
      responsavelId: oport.responsavelId ?? undefined,
      dataInicio: overrides.dataInicio,
      dataFim: overrides.dataFim,
      createdById: userId,
    },
  });

  await prisma.crmOportunidade.update({
    where: { id: oportunidadeId },
    data: { orcamentoId: orcamento.id },
  });

  return orcamento;
}

/**
 * Vincula um Orcamento existente a uma Oportunidade CRM.
 */
export async function vincularOrcamento(oportunidadeId: string, orcamentoId: string) {
  await prisma.crmOportunidade.update({
    where: { id: oportunidadeId },
    data: { orcamentoId },
  });
  return prisma.orcamento.findUniqueOrThrow({ where: { id: orcamentoId } });
}

/**
 * Cria uma Obra a partir de um Orçamento aprovado e os vincula.
 */
export async function criarObraDeOrcamento(
  orcamentoId: string,
  userId: string,
  overrides: {
    name?: string;
    address?: string;
    coordinatorId?: string;
    startDate?: Date;
    expectedEndDate?: Date;
  },
) {
  const orc = await prisma.orcamento.findUniqueOrThrow({
    where: { id: orcamentoId },
    include: { obra: true },
  });

  if (orc.obra) return orc.obra;

  const obra = await prisma.obra.create({
    data: {
      name: overrides.name ?? orc.descricaoCurta ?? orc.cliente,
      client: orc.cliente,
      address: overrides.address,
      coordinatorId: overrides.coordinatorId ?? orc.responsavelId,
      startDate: overrides.startDate ?? orc.dataInicio,
      expectedEndDate: overrides.expectedEndDate ?? orc.dataFim,
      status: 'planejamento',
      fase: 'kickoff_interno',
      orcamentoId: orcamentoId,
    },
  });

  return obra;
}

/**
 * Retorna o contexto de integração completo de um orçamento:
 * qual oportunidade CRM deu origem e qual obra foi gerada.
 */
export async function getContextoOrcamento(orcamentoId: string) {
  const [oportunidade, obra] = await Promise.all([
    prisma.crmOportunidade.findFirst({
      where: { orcamentoId },
      select: { id: true, titulo: true, etapa: true, empresa: { select: { razaoSocial: true } } },
    }),
    prisma.obra.findFirst({
      where: { orcamentoId },
      select: { id: true, name: true, status: true, fase: true },
    }),
  ]);
  return { oportunidade, obra };
}
