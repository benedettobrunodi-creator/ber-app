import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { categoriaFromStatus } from './types';
import type { CreateOrcamentoInput, UpdateOrcamentoInput } from './types';

const INCLUDE_BASE = {
  responsavel: { select: { id: true, name: true, role: true } },
  createdBy: { select: { id: true, name: true } },
  pai: { select: { id: true, numero: true, cliente: true } },
  filhos: { select: { id: true, numero: true, cliente: true, status: true } },
} as const;

export async function list(filters: {
  status?: string;
  categoria?: string;
  responsavelId?: string;
  segmento?: string;
  estrategico?: string;
  inicio?: string;
  fim?: string;
  q?: string;
}) {
  const where: any = {};

  if (filters.status) where.status = filters.status;
  if (filters.categoria) where.categoria = filters.categoria;
  if (filters.responsavelId) where.responsavelId = filters.responsavelId;
  if (filters.segmento) where.segmento = filters.segmento;
  if (filters.estrategico !== undefined) where.estrategico = filters.estrategico === 'true';
  if (filters.q) {
    where.OR = [
      { numero: { contains: filters.q, mode: 'insensitive' } },
      { cliente: { contains: filters.q, mode: 'insensitive' } },
      { descricaoCurta: { contains: filters.q, mode: 'insensitive' } },
    ];
  }
  if (filters.inicio || filters.fim) {
    where.dataInicio = {};
    if (filters.inicio) where.dataInicio.gte = new Date(filters.inicio);
    if (filters.fim) where.dataFim = { lte: new Date(filters.fim) };
  }

  return prisma.orcamento.findMany({
    where,
    include: INCLUDE_BASE,
    orderBy: [{ categoria: 'asc' }, { dataInicio: 'asc' }],
  });
}

export async function timeline() {
  return prisma.orcamento.findMany({
    where: {
      OR: [
        { dataInicio: { not: null } },
        { dataFim: { not: null } },
      ],
    },
    select: {
      id: true,
      numero: true,
      cliente: true,
      status: true,
      categoria: true,
      estrategico: true,
      dataInicio: true,
      dataFim: true,
      dataEntrega: true,
      segmento: true,
      valorVenda: true,
      responsavel: { select: { id: true, name: true } },
    },
    orderBy: [{ categoria: 'asc' }, { dataInicio: 'asc' }],
  });
}

export async function getById(id: string) {
  const orc = await prisma.orcamento.findUnique({
    where: { id },
    include: {
      ...INCLUDE_BASE,
      historico: { orderBy: { alteradoEm: 'desc' }, take: 50 },
    },
  });
  if (!orc) throw AppError.notFound('Orçamento');
  return orc;
}

export async function create(userId: string, input: CreateOrcamentoInput) {
  const existing = await prisma.orcamento.findUnique({ where: { numero: input.numero } });
  if (existing) throw AppError.conflict(`Número ${input.numero} já existe`);

  return prisma.orcamento.create({
    data: {
      numero: input.numero,
      cliente: input.cliente,
      descricaoCurta: input.descricaoCurta,
      m2: input.m2,
      valorVenda: input.valorVenda,
      segmento: input.segmento,
      estrategico: input.estrategico ?? false,
      tipo: input.tipo ?? 'NOVO',
      probabilidade: input.probabilidade ?? null,
      status: input.status,
      categoria: categoriaFromStatus(input.status),
      dataInicio: input.dataInicio ?? null,
      dataFim: input.dataFim ?? null,
      dataEntrega: input.dataEntrega ?? null,
      responsavelId: input.responsavelId ?? null,
      observacoes: input.observacoes,
      changeOrderDe: input.changeOrderDe ?? null,
      createdById: userId,
    },
    include: INCLUDE_BASE,
  });
}

const TRACKED_FIELDS: Array<keyof UpdateOrcamentoInput> = [
  'status', 'responsavelId', 'valorVenda', 'dataInicio', 'dataFim',
];

export async function update(id: string, userName: string, input: UpdateOrcamentoInput) {
  const existing = await prisma.orcamento.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Orçamento');

  if (input.numero && input.numero !== existing.numero) {
    const conflict = await prisma.orcamento.findFirst({
      where: { numero: input.numero, id: { not: id } },
    });
    if (conflict) throw AppError.conflict(`Número ${input.numero} já existe`);
  }

  // Build history entries for tracked fields
  const histEntries: Array<{
    orcamentoId: string;
    campo: string;
    valorAntigo: string | null;
    valorNovo: string | null;
    alteradoPor: string;
  }> = [];

  for (const field of TRACKED_FIELDS) {
    if (field in input) {
      const oldVal = (existing as any)[field];
      const newVal = (input as any)[field];
      const oldStr = oldVal != null ? String(oldVal) : null;
      const newStr = newVal != null ? String(newVal) : null;
      if (oldStr !== newStr) {
        histEntries.push({
          orcamentoId: id,
          campo: field,
          valorAntigo: oldStr,
          valorNovo: newStr,
          alteradoPor: userName,
        });
      }
    }
  }

  const [updated] = await prisma.$transaction([
    prisma.orcamento.update({
      where: { id },
      data: {
        numero: input.numero,
        cliente: input.cliente,
        descricaoCurta: input.descricaoCurta,
        m2: input.m2,
        valorVenda: input.valorVenda,
        segmento: input.segmento,
        estrategico: input.estrategico,
        tipo: input.tipo,
        probabilidade: input.probabilidade,
        status: input.status,
        categoria: input.status ? categoriaFromStatus(input.status) : undefined,
        dataInicio: input.dataInicio,
        dataFim: input.dataFim,
        dataEntrega: input.dataEntrega,
        responsavelId: input.responsavelId,
        observacoes: input.observacoes,
        changeOrderDe: input.changeOrderDe,
      },
      include: {
        ...INCLUDE_BASE,
        historico: { orderBy: { alteradoEm: 'desc' }, take: 50 },
      },
    }),
    ...(histEntries.length > 0
      ? [prisma.orcamentoHistorico.createMany({ data: histEntries })]
      : []),
  ]);

  return updated;
}

export async function remove(id: string) {
  const existing = await prisma.orcamento.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Orçamento');
  await prisma.orcamento.delete({ where: { id } });
}

export async function duplicar(id: string, userId: string) {
  const source = await prisma.orcamento.findUnique({ where: { id } });
  if (!source) throw AppError.notFound('Orçamento');

  // Generate a new número like original + ".1"
  const novoNumero = `${source.numero}x`;

  return prisma.orcamento.create({
    data: {
      numero: novoNumero,
      cliente: source.cliente,
      descricaoCurta: source.descricaoCurta,
      m2: source.m2 ?? undefined,
      valorVenda: source.valorVenda ?? undefined,
      segmento: source.segmento ?? undefined,
      estrategico: source.estrategico,
      status: 'A_INICIAR',
      categoria: 'A_INICIAR',
      responsavelId: source.responsavelId ?? undefined,
      observacoes: source.observacoes ?? undefined,
      createdById: userId,
    },
    include: INCLUDE_BASE,
  });
}

export async function stats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [pipeline, emProducao, entreguesNoMes, ganhos90d, perdidos90d] = await Promise.all([
    prisma.orcamento.aggregate({
      where: { status: { in: ['ENVIADO', 'AGUARDANDO', 'APROVADO'] } },
      _sum: { valorVenda: true },
      _count: true,
    }),
    prisma.orcamento.count({ where: { status: 'PRODUZINDO' } }),
    prisma.orcamento.count({
      where: { status: 'ENTREGUE', dataEntrega: { gte: startOfMonth } },
    }),
    prisma.orcamento.count({
      where: { status: 'APROVADO', updatedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.orcamento.count({
      where: { status: { in: ['DECLINADO', 'NO_GO'] }, updatedAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  const total90d = ganhos90d + perdidos90d;
  const winRate = total90d > 0 ? Math.round((ganhos90d / total90d) * 100) : null;

  const byStatus = await prisma.orcamento.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  const bySegmento = await prisma.orcamento.groupBy({
    by: ['segmento'],
    _count: { id: true },
    _sum: { valorVenda: true },
    where: { segmento: { not: null } },
  });

  return {
    pipeline: {
      valor: pipeline._sum.valorVenda ?? 0,
      count: pipeline._count,
    },
    emProducao,
    entreguesNoMes,
    winRate,
    byStatus,
    bySegmento,
  };
}
