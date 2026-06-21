/**
 * Módulo: Compras Dashboard
 * Endpoint consolidado de Metas de Compra agregando todas as obras.
 * RBAC: socio (via middleware no app.ts).
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { calcObra, RawItem, ObraIndicadores } from './calc';

interface ObraSummary {
  obraId: string;
  obraName: string;
  obraStatus: string;
  indicadores: ObraIndicadores;
}

interface TotaisConsolidados {
  totalVendaBruta: number;
  totalVenda: number;
  totalMeta: number;
  totalComprado: number;
  totalItens: number;
  itensComprados: number;
  itensPendentes: number;
  okSaving: number;
  okSavingPct: number;
  okSavingMeta: number;
  okSavingMetaPct: number;
  pendVenda: number;
  pendMeta: number;
  potencialSaving: number;
  projecaoSaving: number;
}

// GET /v1/compras-dashboard/summary?status=em_andamento,planejamento&obraId=<uuid>
export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const statusParam = typeof req.query.status === 'string' ? req.query.status : '';
    const statusFilter = statusParam
      ? statusParam.split(',').map(s => s.trim()).filter(Boolean)
      : null;
    const obraIdParam = typeof req.query.obraId === 'string' && req.query.obraId.trim() ? req.query.obraId.trim() : null;

    // Soma de splits por compras_meta_id — usado pra sobrescrever item.comprado
    // quando o item tem splits (mesma regra do front: split.valor[] domina).
    const obras = await prisma.obra.findMany({
      where: {
        ...(statusFilter ? { status: { in: statusFilter } } : {}),
        ...(obraIdParam ? { id: obraIdParam } : {}),
      },
      select: { id: true, name: true, status: true },
      orderBy: { name: 'asc' },
    });

    if (obras.length === 0) {
      return res.json({ data: { obras: [], totais: emptyTotais(), filtros: { status: statusFilter } } });
    }

    const obraIds = obras.map(o => o.id);

    const [metas, splitsAgg, configs] = await Promise.all([
      prisma.comprasMeta.findMany({
        where: { obraId: { in: obraIds } },
        select: {
          id: true, obraId: true, tipo: true, categoria: true,
          venda: true, pctMeta: true, comprado: true, compradoOk: true,
        },
      }),
      prisma.comprasSplit.groupBy({
        by: ['comprasMetaId'],
        _sum: { valor: true },
        where: { comprasMeta: { obraId: { in: obraIds } } },
      }),
      prisma.comprasConfig.findMany({
        where: { obraId: { in: obraIds } },
        select: { obraId: true, comissao: true },
      }),
    ]);

    const splitsByMeta = new Map<string, number>();
    for (const s of splitsAgg) {
      if (s._sum.valor !== null && s._sum.valor !== undefined) {
        splitsByMeta.set(s.comprasMetaId, Number(s._sum.valor));
      }
    }

    const comissaoByObra = new Map<string, number>();
    for (const c of configs) comissaoByObra.set(c.obraId, Number(c.comissao));

    const itemsByObra = new Map<string, RawItem[]>();
    for (const m of metas) {
      const splitSum = splitsByMeta.get(m.id);
      const compradoEfetivo = splitSum !== undefined ? splitSum : Number(m.comprado);
      const item: RawItem = {
        id: m.id,
        tipo: m.tipo ?? 'item',
        categoria: m.categoria,
        venda: Number(m.venda),
        pctMeta: Number(m.pctMeta),
        comprado: compradoEfetivo,
        compradoOk: m.compradoOk,
      };
      const list = itemsByObra.get(m.obraId) ?? [];
      list.push(item);
      itemsByObra.set(m.obraId, list);
    }

    const obrasResumo: ObraSummary[] = obras.map(o => ({
      obraId: o.id,
      obraName: o.name,
      obraStatus: o.status,
      indicadores: calcObra(itemsByObra.get(o.id) ?? [], comissaoByObra.get(o.id) ?? 0),
    }));

    const totais = obrasResumo.reduce<TotaisConsolidados>((acc, o) => {
      const i = o.indicadores;
      acc.totalVendaBruta += i.totalVendaBruta;
      acc.totalVenda += i.totalVenda;
      acc.totalMeta += i.totalMeta;
      acc.totalComprado += i.totalComprado;
      acc.totalItens += i.totalItens;
      acc.itensComprados += i.itensComprados;
      acc.itensPendentes += i.itensPendentes;
      acc.okSaving += i.okSaving;
      acc.okSavingMeta += i.okSavingMeta;
      acc.pendVenda += i.pendVenda;
      acc.pendMeta += i.pendMeta;
      acc.potencialSaving += i.potencialSaving;
      acc.projecaoSaving += i.projecaoSaving ?? 0;
      return acc;
    }, emptyTotais());

    // okVenda consolidado p/ recalcular % saving global
    const okVendaConsolidado = obrasResumo.reduce((s, o) => s + o.indicadores.okVenda, 0);
    const okMetaConsolidado = obrasResumo.reduce((s, o) => s + (o.indicadores.okVenda - o.indicadores.okSaving + o.indicadores.okSavingMeta), 0);
    totais.okSavingPct = okVendaConsolidado > 0 ? (totais.okSaving / okVendaConsolidado) * 100 : 0;
    totais.okSavingMetaPct = okMetaConsolidado > 0 ? (totais.okSavingMeta / okMetaConsolidado) * 100 : 0;

    res.json({
      data: {
        obras: obrasResumo,
        totais,
        filtros: { status: statusFilter },
      },
    });
  } catch (err) { next(err); }
}

function emptyTotais(): TotaisConsolidados {
  return {
    totalVendaBruta: 0,
    totalVenda: 0,
    totalMeta: 0,
    totalComprado: 0,
    totalItens: 0,
    itensComprados: 0,
    itensPendentes: 0,
    okSaving: 0,
    okSavingPct: 0,
    okSavingMeta: 0,
    okSavingMetaPct: 0,
    pendVenda: 0,
    pendMeta: 0,
    potencialSaving: 0,
    projecaoSaving: 0,
  };
}
