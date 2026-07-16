import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import {
  CreateEmpresaInput, UpdateEmpresaInput,
  CreateContatoInput, UpdateContatoInput,
  CreateOportunidadeInput, UpdateOportunidadeInput,
  CreateAtividadeInput, UpdateAtividadeInput,
  UpsertMetasAnuaisInput,
  CRM_PROBABILIDADE_PCT, CRM_ETAPA_MACRO,
  CreateCampanhaInput, UpdateCampanhaInput,
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
  await prisma.crmContato.deleteMany({ where: { empresaId: id } });
  return prisma.crmEmpresa.delete({ where: { id } });
}

// ── Contatos ─────────────────────────────────────────────────────────────────

export async function listContatos(opts?: { empresaId?: string; search?: string }) {
  const where: Record<string, unknown> = {};
  if (opts?.empresaId) where.empresaId = opts.empresaId;
  if (opts?.search) {
    const q = opts.search;
    where.OR = [
      { nome: { contains: q, mode: 'insensitive' } },
      { cargo: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { empresa: { razaoSocial: { contains: q, mode: 'insensitive' } } },
    ];
  }
  return prisma.crmContato.findMany({
    where,
    orderBy: [{ principal: 'desc' }, { nome: 'asc' }],
    include: { empresa: { select: { id: true, razaoSocial: true, segmento: true, classificacao: true } } },
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

export async function listNutricao() {
  return prisma.crmContato.findMany({
    where: { nutricao: true },
    include: {
      empresa: { select: { id: true, razaoSocial: true, segmento: true, classificacao: true } },
    },
    orderBy: [{ proximoContato: 'asc' }, { ultimoContato: 'asc' }, { nome: 'asc' }],
  });
}

export async function getContatoHistorico(contatoId: string) {
  const contato = await prisma.crmContato.findUnique({
    where: { id: contatoId },
    select: { empresaId: true },
  });

  const [atividades, oportunidades] = await Promise.all([
    prisma.crmAtividade.findMany({
      where: { empresaId: contato?.empresaId ?? undefined },
      orderBy: { dataHora: 'desc' },
      take: 20,
      select: {
        id: true, tipo: true, dataHora: true, notas: true,
        resultado: true, concluida: true,
        usuario: { select: { id: true, name: true } },
      },
    }),
    prisma.crmOportunidade.findMany({
      where: {
        OR: [
          { contatoId },
          ...(contato?.empresaId ? [{ empresaId: contato.empresaId }] : []),
        ],
        etapa: { notIn: ['ganho', 'perdido', 'declinado', 'cancelado'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, titulo: true, etapa: true, valor: true,
        dataFechamentoPrevisto: true, createdAt: true,
        responsavel: { select: { id: true, name: true } },
      },
    }),
  ]);

  return { atividades, oportunidades };
}

export async function getNutricaoAgenda() {
  const now = new Date();
  const endOf7Days = new Date(now.getTime() + 7 * 86_400_000);

  const contatos = await prisma.crmContato.findMany({
    where: { nutricao: true },
    include: {
      empresa: { select: { id: true, razaoSocial: true, segmento: true, classificacao: true } },
    },
    orderBy: [{ proximoContato: 'asc' }, { nome: 'asc' }],
  });

  const isToday = (d: Date) => d.toDateString() === now.toDateString();

  const vencidos   = contatos.filter(c => c.proximoContato && c.proximoContato < now && !isToday(c.proximoContato));
  const hoje       = contatos.filter(c => c.proximoContato && isToday(c.proximoContato));
  const proximos7  = contatos.filter(c => c.proximoContato && c.proximoContato > now && c.proximoContato <= endOf7Days);
  const semData    = contatos.filter(c => !c.proximoContato);

  return { vencidos, hoje, proximos7, semData, total: contatos.length };
}

export async function registrarInteracao(
  id: string,
  usuarioId: string,
  data: {
    tipo: string;
    notas?: string | null;
    resultado?: string | null;
    proximoContato?: string | null;
    notasRelacionamento?: string | null;
    tags?: string[];
  },
) {
  const now = new Date();
  const contato = await prisma.crmContato.findUnique({ where: { id }, select: { empresaId: true } });

  const contatoUpdate: Record<string, unknown> = { ultimoContato: now };
  if (data.proximoContato !== undefined)
    contatoUpdate.proximoContato = data.proximoContato ? new Date(data.proximoContato) : null;
  if (data.notasRelacionamento !== undefined) contatoUpdate.notasRelacionamento = data.notasRelacionamento;
  if (data.tags !== undefined) contatoUpdate.tags = data.tags;

  const [atividade] = await Promise.all([
    prisma.crmAtividade.create({
      data: {
        empresaId: contato?.empresaId ?? undefined,
        tipo: data.tipo,
        dataHora: now,
        notas: data.notas ?? null,
        resultado: data.resultado ?? null,
        concluida: true,
        usuarioId,
      },
    }),
    prisma.crmContato.update({ where: { id }, data: contatoUpdate }),
    contato?.empresaId
      ? prisma.crmEmpresa.update({ where: { id: contato.empresaId }, data: { ultimoContato: now } })
      : Promise.resolve(null),
  ]);

  return {
    atividade,
    proximoContato: data.proximoContato ?? null,
    ultimoContato: now.toISOString(),
  };
}

export async function contatarAgora(id: string, usuarioId: string, tipo: string, notas?: string) {
  const now = new Date();
  const contato = await prisma.crmContato.findUnique({ where: { id }, select: { empresaId: true } });
  const [atividade] = await Promise.all([
    prisma.crmAtividade.create({
      data: {
        empresaId: contato?.empresaId ?? undefined,
        tipo,
        dataHora: now,
        notas: notas ?? null,
        concluida: true,
        usuarioId,
        resultado: `Contato registrado via Nutrição`,
      },
    }).catch(() => null),
    prisma.crmContato.update({ where: { id }, data: { ultimoContato: now } }),
    contato?.empresaId
      ? prisma.crmEmpresa.update({ where: { id: contato.empresaId }, data: { ultimoContato: now } })
      : Promise.resolve(null),
  ]);
  return atividade;
}

// ── Campanhas ─────────────────────────────────────────────────────────────────

const campanhaInclude = {
  responsavel: { select: { id: true, name: true, avatarUrl: true } },
  _count: { select: { contatos: true } },
} as const;

export async function listCampanhas() {
  return prisma.crmCampanha.findMany({
    include: campanhaInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCampanha(id: string) {
  return prisma.crmCampanha.findUnique({
    where: { id },
    include: {
      responsavel: { select: { id: true, name: true, avatarUrl: true } },
      contatos: {
        include: {
          contato: {
            include: { empresa: { select: { id: true, razaoSocial: true, segmento: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

export async function createCampanha(data: CreateCampanhaInput) {
  return prisma.crmCampanha.create({ data, include: campanhaInclude });
}

export async function updateCampanha(id: string, data: UpdateCampanhaInput) {
  return prisma.crmCampanha.update({ where: { id }, data, include: campanhaInclude });
}

export async function deleteCampanha(id: string) {
  return prisma.crmCampanha.delete({ where: { id } });
}

export async function addContatosCampanha(campanhaId: string, contatoIds: string[]) {
  await prisma.crmCampanhaContato.createMany({
    data: contatoIds.map((contatoId) => ({ campanhaId, contatoId })),
    skipDuplicates: true,
  });
  return getCampanha(campanhaId);
}

export async function updateCampanhaContato(
  campanhaId: string,
  contatoId: string,
  data: { status?: string; notas?: string | null; contatadoEm?: string | null },
) {
  const contatadoEm = data.contatadoEm ? new Date(data.contatadoEm) : data.contatadoEm === null ? null : undefined;
  const updateData: Prisma.CrmCampanhaContatoUpdateInput = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.notas !== undefined) updateData.notas = data.notas;
  if (contatadoEm !== undefined) updateData.contatadoEm = contatadoEm;

  const updated = await prisma.crmCampanhaContato.update({
    where: { campanhaId_contatoId: { campanhaId, contatoId } },
    data: updateData,
  });
  if (data.status === 'enviado' || data.status === 'respondeu') {
    await prisma.crmContato.update({ where: { id: contatoId }, data: { ultimoContato: new Date() } })
      .catch(() => null);
  }
  return updated;
}

export async function bulkUpdateCampanhaStatus(
  campanhaId: string,
  contatoIds: string[],
  status: string,
) {
  const updated = await prisma.crmCampanhaContato.updateMany({
    where: { campanhaId, contatoId: { in: contatoIds } },
    data: { status },
  });
  if (status === 'enviado' || status === 'respondeu') {
    await prisma.crmContato.updateMany({
      where: { id: { in: contatoIds } },
      data: { ultimoContato: new Date() },
    }).catch(() => null);
  }
  return { updated: updated.count };
}

export async function removeContatoCampanha(campanhaId: string, contatoId: string) {
  return prisma.crmCampanhaContato.delete({
    where: { campanhaId_contatoId: { campanhaId, contatoId } },
  });
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
    // Ordem manual primeiro (nulls por último), depois updatedAt como fallback.
    orderBy: [{ ordem: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
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
      obra: { select: { id: true, name: true, status: true, fase: true } },
    },
  });
}

/** Reordena oportunidades numa etapa (kanban drag & drop).
 *  Recebe a lista completa de ids na ordem final desejada e opcionalmente
 *  atualiza a etapa dos cards (útil quando o drop veio de outra coluna). */
export async function reorderOportunidades(input: { ids: string[]; etapa?: string }) {
  await prisma.$transaction(
    input.ids.map((id, idx) =>
      prisma.crmOportunidade.update({
        where: { id },
        data: {
          ordem: (idx + 1) * 1000,
          ...(input.etapa ? { etapa: input.etapa } : {}),
        },
      }),
    ),
  );
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
      obra: { select: { id: true, name: true, status: true, fase: true } },
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

  // Seta dataGanho automaticamente quando etapa muda para 'ganho' (se não foi passado manualmente)
  const dataWrite = { ...data } as Record<string, unknown>;
  if (data.etapa === 'ganho' && anterior.etapa !== 'ganho' && !data.dataGanho) {
    dataWrite.dataGanho = new Date();
  } else if (data.etapa && data.etapa !== 'ganho' && anterior.etapa === 'ganho' && !data.dataGanho) {
    dataWrite.dataGanho = null;
  }

  const updated = await prisma.crmOportunidade.update({ where: { id }, data: dataWrite });

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
  return prisma.crmAtividade.update({
    where: { id },
    data,
    include: { usuario: { select: { id: true, name: true, avatarUrl: true } } },
  });
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
    where: { etapa: { notIn: ['perdido', 'declinado', 'cancelado'] } },
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

  // Para taxa de conversão de proposta: apenas etapas onde a proposta foi emitida
  // (proposta_enviada + negociacao + ganho + perdido competitivo)
  let valorPropostaEmitida = 0;
  let valorGanho = 0;
  let valorPerdidoCompetitivo = 0;
  let countPropostaEmitida = 0;
  let countGanho = 0;
  let countPerdidoCompetitivo = 0;

  for (const op of all) {
    const bucket = CRM_ETAPA_MACRO[op.etapa as keyof typeof CRM_ETAPA_MACRO] ?? 'qualificacao';
    macro[bucket].count++;
    macro[bucket].valor += Number(op.valor ?? 0);

    const val = Number(op.valor ?? 0);
    if (op.etapa === 'ganho') {
      valorGanho += val; countGanho++;
    } else if (op.etapa === 'perdido') {
      valorPerdidoCompetitivo += val; countPerdidoCompetitivo++;
    } else if (op.etapa === 'proposta_enviada' || op.etapa === 'negociacao') {
      valorPropostaEmitida += val; countPropostaEmitida++;
    }
  }

  // Taxa por VALOR — do R$ emitido em proposta, quanto % foi ganho
  const baseValor = valorPropostaEmitida + valorGanho + valorPerdidoCompetitivo;
  const taxaConversaoPropostas = baseValor > 0 ? valorGanho / baseValor : 0;

  // Taxa por QUANTIDADE — dos deals que chegaram a proposta emitida, quantos % foram ganhos
  const baseCount = countPropostaEmitida + countGanho + countPerdidoCompetitivo;
  const taxaConversaoPropostasCount = baseCount > 0 ? countGanho / baseCount : 0;

  return {
    ...macro,
    taxaConversaoPropostas,
    taxaConversaoPropostasCount,
    valorPropostaEmitida,
    valorGanho,
    valorPerdidoCompetitivo,
    countPropostaEmitida,
    countGanho,
    countPerdidoCompetitivo,
  };
}

export async function getForecast(ano: number) {
  const oportunidades = await prisma.crmOportunidade.findMany({
    where: {
      etapa: { notIn: ['perdido', 'declinado', 'cancelado'] },
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
    where: { etapa: 'ganho' },
    select: { valor: true, dataGanho: true, dataFechamentoPrevisto: true, updatedAt: true },
  });

  const realizadoPorMes: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) realizadoPorMes[m] = 0;

  for (const op of ganhas) {
    // dataGanho (real) → dataFechamentoPrevisto → updatedAt
    const ref = op.dataGanho ?? op.dataFechamentoPrevisto ?? op.updatedAt;
    const refAno = ref instanceof Date ? ref.getFullYear() : new Date(ref as any).getFullYear();
    const refMes = ref instanceof Date ? ref.getMonth() + 1 : new Date(ref as any).getMonth() + 1;
    if (refAno !== ano) continue;
    realizadoPorMes[refMes] += Number(op.valor ?? 0);
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

// Mesma lógica do getVendasVsMeta: dataGanho → dataFechamentoPrevisto → updatedAt
function refDateAno(op: { dataGanho: Date | null; dataFechamentoPrevisto: Date | null; updatedAt: Date }): number {
  const ref = op.dataGanho ?? op.dataFechamentoPrevisto ?? op.updatedAt;
  return new Date(ref).getFullYear();
}

export async function getWinRate(opts: { ano?: number; responsavelId?: string }) {
  const base: Record<string, unknown> = {};
  if (opts.responsavelId) base.responsavelId = opts.responsavelId;

  const createdRange = opts.ano ? {
    gte: new Date(`${opts.ano}-01-01T00:00:00.000Z`),
    lt:  new Date(`${opts.ano + 1}-01-01T00:00:00.000Z`),
  } : undefined;

  // Ganhos: busca todos e filtra por refDate (dataGanho ?? dataFechamentoPrevisto ?? updatedAt)
  const todosGanhos = await prisma.crmOportunidade.findMany({
    where: { ...base, etapa: 'ganho' },
    select: { dataGanho: true, dataFechamentoPrevisto: true, updatedAt: true },
  });
  const ganho = opts.ano
    ? todosGanhos.filter(op => refDateAno(op) === opts.ano).length
    : todosGanhos.length;

  // Perdas: createdAt como proxy (sem campo dedicado de data de perda)
  const [perdido, declinado, cancelado] = await Promise.all([
    prisma.crmOportunidade.count({ where: { ...base, etapa: 'perdido', ...(createdRange ? { createdAt: createdRange } : {}) } }),
    prisma.crmOportunidade.count({ where: { ...base, etapa: 'declinado', ...(createdRange ? { createdAt: createdRange } : {}) } }),
    prisma.crmOportunidade.count({ where: { ...base, etapa: 'cancelado', ...(createdRange ? { createdAt: createdRange } : {}) } }),
  ]);

  const total = ganho + perdido;
  return { ganho, perdido, declinado, cancelado, total, rate: total > 0 ? ganho / total : 0 };
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

// ── Novos relatórios ──────────────────────────────────────────────────────────

/**
 * Pipeline ativo por mês — visão de pipeline disponível em cada mês.
 *
 * Para cada mês M, porMes[M] = soma de todos os deals ativos cuja data
 * de fechamento previsto é em M ou DEPOIS. Ou seja, o deal está "em
 * pipeline" nos meses anteriores ao seu fechamento previsto, não depois.
 *
 * Exemplo: deal previsto para junho → aparece nos meses 1-6; em julho
 * ele já deveria ter sido resolvido e NÃO aparece.
 *
 * Quando a data prevista é atualizada, o deal reposiciona automaticamente.
 * Deals sem data ficam em semData (sem posição no gráfico).
 * Deals terminais (ganho/perdido/declinado/cancelado) são excluídos.
 */
export async function getPipelineAtivoAcumulado(ano: number) {
  const ops = await prisma.crmOportunidade.findMany({
    where: {
      etapa: { notIn: ['ganho', 'perdido', 'declinado', 'cancelado'] },
    },
    select: { valor: true, dataFechamentoPrevisto: true, createdAt: true },
  });

  const porMes: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) porMes[m] = 0;
  let semData = 0;

  for (const op of ops) {
    const val = Number(op.valor ?? 0);
    if (val === 0) continue;

    // A deal only enters the pipeline from the month it was created.
    // This prevents newly-added deals from retroactively changing past months.
    const criacao = new Date(op.createdAt);
    const anoCriacao = criacao.getFullYear();
    // First month this deal is visible: if created before this year, month 1; else its actual creation month.
    const mesPrimeiro = anoCriacao < ano ? 1 : anoCriacao === ano ? criacao.getMonth() + 1 : null;
    if (mesPrimeiro === null) continue; // created in a future year, shouldn't exist but guard anyway

    if (!op.dataFechamentoPrevisto) {
      semData += val;
      continue;
    }

    const fechamento = new Date(op.dataFechamentoPrevisto);
    const anoFechamento = fechamento.getFullYear();

    if (anoFechamento < ano) {
      // Previsto para ano anterior e deal ainda aberto — não posiciona
      continue;
    }

    if (anoFechamento > ano) {
      // Fecha em ano futuro: aparece do mês de criação até dezembro
      for (let m = mesPrimeiro; m <= 12; m++) porMes[m] += val;
      continue;
    }

    // Mesmo ano: aparece do mês de criação até o mês de fechamento (inclusive)
    const mesFechamento = fechamento.getMonth() + 1;
    for (let m = mesPrimeiro; m <= mesFechamento; m++) {
      porMes[m] += val;
    }
  }

  return { porMes, semData };
}

/** Funil de conversão: distribuição de todas as oportunidades por etapa */
export async function getFunilConversao(ano?: number) {
  const where: Record<string, unknown> = {};
  if (ano) {
    where.createdAt = {
      gte: new Date(`${ano}-01-01`),
      lte: new Date(`${ano}-12-31`),
    };
  }

  const ops = await prisma.crmOportunidade.findMany({
    where,
    select: { etapa: true, valor: true },
  });

  const ORDEM = ['lead', 'qualificacao', 'proposta_producao', 'proposta_enviada', 'negociacao', 'ganho', 'perdido', 'declinado', 'cancelado'];
  const map: Record<string, { count: number; valor: number }> = {};
  for (const etapa of ORDEM) map[etapa] = { count: 0, valor: 0 };

  for (const op of ops) {
    map[op.etapa] ??= { count: 0, valor: 0 };
    map[op.etapa].count++;
    map[op.etapa].valor += Number(op.valor ?? 0);
  }

  return ORDEM.map((etapa) => ({ etapa, ...map[etapa] }));
}

/** Motivos de perda agrupados com contagem e valor */
export async function getMotivosPerda(ano?: number) {
  const where: Record<string, unknown> = { etapa: 'perdido' };
  if (ano) {
    where.createdAt = {
      gte: new Date(`${ano}-01-01T00:00:00.000Z`),
      lt:  new Date(`${ano + 1}-01-01T00:00:00.000Z`),
    };
  }

  const ops = await prisma.crmOportunidade.findMany({
    where,
    select: { motivoPerda: true, valor: true },
  });

  const map: Record<string, { count: number; valor: number }> = {};
  for (const op of ops) {
    const motivo = op.motivoPerda ?? 'Não informado';
    map[motivo] ??= { count: 0, valor: 0 };
    map[motivo].count++;
    map[motivo].valor += Number(op.valor ?? 0);
  }

  return Object.entries(map)
    .map(([motivo, v]) => ({ motivo, ...v }))
    .sort((a, b) => b.count - a.count);
}

/** Performance por responsável: win rate, ticket médio, valor ganho */
export async function getPerformanceResponsavel(ano?: number) {
  const createdRange = ano ? {
    gte: new Date(`${ano}-01-01T00:00:00.000Z`),
    lt:  new Date(`${ano + 1}-01-01T00:00:00.000Z`),
  } : undefined;

  const [todosGanhos, perdas] = await Promise.all([
    prisma.crmOportunidade.findMany({
      where: { etapa: 'ganho', responsavelId: { not: null } },
      select: { valor: true, dataGanho: true, dataFechamentoPrevisto: true, updatedAt: true, responsavelId: true, responsavel: { select: { id: true, name: true } } },
    }),
    prisma.crmOportunidade.findMany({
      where: {
        etapa: { in: ['perdido', 'declinado', 'cancelado'] },
        responsavelId: { not: null },
        ...(createdRange ? { createdAt: createdRange } : {}),
      },
      select: { responsavelId: true, responsavel: { select: { id: true, name: true } } },
    }),
  ]);
  const ganhos = ano ? todosGanhos.filter(op => refDateAno(op) === ano) : todosGanhos;

  const map: Record<string, { name: string; ganho: number; perdido: number; valorGanho: number }> = {};

  for (const op of ganhos) {
    if (!op.responsavelId || !op.responsavel) continue;
    const id = op.responsavelId;
    map[id] ??= { name: op.responsavel.name, ganho: 0, perdido: 0, valorGanho: 0 };
    map[id].ganho++;
    map[id].valorGanho += Number(op.valor ?? 0);
  }
  for (const op of perdas) {
    if (!op.responsavelId || !op.responsavel) continue;
    const id = op.responsavelId;
    map[id] ??= { name: op.responsavel.name, ganho: 0, perdido: 0, valorGanho: 0 };
    map[id].perdido++;
  }

  return Object.values(map)
    .map((r) => ({
      ...r,
      total: r.ganho + r.perdido,
      winRate: r.ganho + r.perdido > 0 ? r.ganho / (r.ganho + r.perdido) : 0,
      ticketMedio: r.ganho > 0 ? r.valorGanho / r.ganho : 0,
    }))
    .sort((a, b) => b.valorGanho - a.valorGanho);
}

/** Forecast nos próximos 30 / 60 / 90 dias, ponderado por probabilidade */
export async function getForecastHorizonte() {
  const hoje = new Date();
  const d30 = new Date(hoje.getTime() + 30 * 86_400_000);
  const d60 = new Date(hoje.getTime() + 60 * 86_400_000);
  const d90 = new Date(hoje.getTime() + 90 * 86_400_000);

  const ops = await prisma.crmOportunidade.findMany({
    where: {
      etapa: { notIn: ['ganho', 'perdido', 'declinado', 'cancelado'] },
      dataFechamentoPrevisto: { lte: d90 },
    },
    select: {
      id: true,
      titulo: true,
      valor: true,
      probabilidade: true,
      dataFechamentoPrevisto: true,
      empresa: { select: { razaoSocial: true } },
      responsavel: { select: { name: true } },
    },
  });

  const bucket = (limit: Date) => ({ valor: 0, ponderado: 0, count: 0, ops: [] as typeof ops });
  const result = { d30: bucket(d30), d60: bucket(d60), d90: bucket(d90) };

  for (const op of ops) {
    if (!op.dataFechamentoPrevisto) continue;
    const fechamento = new Date(op.dataFechamentoPrevisto);
    const val = Number(op.valor ?? 0);
    const pct = CRM_PROBABILIDADE_PCT[(op.probabilidade as keyof typeof CRM_PROBABILIDADE_PCT) ?? 'media'] ?? 0.5;

    if (fechamento <= d90) { result.d90.valor += val; result.d90.ponderado += val * pct; result.d90.count++; result.d90.ops.push(op); }
    if (fechamento <= d60) { result.d60.valor += val; result.d60.ponderado += val * pct; result.d60.count++; result.d60.ops.push(op); }
    if (fechamento <= d30) { result.d30.valor += val; result.d30.ponderado += val * pct; result.d30.count++; result.d30.ops.push(op); }
  }

  return result;
}

/** Ciclo médio de vendas: dias de createdAt até dataGanho, por origem */
export async function getCicloVendas(ano?: number) {
  const where: Record<string, unknown> = {
    etapa: 'ganho',
    dataGanho: { not: null },
    dataEntradaPipeline: { not: null },
  };
  if (ano) {
    where.dataGanho = {
      not: null,
      gte: new Date(`${ano}-01-01`),
      lte: new Date(`${ano}-12-31`),
    };
  }

  const ops = await prisma.crmOportunidade.findMany({
    where,
    select: {
      dataGanho: true,
      dataEntradaPipeline: true,
      createdAt: true,
      origem: true,
      responsavel: { select: { id: true, name: true } },
    },
  });

  let totalDias = 0;
  let totalCount = 0;
  const porOrigem: Record<string, { soma: number; count: number }> = {};
  const porResponsavel: Record<string, { name: string; soma: number; count: number }> = {};

  for (const op of ops) {
    const inicio = op.dataEntradaPipeline ?? op.createdAt;
    const fim = op.dataGanho!;
    const dias = Math.max(0, Math.floor((new Date(fim).getTime() - new Date(inicio).getTime()) / 86_400_000));

    totalDias += dias;
    totalCount++;

    const origem = op.origem ?? 'sem_origem';
    porOrigem[origem] ??= { soma: 0, count: 0 };
    porOrigem[origem].soma += dias;
    porOrigem[origem].count++;

    if (op.responsavel) {
      const rid = op.responsavel.id;
      porResponsavel[rid] ??= { name: op.responsavel.name, soma: 0, count: 0 };
      porResponsavel[rid].soma += dias;
      porResponsavel[rid].count++;
    }
  }

  return {
    geral: totalCount > 0 ? Math.round(totalDias / totalCount) : 0,
    porOrigem: Object.entries(porOrigem).map(([origem, v]) => ({
      origem,
      diasMedio: Math.round(v.soma / v.count),
      count: v.count,
    })).sort((a, b) => a.diasMedio - b.diasMedio),
    porResponsavel: Object.values(porResponsavel).map((r) => ({
      name: r.name,
      diasMedio: Math.round(r.soma / r.count),
      count: r.count,
    })).sort((a, b) => a.diasMedio - b.diasMedio),
  };
}

/** Win Rate por segmento da empresa */
export async function getWinRateSegmento(ano?: number) {
  const createdRange = ano ? {
    gte: new Date(`${ano}-01-01T00:00:00.000Z`),
    lt:  new Date(`${ano + 1}-01-01T00:00:00.000Z`),
  } : undefined;

  // Ganhos: busca todos e filtra por refDate (dataGanho ?? dataFechamentoPrevisto ?? updatedAt)
  const todosGanhos = await prisma.crmOportunidade.findMany({
    where: { etapa: 'ganho' },
    select: { valor: true, dataGanho: true, dataFechamentoPrevisto: true, updatedAt: true, empresa: { select: { segmento: true } } },
  });
  const ganhos = ano ? todosGanhos.filter(op => refDateAno(op) === ano) : todosGanhos;

  const perdas = await prisma.crmOportunidade.findMany({
    where: {
      etapa: { in: ['perdido', 'declinado', 'cancelado'] },
      ...(createdRange ? { createdAt: createdRange } : {}),
    },
    select: { empresa: { select: { segmento: true } } },
  });

  const map: Record<string, { ganho: number; perdido: number; valorGanho: number }> = {};

  for (const op of ganhos) {
    const segmento = op.empresa?.segmento ?? 'Outros';
    map[segmento] ??= { ganho: 0, perdido: 0, valorGanho: 0 };
    map[segmento].ganho++;
    map[segmento].valorGanho += Number(op.valor ?? 0);
  }
  for (const op of perdas) {
    const segmento = op.empresa?.segmento ?? 'Outros';
    map[segmento] ??= { ganho: 0, perdido: 0, valorGanho: 0 };
    map[segmento].perdido++;
  }

  return Object.entries(map)
    .map(([segmento, v]) => ({
      segmento,
      ganho: v.ganho,
      perdido: v.perdido,
      total: v.ganho + v.perdido,
      winRate: v.ganho + v.perdido > 0 ? v.ganho / (v.ganho + v.perdido) : 0,
      valorGanho: v.valorGanho,
      ticketMedio: v.ganho > 0 ? v.valorGanho / v.ganho : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Pipeline aging: deals ativos sem movimentação há 30+ dias */
export async function getPipelineAging() {
  const hoje = new Date();
  const limiar30 = new Date(hoje.getTime() - 30 * 86_400_000);

  const ops = await prisma.crmOportunidade.findMany({
    where: {
      etapa: { notIn: ['ganho', 'perdido', 'declinado', 'cancelado'] },
      updatedAt: { lte: limiar30 },
    },
    select: {
      id: true,
      titulo: true,
      valor: true,
      etapa: true,
      updatedAt: true,
      empresa: { select: { razaoSocial: true } },
      responsavel: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'asc' },
  });

  return ops.map((op) => ({
    ...op,
    diasSemMovimento: Math.floor((hoje.getTime() - new Date(op.updatedAt).getTime()) / 86_400_000),
  }));
}

/** Recorrência de clientes: empresas com mais de 1 projeto ganho */
export async function getRecorrenciaClientes() {
  const empresas = await prisma.crmEmpresa.findMany({
    where: { oportunidades: { some: { etapa: 'ganho' } } },
    select: {
      id: true,
      razaoSocial: true,
      segmento: true,
      oportunidades: {
        where: { etapa: 'ganho' },
        select: { id: true, titulo: true, valor: true, dataGanho: true },
        orderBy: { dataGanho: 'asc' },
      },
    },
  });

  const recorrentes = empresas.filter((e) => e.oportunidades.length > 1);
  const novos = empresas.filter((e) => e.oportunidades.length === 1);

  return {
    total: empresas.length,
    recorrentes: recorrentes.length,
    novos: novos.length,
    taxa: empresas.length > 0 ? recorrentes.length / empresas.length : 0,
    topRecorrentes: recorrentes
      .sort((a, b) => b.oportunidades.length - a.oportunidades.length)
      .slice(0, 10)
      .map((e) => ({
        id: e.id,
        razaoSocial: e.razaoSocial,
        segmento: e.segmento,
        projetos: e.oportunidades.length,
        valorTotal: e.oportunidades.reduce((s, o) => s + Number(o.valor ?? 0), 0),
      })),
  };
}

/** Cohort de entrada: deals agrupados por mês de criação, com status final */
export async function getCohort(ano: number) {
  const ops = await prisma.crmOportunidade.findMany({
    where: {
      createdAt: {
        gte: new Date(`${ano}-01-01`),
        lte: new Date(`${ano}-12-31`),
      },
    },
    select: { etapa: true, createdAt: true, valor: true },
  });

  const cohort: Record<number, { total: number; ganho: number; perdido: number; emAberto: number; valorGanho: number }> = {};
  for (let m = 1; m <= 12; m++) {
    cohort[m] = { total: 0, ganho: 0, perdido: 0, emAberto: 0, valorGanho: 0 };
  }

  for (const op of ops) {
    const mes = new Date(op.createdAt).getMonth() + 1;
    cohort[mes].total++;
    if (op.etapa === 'ganho') {
      cohort[mes].ganho++;
      cohort[mes].valorGanho += Number(op.valor ?? 0);
    } else if (['perdido', 'declinado', 'cancelado'].includes(op.etapa)) {
      cohort[mes].perdido++;
    } else {
      cohort[mes].emAberto++;
    }
  }

  return cohort;
}
