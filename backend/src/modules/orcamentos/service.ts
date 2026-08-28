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

  const rows = await prisma.orcamento.findMany({
    where,
    include: INCLUDE_BASE,
    orderBy: [{ categoria: 'asc' }, { ordem: 'asc' }, { dataInicio: 'asc' }],
  });
  const revisoes = await revisoesPorOrcamento(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, revisoes: revisoes.get(r.id) ?? 0 }));
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
    orderBy: [{ categoria: 'asc' }, { ordem: 'asc' }, { dataInicio: 'asc' }],
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
  'm2', 'descricaoCurta', 'dataEntrega',
];

// ─── Revisões (definição Bruno 28/08/26) ──────────────────────────────────
// Revisão = alteração de CONTEÚDO da proposta: valor de venda, m², escopo
// (descrição) ou data de entrega. Datas de planejamento da esteira
// (dataInicio/dataFim) e trocas de status/responsável NÃO contam.
// Alterações do mesmo dia (BRT) agrupam numa única revisão.
export const REVISAO_FIELDS = ['valorVenda', 'm2', 'descricaoCurta', 'dataEntrega'];
const BRT_MS = 3 * 60 * 60 * 1000;
const diaBrt = (d: Date) => new Date(d.getTime() - BRT_MS).toISOString().slice(0, 10);

/** Mapa orcamentoId → nº de revisões (dias distintos com mudança de conteúdo). */
export async function revisoesPorOrcamento(orcamentoIds?: string[]): Promise<Map<string, number>> {
  const hist = await prisma.orcamentoHistorico.findMany({
    where: {
      campo: { in: REVISAO_FIELDS },
      ...(orcamentoIds ? { orcamentoId: { in: orcamentoIds } } : {}),
    },
    select: { orcamentoId: true, alteradoEm: true },
  });
  const dias = new Map<string, Set<string>>();
  for (const h of hist) {
    const set = dias.get(h.orcamentoId) ?? new Set<string>();
    set.add(diaBrt(h.alteradoEm));
    dias.set(h.orcamentoId, set);
  }
  return new Map([...dias.entries()].map(([id, set]) => [id, set.size]));
}

/** Painel de esforço da esteira: propostas criadas, revisões e visão por responsável. */
export async function esforco(ano: number, mes: number | null) {
  const inicio = mes ? new Date(Date.UTC(ano, mes - 1, 1)) : new Date(Date.UTC(ano, 0, 1));
  const fim = mes ? new Date(Date.UTC(ano, mes, 1)) : new Date(Date.UTC(ano + 1, 0, 1));

  const [criadas, hist, orcs] = await Promise.all([
    prisma.orcamento.count({ where: { createdAt: { gte: inicio, lt: fim } } }),
    prisma.orcamentoHistorico.findMany({
      where: { alteradoEm: { gte: inicio, lt: fim } },
      select: { orcamentoId: true, campo: true, alteradoPor: true, alteradoEm: true },
    }),
    prisma.orcamento.findMany({ select: { id: true, numero: true, cliente: true } }),
  ]);
  const orcById = new Map(orcs.map((o) => [o.id, o]));

  // Revisões do período: dias distintos (orc × dia) com mudança de conteúdo
  const revDias = new Map<string, Set<string>>(); // orcId → dias
  const porPessoa = new Map<string, { revDias: Set<string>; orcs: Set<string>; diasAtivos: Set<string> }>();
  for (const h of hist) {
    const dia = diaBrt(h.alteradoEm);
    const pessoa = porPessoa.get(h.alteradoPor) ?? { revDias: new Set(), orcs: new Set(), diasAtivos: new Set() };
    pessoa.orcs.add(h.orcamentoId);
    pessoa.diasAtivos.add(dia);
    if (REVISAO_FIELDS.includes(h.campo)) {
      const set = revDias.get(h.orcamentoId) ?? new Set<string>();
      set.add(dia);
      revDias.set(h.orcamentoId, set);
      pessoa.revDias.add(`${h.orcamentoId}:${dia}`);
    }
    porPessoa.set(h.alteradoPor, pessoa);
  }
  const revisoesNoPeriodo = [...revDias.values()].reduce((s, set) => s + set.size, 0);

  const topRetrabalho = [...revDias.entries()]
    .map(([id, set]) => ({
      numero: orcById.get(id)?.numero ?? '?',
      cliente: orcById.get(id)?.cliente ?? '?',
      revisoes: set.size,
    }))
    .sort((a, b) => b.revisoes - a.revisoes)
    .slice(0, 10);

  const porResponsavel = [...porPessoa.entries()]
    .map(([nome, p]) => ({
      nome,
      propostasTocadas: p.orcs.size,
      revisoes: p.revDias.size,
      diasAtivos: p.diasAtivos.size,
    }))
    .sort((a, b) => b.revisoes - a.revisoes);

  return { periodo: { ano, mes }, propostasCriadas: criadas, revisoesNoPeriodo, topRetrabalho, porResponsavel };
}

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

export async function reorder(ids: string[]) {
  await prisma.$transaction(
    ids.map((id, index) => prisma.orcamento.update({ where: { id }, data: { ordem: index } }))
  );
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
      where: { status: { in: ['DECLINADO', 'NO_GO', 'CANCELADO', 'PERDIDO'] }, updatedAt: { gte: thirtyDaysAgo } },
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

// Status considerados "enviados" (efetivamente entregues ao cliente).
const ENVIADOS_STATUSES = ['ENVIADO', 'AGUARDANDO', 'APROVADO', 'ENTREGUE'];

/** Produtividade dos orçamentistas: nº de orçamentos produzidos por responsável,
 *  quebrado por tipo (Novos / Revisões / Change Orders). Período pela data de
 *  entrega (fallback: data de criação). `enviadosOnly` filtra só os enviados. */
export async function produtividadeOrcamentistas(ano: number, mes: number | null, enviadosOnly: boolean) {
  const rows = await prisma.orcamento.findMany({
    where: enviadosOnly ? { status: { in: ENVIADOS_STATUSES } } : {},
    select: {
      tipo: true,
      dataEntrega: true,
      createdAt: true,
      responsavelId: true,
      responsavel: { select: { id: true, name: true } },
    },
  });

  const start = Date.UTC(ano, mes ? mes - 1 : 0, 1);
  const end = mes ? Date.UTC(ano, mes, 1) : Date.UTC(ano + 1, 0, 1);

  type Row = { responsavelId: string | null; nome: string; novos: number; revisoes: number; changeOrders: number; total: number };
  const map = new Map<string, Row>();
  for (const o of rows) {
    const anchor = (o.dataEntrega ?? o.createdAt).getTime();
    if (anchor < start || anchor >= end) continue;
    const key = o.responsavelId ?? 'sem';
    const e = map.get(key) ?? { responsavelId: o.responsavelId, nome: o.responsavel?.name ?? 'Sem responsável', novos: 0, revisoes: 0, changeOrders: 0, total: 0 };
    if (o.tipo === 'REVISAO') e.revisoes++;
    else if (o.tipo === 'CHANGE_ORDER') e.changeOrders++;
    else e.novos++;
    e.total++;
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}
