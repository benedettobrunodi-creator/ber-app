import { prisma } from '../../config/database';
import {
  CreateEmpresaInput, UpdateEmpresaInput,
  CreateContatoInput, UpdateContatoInput,
  CreateOportunidadeInput, UpdateOportunidadeInput,
  CreateAtividadeInput, UpdateAtividadeInput,
  UpsertMetasAnuaisInput,
  CRM_PROBABILIDADE_PCT, CRM_ETAPA_MACRO,
} from './types';

// ── Empresas ─────────────────────────────────────────────────────────────────

export async function listEmpresas(opts: {
  nutricao?: boolean;
  segmento?: string;
  search?: string;
}) {
  const where: Record<string, unknown> = {};
  if (opts.nutricao !== undefined) where.nutricao = opts.nutricao;
  if (opts.segmento) where.segmento = opts.segmento;
  if (opts.search) {
    where.OR = [
      { razaoSocial: { contains: opts.search, mode: 'insensitive' } },
      { cnpj: { contains: opts.search } },
      { cidade: { contains: opts.search, mode: 'insensitive' } },
    ];
  }
  return prisma.crmEmpresa.findMany({
    where,
    orderBy: { razaoSocial: 'asc' },
    include: {
      contatos: { where: { principal: true }, take: 1 },
      _count: { select: { oportunidades: true } },
    },
  });
}

export async function getEmpresaById(id: string) {
  return prisma.crmEmpresa.findUnique({
    where: { id },
    include: {
      contatos: { orderBy: [{ principal: 'desc' }, { nome: 'asc' }] },
      oportunidades: {
        orderBy: { createdAt: 'desc' },
        include: { responsavel: { select: { id: true, name: true } } },
      },
    },
  });
}

export async function createEmpresa(data: CreateEmpresaInput) {
  return prisma.crmEmpresa.create({ data });
}

export async function updateEmpresa(id: string, data: UpdateEmpresaInput) {
  if ('nutricao' in data && data.nutricao === false) {
    (data as Record<string, unknown>).ultimoContato = new Date();
  }
  return prisma.crmEmpresa.update({ where: { id }, data });
}

export async function deleteEmpresa(id: string) {
  return prisma.crmEmpresa.delete({ where: { id } });
}

// ── Contatos ─────────────────────────────────────────────────────────────────

export async function listContatos(empresaId?: string) {
  return prisma.crmContato.findMany({
    where: empresaId ? { empresaId } : undefined,
    orderBy: [{ principal: 'desc' }, { nome: 'asc' }],
  });
}

export async function createContato(data: CreateContatoInput) {
  return prisma.crmContato.create({ data });
}

export async function updateContato(id: string, data: UpdateContatoInput) {
  return prisma.crmContato.update({ where: { id }, data });
}

export async function deleteContato(id: string) {
  return prisma.crmContato.delete({ where: { id } });
}

// ── Oportunidades ─────────────────────────────────────────────────────────────

export async function listOportunidades(opts: {
  etapa?: string;
  responsavelId?: string;
  empresaId?: string;
  origem?: string;
  search?: string;
}) {
  const where: Record<string, unknown> = {};
  if (opts.etapa) where.etapa = opts.etapa;
  if (opts.responsavelId) where.responsavelId = opts.responsavelId;
  if (opts.empresaId) where.empresaId = opts.empresaId;
  if (opts.origem) where.origem = opts.origem;
  if (opts.search) {
    where.OR = [
      { titulo: { contains: opts.search, mode: 'insensitive' } },
      { empresa: { razaoSocial: { contains: opts.search, mode: 'insensitive' } } },
    ];
  }
  return prisma.crmOportunidade.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      empresa: { select: { id: true, razaoSocial: true, segmento: true } },
      contato: { select: { id: true, nome: true, cargo: true } },
      responsavel: { select: { id: true, name: true, avatarUrl: true } },
      atividades: {
        where: { concluida: false },
        orderBy: { dataHora: 'asc' },
        take: 1,
      },
      orcamento: { select: { id: true, numero: true, status: true, valorVenda: true, m2: true, cliente: true } },
    },
  });
}

export async function getOportunidadeById(id: string) {
  return prisma.crmOportunidade.findUnique({
    where: { id },
    include: {
      empresa: true,
      contato: true,
      responsavel: { select: { id: true, name: true, avatarUrl: true } },
      atividades: { orderBy: { dataHora: 'desc' } },
      historico: { orderBy: { alteradoEm: 'desc' }, take: 30 },
      orcamento: {
        select: {
          id: true, numero: true, status: true, valorVenda: true, m2: true, cliente: true,
          obra: { select: { id: true, name: true, status: true, fase: true } },
        },
      },
    },
  });
}

export async function createOportunidade(data: CreateOportunidadeInput, userId: string, userName: string) {
  const oport = await prisma.crmOportunidade.create({
    data: {
      ...data,
      dataEntradaPipeline: data.dataEntradaPipeline ?? new Date(),
      createdById: userId,
    },
  });
  await prisma.crmOportunidadeHistorico.create({
    data: {
      oportunidadeId: oport.id,
      campo: 'criacao',
      valorNovo: oport.etapa,
      alteradoPor: userName,
    },
  });
  return oport;
}

export async function updateOportunidade(
  id: string,
  data: UpdateOportunidadeInput,
  userName: string,
) {
  const anterior = await prisma.crmOportunidade.findUniqueOrThrow({ where: { id } });
  const updated = await prisma.crmOportunidade.update({ where: { id }, data });

  const campos = Object.keys(data) as Array<keyof UpdateOportunidadeInput>;
  const historico = campos
    .filter((k) => String((anterior as Record<string, unknown>)[k]) !== String((updated as Record<string, unknown>)[k]))
    .map((campo) => ({
      oportunidadeId: id,
      campo,
      valorAntigo: String((anterior as Record<string, unknown>)[campo] ?? ''),
      valorNovo: String((updated as Record<string, unknown>)[campo] ?? ''),
      alteradoPor: userName,
    }));

  if (historico.length) {
    await prisma.crmOportunidadeHistorico.createMany({ data: historico });
  }

  // Atualiza ultimo_contato na empresa quando etapa muda
  if (data.etapa && data.etapa !== anterior.etapa && anterior.empresaId) {
    await prisma.crmEmpresa.update({
      where: { id: anterior.empresaId },
      data: { ultimoContato: new Date() },
    });
  }

  return updated;
}

export async function deleteOportunidade(id: string) {
  return prisma.crmOportunidade.delete({ where: { id } });
}

// ── Atividades ────────────────────────────────────────────────────────────────

export async function listAtividades(opts: {
  oportunidadeId?: string;
  empresaId?: string;
  usuarioId?: string;
  concluida?: boolean;
  de?: string;
  ate?: string;
}) {
  const where: Record<string, unknown> = {};
  if (opts.oportunidadeId) where.oportunidadeId = opts.oportunidadeId;
  if (opts.empresaId) where.empresaId = opts.empresaId;
  if (opts.usuarioId) where.usuarioId = opts.usuarioId;
  if (opts.concluida !== undefined) where.concluida = opts.concluida;
  if (opts.de || opts.ate) {
    where.dataHora = {
      ...(opts.de ? { gte: new Date(opts.de) } : {}),
      ...(opts.ate ? { lte: new Date(opts.ate) } : {}),
    };
  }
  return prisma.crmAtividade.findMany({
    where,
    orderBy: { dataHora: 'desc' },
    include: {
      oportunidade: { select: { id: true, titulo: true, empresa: { select: { razaoSocial: true } } } },
      usuario: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function createAtividade(data: CreateAtividadeInput, usuarioId: string) {
  const atividade = await prisma.crmAtividade.create({
    data: { ...data, usuarioId },
  });
  // Atualiza ultimoContato na empresa
  const empresaId = data.empresaId ?? (
    data.oportunidadeId
      ? (await prisma.crmOportunidade.findUnique({ where: { id: data.oportunidadeId } }))?.empresaId
      : null
  );
  if (empresaId) {
    await prisma.crmEmpresa.update({ where: { id: empresaId }, data: { ultimoContato: new Date() } });
  }
  return atividade;
}

export async function updateAtividade(id: string, data: UpdateAtividadeInput) {
  return prisma.crmAtividade.update({ where: { id }, data });
}

export async function deleteAtividade(id: string) {
  return prisma.crmAtividade.delete({ where: { id } });
}

// ── Metas ─────────────────────────────────────────────────────────────────────

export async function getMetasAno(ano: number) {
  return prisma.crmMetaVendas.findMany({
    where: { ano },
    orderBy: { mes: 'asc' },
  });
}

export async function upsertMetasAnuais(input: UpsertMetasAnuaisInput) {
  const ops = input.metas.map((m) =>
    prisma.crmMetaVendas.upsert({
      where: { ano_mes: { ano: input.ano, mes: m.mes } },
      create: { ano: input.ano, mes: m.mes, valorMeta: m.valorMeta },
      update: { valorMeta: m.valorMeta },
    }),
  );
  return prisma.$transaction(ops);
}

// ── Stats / Relatórios ────────────────────────────────────────────────────────

export async function getPipelineStats() {
  const oportunidades = await prisma.crmOportunidade.findMany({
    where: { etapa: { notIn: ['perdido'] } },
    select: { etapa: true, valor: true, probabilidade: true, origem: true },
  });

  const porEtapa: Record<string, { count: number; valor: number }> = {};
  const porOrigem: Record<string, { count: number; valor: number }> = {};

  let forecastTotal = 0;

  for (const op of oportunidades) {
    const etapa = op.etapa;
    porEtapa[etapa] ??= { count: 0, valor: 0 };
    porEtapa[etapa].count++;
    porEtapa[etapa].valor += Number(op.valor ?? 0);

    const origem = op.origem ?? 'sem_origem';
    porOrigem[origem] ??= { count: 0, valor: 0 };
    porOrigem[origem].count++;
    porOrigem[origem].valor += Number(op.valor ?? 0);

    const pct = CRM_PROBABILIDADE_PCT[(op.probabilidade as keyof typeof CRM_PROBABILIDADE_PCT) ?? 'media'] ?? 0.5;
    forecastTotal += Number(op.valor ?? 0) * pct;
  }

  return { porEtapa, porOrigem, forecastTotal, total: oportunidades.length };
}

export async function getFunilMacro() {
  const all = await prisma.crmOportunidade.findMany({
    select: { etapa: true, valor: true },
  });

  const macro: Record<string, { count: number; valor: number }> = {
    qualificacao: { count: 0, valor: 0 },
    propostas: { count: 0, valor: 0 },
    conversao: { count: 0, valor: 0 },
    perdido: { count: 0, valor: 0 },
  };

  for (const op of all) {
    const bucket = CRM_ETAPA_MACRO[op.etapa as keyof typeof CRM_ETAPA_MACRO] ?? 'qualificacao';
    macro[bucket].count++;
    macro[bucket].valor += Number(op.valor ?? 0);
  }

  return macro;
}

export async function getForecast(ano: number) {
  const oportunidades = await prisma.crmOportunidade.findMany({
    where: {
      etapa: { notIn: ['perdido'] },
      dataFechamentoPrevisto: {
        gte: new Date(`${ano}-01-01`),
        lte: new Date(`${ano}-12-31`),
      },
    },
    select: { dataFechamentoPrevisto: true, valor: true, probabilidade: true },
  });

  const porMes: Record<number, { esperado: number; ponderado: number }> = {};
  for (let m = 1; m <= 12; m++) porMes[m] = { esperado: 0, ponderado: 0 };

  for (const op of oportunidades) {
    if (!op.dataFechamentoPrevisto) continue;
    const mes = op.dataFechamentoPrevisto.getMonth() + 1;
    const val = Number(op.valor ?? 0);
    const pct = CRM_PROBABILIDADE_PCT[(op.probabilidade as keyof typeof CRM_PROBABILIDADE_PCT) ?? 'media'] ?? 0.5;
    porMes[mes].esperado += val;
    porMes[mes].ponderado += val * pct;
  }

  return porMes;
}

export async function getVendasVsMeta(ano: number) {
  const metas = await prisma.crmMetaVendas.findMany({
    where: { ano },
    orderBy: { mes: 'asc' },
  });

  const ganhas = await prisma.crmOportunidade.findMany({
    where: {
      etapa: 'ganho',
      updatedAt: { gte: new Date(`${ano}-01-01`), lte: new Date(`${ano}-12-31`) },
    },
    select: { updatedAt: true, valor: true },
  });

  const realizadoPorMes: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) realizadoPorMes[m] = 0;
  for (const op of ganhas) {
    const mes = op.updatedAt.getMonth() + 1;
    realizadoPorMes[mes] += Number(op.valor ?? 0);
  }

  const resultado = [];
  let metaAcum = 0;
  let realizadoAcum = 0;
  for (let m = 1; m <= 12; m++) {
    const meta = Number(metas.find((x) => x.mes === m)?.valorMeta ?? 0);
    const realizado = realizadoPorMes[m];
    metaAcum += meta;
    realizadoAcum += realizado;
    resultado.push({ mes: m, meta, realizado, metaAcum, realizadoAcum });
  }

  return resultado;
}

export async function getPipelineMesAMes(ano: number) {
  const oportunidades = await prisma.crmOportunidade.findMany({
    where: {
      dataEntradaPipeline: {
        gte: new Date(`${ano}-01-01`),
        lte: new Date(`${ano}-12-31`),
      },
    },
    select: { dataEntradaPipeline: true, valor: true, origem: true },
  });

  const porMes: Record<number, Record<string, number>> = {};
  for (let m = 1; m <= 12; m++) porMes[m] = {};

  for (const op of oportunidades) {
    if (!op.dataEntradaPipeline) continue;
    const mes = op.dataEntradaPipeline.getMonth() + 1;
    const origem = op.origem ?? 'sem_origem';
    porMes[mes][origem] = (porMes[mes][origem] ?? 0) + Number(op.valor ?? 0);
  }

  return porMes;
}

export async function getTicketMedio(opts: { ano?: number; segmento?: string; origem?: string }) {
  const where: Record<string, unknown> = { etapa: 'ganho', valor: { not: null } };
  if (opts.origem) where.origem = opts.origem;
  if (opts.ano) {
    where.updatedAt = {
      gte: new Date(`${opts.ano}-01-01`),
      lte: new Date(`${opts.ano}-12-31`),
    };
  }
  const ganhas = await prisma.crmOportunidade.findMany({
    where,
    select: { valor: true, origem: true, updatedAt: true },
  });

  if (!ganhas.length) return { geral: 0, porOrigem: {} };

  const total = ganhas.reduce((s, op) => s + Number(op.valor ?? 0), 0);

  const porOrigem: Record<string, { soma: number; count: number }> = {};
  for (const op of ganhas) {
    const o = op.origem ?? 'sem_origem';
    porOrigem[o] ??= { soma: 0, count: 0 };
    porOrigem[o].soma += Number(op.valor ?? 0);
    porOrigem[o].count++;
  }

  return {
    geral: total / ganhas.length,
    porOrigem: Object.fromEntries(
      Object.entries(porOrigem).map(([k, v]) => [k, v.soma / v.count]),
    ),
  };
}

export async function getWinRate(opts: { ano?: number; responsavelId?: string }) {
  const where: Record<string, unknown> = {};
  if (opts.responsavelId) where.responsavelId = opts.responsavelId;
  if (opts.ano) {
    where.updatedAt = {
      gte: new Date(`${opts.ano}-01-01`),
      lte: new Date(`${opts.ano}-12-31`),
    };
  }
  const [ganho, perdido] = await Promise.all([
    prisma.crmOportunidade.count({ where: { ...where, etapa: 'ganho' } }),
    prisma.crmOportunidade.count({ where: { ...where, etapa: 'perdido' } }),
  ]);
  const total = ganho + perdido;
  return { ganho, perdido, total, rate: total > 0 ? ganho / total : 0 };
}

export async function getNutricao() {
  const empresas = await prisma.crmEmpresa.findMany({
    where: { nutricao: true },
    orderBy: { ultimoContato: 'asc' },
    include: {
      contatos: { where: { principal: true }, take: 1 },
      _count: { select: { oportunidades: true } },
    },
  });

  const hoje = new Date();
  return empresas.map((e) => ({
    ...e,
    diasSemContato: e.ultimoContato
      ? Math.floor((hoje.getTime() - e.ultimoContato.getTime()) / 86_400_000)
      : null,
  }));
}
