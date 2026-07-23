import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../utils/errors';

// ── Ciclos ──────────────────────────────────────────────────────────────────

export async function listCiclos(_req: Request, res: Response) {
  const ciclos = await prisma.finCiclo.findMany({
    orderBy: [{ ano: 'desc' }, { ordem: 'asc' }],
  });
  sendSuccess(res, ciclos);
}

export async function createCiclo(req: Request, res: Response) {
  const { nome, ano, ordem } = req.body ?? {};
  if (!nome || !ano) throw AppError.badRequest('nome e ano são obrigatórios');
  const ciclo = await prisma.finCiclo.create({
    data: { nome, ano: Number(ano), ordem: ordem != null ? Number(ordem) : 0 },
  });
  sendSuccess(res, ciclo);
}

export async function updateCiclo(req: Request, res: Response) {
  const { id } = req.params;
  const { nome, ano, ordem } = req.body ?? {};
  const data: any = {};
  if (nome !== undefined) data.nome = nome;
  if (ano !== undefined) data.ano = Number(ano);
  if (ordem !== undefined) data.ordem = Number(ordem);
  const ciclo = await prisma.finCiclo.update({ where: { id }, data });
  sendSuccess(res, ciclo);
}

export async function deleteCiclo(req: Request, res: Response) {
  const { id } = req.params;
  await prisma.finCiclo.delete({ where: { id } });
  sendSuccess(res, { deleted: true });
}

/** Duplica ciclo inteiro (linhas + valores) num novo ciclo com o nome informado. */
export async function duplicarCiclo(req: Request, res: Response) {
  const { id } = req.params;
  const { nome, ano } = req.body ?? {};
  if (!nome) throw AppError.badRequest('nome do novo ciclo é obrigatório');
  const origem = await prisma.finCiclo.findUnique({
    where: { id },
    include: { linhas: { include: { valores: true } } },
  });
  if (!origem) throw AppError.notFound('ciclo não encontrado');

  const novo = await prisma.$transaction(async (tx) => {
    const c = await tx.finCiclo.create({
      data: { nome, ano: ano != null ? Number(ano) : origem.ano },
    });
    // Cria linhas em duas fases pra resolver grupoId (auto-referência).
    const idMap = new Map<string, string>();
    for (const l of origem.linhas) {
      const nova = await tx.finLinha.create({
        data: {
          cicloId: c.id,
          ordem: l.ordem,
          rotulo: l.rotulo,
          kpiPct: l.kpiPct,
          orcamentoAnual: l.orcamentoAnual,
          isTotal: l.isTotal,
          isHeader: l.isHeader,
        },
      });
      idMap.set(l.id, nova.id);
    }
    for (const l of origem.linhas) {
      if (!l.grupoId) continue;
      const novoGrupo = idMap.get(l.grupoId);
      if (!novoGrupo) continue;
      await tx.finLinha.update({
        where: { id: idMap.get(l.id)! },
        data: { grupoId: novoGrupo },
      });
    }
    // Copia valores
    for (const l of origem.linhas) {
      const novaLinhaId = idMap.get(l.id)!;
      for (const v of l.valores) {
        await tx.finValor.create({
          data: { linhaId: novaLinhaId, mes: v.mes, valor: v.valor },
        });
      }
    }
    return c;
  });
  sendSuccess(res, novo);
}

// ── Snapshot: ciclo com linhas + valores agrupados por linha ────────────────

export async function getSnapshot(req: Request, res: Response) {
  const { cicloId } = req.params;
  const ciclo = await prisma.finCiclo.findUnique({
    where: { id: cicloId },
    include: {
      linhas: {
        orderBy: { ordem: 'asc' },
        include: { valores: true },
      },
    },
  });
  if (!ciclo) throw AppError.notFound('ciclo não encontrado');
  // Reformata: cada linha vira { ..., valores: { 1: 0, 2: 0, ... } }
  const linhas = ciclo.linhas.map((l) => {
    const valores: Record<number, number> = {};
    for (const v of l.valores) valores[v.mes] = Number(v.valor);
    return {
      id: l.id,
      ordem: l.ordem,
      rotulo: l.rotulo,
      kpiPct: l.kpiPct != null ? Number(l.kpiPct) : null,
      orcamentoAnual: l.orcamentoAnual != null ? Number(l.orcamentoAnual) : null,
      isTotal: l.isTotal,
      isHeader: l.isHeader,
      grupoId: l.grupoId,
      valores,
    };
  });
  sendSuccess(res, {
    id: ciclo.id,
    nome: ciclo.nome,
    ano: ciclo.ano,
    linhas,
  });
}

// ── Linhas ──────────────────────────────────────────────────────────────────

export async function createLinha(req: Request, res: Response) {
  const { cicloId } = req.params;
  const { rotulo, ordem, kpiPct, orcamentoAnual, isTotal, isHeader, grupoId } = req.body ?? {};
  if (!rotulo) throw AppError.badRequest('rotulo é obrigatório');
  const linha = await prisma.finLinha.create({
    data: {
      cicloId,
      rotulo,
      ordem: ordem != null ? Number(ordem) : 999,
      kpiPct: kpiPct != null ? Number(kpiPct) : null,
      orcamentoAnual: orcamentoAnual != null ? Number(orcamentoAnual) : null,
      isTotal: !!isTotal,
      isHeader: !!isHeader,
      grupoId: grupoId || null,
    },
  });
  sendSuccess(res, linha);
}

export async function updateLinha(req: Request, res: Response) {
  const { linhaId } = req.params;
  const { rotulo, ordem, kpiPct, orcamentoAnual, isTotal, isHeader, grupoId } = req.body ?? {};
  const data: any = {};
  if (rotulo !== undefined) data.rotulo = rotulo;
  if (ordem !== undefined) data.ordem = Number(ordem);
  if (kpiPct !== undefined) data.kpiPct = kpiPct === null ? null : Number(kpiPct);
  if (orcamentoAnual !== undefined) data.orcamentoAnual = orcamentoAnual === null ? null : Number(orcamentoAnual);
  if (isTotal !== undefined) data.isTotal = !!isTotal;
  if (isHeader !== undefined) data.isHeader = !!isHeader;
  if (grupoId !== undefined) data.grupoId = grupoId || null;
  const linha = await prisma.finLinha.update({ where: { id: linhaId }, data });
  sendSuccess(res, linha);
}

export async function deleteLinha(req: Request, res: Response) {
  const { linhaId } = req.params;
  await prisma.finLinha.delete({ where: { id: linhaId } });
  sendSuccess(res, { deleted: true });
}

/** Atualiza ordem em lote (recebe array de {id, ordem}). */
export async function reorderLinhas(req: Request, res: Response) {
  const items: { id: string; ordem: number }[] = req.body?.items ?? [];
  if (!Array.isArray(items) || items.length === 0) throw AppError.badRequest('items vazio');
  await prisma.$transaction(items.map((it) =>
    prisma.finLinha.update({ where: { id: it.id }, data: { ordem: Number(it.ordem) } }),
  ));
  sendSuccess(res, { updated: items.length });
}

// ── Valores ─────────────────────────────────────────────────────────────────

/** Upsert de um valor (linha × mês). Se valor for null/0 e existir, remove. */
export async function setValor(req: Request, res: Response) {
  const { linhaId } = req.params;
  const { mes, valor } = req.body ?? {};
  const m = Number(mes);
  if (!(m >= 1 && m <= 12)) throw AppError.badRequest('mes inválido (1..12)');
  const v = valor === null || valor === '' ? null : Number(valor);
  if (v === null || v === 0) {
    await prisma.finValor.deleteMany({ where: { linhaId, mes: m } });
    sendSuccess(res, { removed: true });
    return;
  }
  const up = await prisma.finValor.upsert({
    where: { linhaId_mes: { linhaId, mes: m } },
    update: { valor: v },
    create: { linhaId, mes: m, valor: v },
  });
  sendSuccess(res, up);
}
