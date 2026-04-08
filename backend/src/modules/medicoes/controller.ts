/**
 * controller.ts — Medição de Contrato
 * Autor: Linux (BER Engenharia)
 */
import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { sendSuccess, sendCreated } from '../../utils/response';
import { Decimal } from '@prisma/client/runtime/library';

// ── helpers ──────────────────────────────────────────────────────────────────

function toNum(d: Decimal | null | undefined): number {
  return d ? Number(d) : 0;
}

/** Monta próximo número de quinzena: Q1, Q2 ... */
async function nextNumero(obraId: string): Promise<string> {
  const count = await prisma.medicao.count({ where: { obraId } });
  return `Q${count + 1}`;
}

/** Calcula periodo_inicio (+15 dias da última medição ou hoje) */
async function nextPeriodo(obraId: string): Promise<{ inicio: Date; fim: Date }> {
  const last = await prisma.medicao.findFirst({
    where: { obraId },
    orderBy: { criadoEm: 'desc' },
  });
  const inicio = last
    ? new Date(last.periodoFim.getTime() + 86400000)
    : new Date();
  const fim = new Date(inicio.getTime() + 14 * 86400000);
  return { inicio, fim };
}

// ── GET /v1/obras/:id/medicoes ────────────────────────────────────────────────

export async function listMedicoes(req: Request, res: Response, next?: any) {
  const { id: obraId } = req.params;

  const medicoes = await prisma.medicao.findMany({
    where: { obraId },
    orderBy: { criadoEm: 'asc' },
    include: {
      lancamentos: { include: { item: true } },
    },
  });

  const result = medicoes.map((m) => {
    const totalQuinzena = m.lancamentos.reduce(
      (sum, l) => sum + toNum(l.valorMedido), 0,
    );
    return {
      id: m.id,
      numero: m.numero,
      periodoInicio: m.periodoInicio,
      periodoFim: m.periodoFim,
      status: m.status,
      totalQuinzena,
    };
  });

  sendSuccess(res, result);
}

// ── POST /v1/obras/:id/medicoes ───────────────────────────────────────────────

export async function createMedicao(req: Request, res: Response, next?: any) {
  const { id: obraId } = req.params;

  const obra = await prisma.obra.findUnique({ where: { id: obraId } });
  if (!obra) throw AppError.notFound('Obra');

  const numero = await nextNumero(obraId);
  const { inicio, fim } = await nextPeriodo(obraId);

  const medicao = await prisma.medicao.create({
    data: {
      obraId,
      numero,
      periodoInicio: req.body.periodoInicio ? new Date(req.body.periodoInicio) : inicio,
      periodoFim: req.body.periodoFim ? new Date(req.body.periodoFim) : fim,
      status: 'rascunho',
    },
  });

  sendCreated(res, medicao);
}

// ── GET /v1/medicoes/:id ──────────────────────────────────────────────────────

export async function getMedicao(req: Request, res: Response, next?: any) {
  const { id } = req.params;

  const medicao = await prisma.medicao.findUnique({
    where: { id },
    include: {
      lancamentos: { include: { item: true } },
    },
  });
  if (!medicao) throw AppError.notFound('Medição');

  // Buscar todos os itens da obra
  const itens = await prisma.medicaoItem.findMany({
    where: { obraId: medicao.obraId },
    orderBy: [{ ordem: 'asc' }, { numero: 'asc' }],
  });

  // Buscar TODOS os lançamentos de todas as medições da obra para calcular acumulado
  const todasMedicoes = await prisma.medicao.findMany({
    where: { obraId: medicao.obraId },
    orderBy: { criadoEm: 'asc' },
    select: { id: true, numero: true },
  });

  const todosLancamentos = await prisma.medicaoLancamento.findMany({
    where: { medicao: { obraId: medicao.obraId } },
  });

  // Mapa: itemId → { [medicaoId]: lançamento }
  const lancMap = new Map<string, Map<string, { percentual: number; valor: number }>>();
  for (const l of todosLancamentos) {
    if (!lancMap.has(l.itemId)) lancMap.set(l.itemId, new Map());
    lancMap.get(l.itemId)!.set(l.medicaoId, {
      percentual: toNum(l.percentualExecutado),
      valor: toNum(l.valorMedido),
    });
  }

  const itensEnriquecidos = itens.map((item) => {
    const itemLancs = lancMap.get(item.id) ?? new Map();
    const percentualAcumulado = Array.from(itemLancs.values()).reduce(
      (s, l) => s + l.percentual, 0,
    );
    const valorOrcado = toNum(item.valorOrcado);
    const valorMedidoTotal = (valorOrcado * percentualAcumulado) / 100;
    const saldo = valorOrcado - valorMedidoTotal;

    // Lançamento desta medição
    const lancAtual = itemLancs.get(id);

    return {
      id: item.id,
      numero: item.numero,
      descricao: item.descricao,
      valorOrcado,
      tipo: item.tipo,
      ordem: item.ordem,
      percentualAcumulado,
      valorMedidoTotal,
      saldo,
      lancamentoAtual: lancAtual
        ? { percentual: lancAtual.percentual, valor: lancAtual.valor }
        : { percentual: 0, valor: 0 },
    };
  });

  const totalQuinzena = medicao.lancamentos.reduce(
    (s, l) => s + toNum(l.valorMedido), 0,
  );

  sendSuccess(res, {
    id: medicao.id,
    numero: medicao.numero,
    periodoInicio: medicao.periodoInicio,
    periodoFim: medicao.periodoFim,
    status: medicao.status,
    totalQuinzena,
    medicoes: todasMedicoes,
    itens: itensEnriquecidos,
  });
}

// ── PATCH /v1/medicoes/:id/lancamentos ───────────────────────────────────────

export async function saveLancamentos(req: Request, res: Response, next?: any) {
  const { id: medicaoId } = req.params;
  const medicao = await prisma.medicao.findUnique({ where: { id: medicaoId }, include: { lancamentos: { include: { item: true } } } });
  if (!medicao) throw AppError.notFound('Medição');
  if (medicao.status === 'aprovada' || medicao.status === 'faturada' || medicao.status === 'paga') {
    throw AppError.forbidden('Medição aprovada não pode ser editada');
  }

  const lancamentos: { item_id: string; percentual_executado: number }[] = req.body.lancamentos ?? [];

  for (const l of lancamentos) {
    const item = await prisma.medicaoItem.findUnique({ where: { id: l.item_id } });
    if (!item) continue;

    // Calcular acumulado até aqui (exceto esta medição) para validar
    const outrosLancs = await prisma.medicaoLancamento.aggregate({
      where: { itemId: l.item_id, NOT: { medicaoId } },
      _sum: { percentualExecutado: true },
    });
    const acumuladoOutros = toNum(outrosLancs._sum.percentualExecutado);
    const pct = Math.min(l.percentual_executado, 100 - acumuladoOutros);
    const valor = (toNum(item.valorOrcado) * pct) / 100;

    await prisma.medicaoLancamento.upsert({
      where: { itemId_medicaoId: { itemId: l.item_id, medicaoId } },
      create: {
        itemId: l.item_id,
        medicaoId,
        percentualExecutado: pct,
        valorMedido: valor,
      },
      update: { percentualExecutado: pct, valorMedido: valor },
    });
  }

  sendSuccess(res, { ok: true });
}

// ── PATCH /v1/medicoes/:id ────────────────────────────────────────────────────

export async function updateMedicao(req: Request, res: Response, next?: any) {
  const { id } = req.params;
  const { periodo_inicio, periodo_fim, numero } = req.body;

  const medicao = await prisma.medicao.findUnique({ where: { id } });
  if (!medicao) throw AppError.notFound('Medição');
  if (medicao.status === 'aprovada' || medicao.status === 'faturada' || medicao.status === 'paga') {
    throw AppError.forbidden('Medição aprovada não pode ser editada');
  }

  const updated = await prisma.medicao.update({
    where: { id },
    data: {
      ...(periodo_inicio ? { periodoInicio: new Date(periodo_inicio) } : {}),
      ...(periodo_fim ? { periodoFim: new Date(periodo_fim) } : {}),
      ...(numero ? { numero } : {}),
    },
  });

  sendSuccess(res, updated);
}

// ── PATCH /v1/medicoes/:id/status ────────────────────────────────────────────

export async function updateStatus(req: Request, res: Response, next?: any) {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['rascunho', 'enviada', 'aprovada', 'faturada', 'paga'];
  if (!allowed.includes(status)) throw AppError.badRequest('Status inválido');

  const medicao = await prisma.medicao.update({ where: { id }, data: { status } });
  sendSuccess(res, medicao);
}

// ── GET /v1/obras/:id/medicao-itens ──────────────────────────────────────────

export async function listItens(req: Request, res: Response, next?: any) {
  const { id: obraId } = req.params;
  const itens = await prisma.medicaoItem.findMany({
    where: { obraId },
    orderBy: [{ ordem: 'asc' }, { numero: 'asc' }],
  });
  sendSuccess(res, itens);
}

// ── POST /v1/obras/:id/medicao-itens/bulk ─────────────────────────────────────

export async function bulkItens(req: Request, res: Response, next?: any) {
  const { id: obraId } = req.params;
  const obra = await prisma.obra.findUnique({ where: { id: obraId } });
  if (!obra) throw AppError.notFound('Obra');

  const itens: { numero: string; descricao: string; valor_orcado: number; tipo?: string; ordem?: number }[] =
    req.body.itens ?? [];

  // Delete existing and re-insert (full replace)
  await prisma.medicaoLancamento.deleteMany({ where: { item: { obraId } } });
  await prisma.medicaoItem.deleteMany({ where: { obraId } });

  const created = await prisma.$transaction(
    itens.map((it, idx) =>
      prisma.medicaoItem.create({
        data: {
          obraId,
          numero: it.numero,
          descricao: it.descricao,
          valorOrcado: it.valor_orcado,
          tipo: it.tipo ?? (it.numero.includes('.') ? 'subitem' : 'grupo'),
          ordem: it.ordem ?? idx,
        },
      }),
    ),
  );

  sendCreated(res, { count: created.length });
}

// ── PATCH /v1/medicao-itens/:itemId ───────────────────────────────────────────

export async function updateItem(req: Request, res: Response, next?: any) {
  const { itemId } = req.params;
  const item = await prisma.medicaoItem.findUnique({ where: { id: itemId } });
  if (!item) throw AppError.notFound('Item de medição');

  const data: { descricao?: string; valorOrcado?: number } = {};
  if (req.body.descricao !== undefined) data.descricao = String(req.body.descricao);
  if (req.body.valor_orcado !== undefined) data.valorOrcado = Number(req.body.valor_orcado);

  const updated = await prisma.medicaoItem.update({ where: { id: itemId }, data });
  sendSuccess(res, updated);
}
