/**
 * Module: Metas de Compra
 * Autor: Linux (BER Engenharia)
 * Data: 2026-04-06
 */

import { Request, Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';

function parseRow(row: ExcelJS.Row): {
  n: string | null; tipo: string; categoria: string; descritivo: string | null;
  venda: number; pctMeta: number; comprado: number; fornecedor: string | null;
} | null {
  const values = row.values as (string | number | null | undefined)[];
  const tipoRaw = String(values[3] ?? '').trim();
  if (tipoRaw !== 'Item' && tipoRaw !== 'Etapa') return null;
  const descricao = String(values[7] ?? '').trim();
  if (!descricao) return null;
  const tipo = tipoRaw === 'Etapa' ? 'etapa' : 'item';
  const venda = Number(values[19]);
  // Etapas podem ter venda 0 (será soma dos itens); Itens precisam de venda > 0
  if (tipo === 'item' && (!venda || isNaN(venda) || venda === 0)) return null;
  const nRaw = String(values[2] ?? '').trim();
  return {
    n: (nRaw || null)?.substring(0, 20) ?? null,
    tipo,
    categoria: descricao.substring(0, 200),
    descritivo: null,
    venda: isNaN(venda) ? 0 : venda,
    pctMeta: tipo === 'etapa' ? 0 : 0.2,
    comprado: 0,
    fornecedor: null,
  };
}


function mapItem(row: any) {
  return {
    id: row.id,
    obraId: row.obra_id,
    n: row.n,
    tipo: row.tipo ?? 'item',
    categoria: row.categoria,
    descritivo: row.descritivo,
    venda: Number(row.venda),
    pctMeta: Number(row.pct_meta),
    comprado: Number(row.comprado),
    fornecedor: row.fornecedor,
    faturamento: row.faturamento,
    pacote: row.pacote !== null ? Number(row.pacote) : null,
    compradoOk: row.comprado_ok,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /v1/obras/:id/compras
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: obraId } = req.params;
    const items = await prisma.$queryRaw<any[]>`
      SELECT * FROM compras_metas
      WHERE obra_id = ${obraId}::uuid
      ORDER BY
        CASE WHEN n IS NULL OR n = '' OR NOT split_part(n, '.', 1) ~ '^[0-9]+$' THEN 999999 ELSE CAST(split_part(n, '.', 1) AS INTEGER) END ASC,
        CASE WHEN n IS NULL OR n = '' OR split_part(n, '.', 2) = '' OR NOT split_part(n, '.', 2) ~ '^[0-9]+$' THEN 0 ELSE CAST(split_part(n, '.', 2) AS INTEGER) END ASC,
        CASE WHEN n IS NULL OR n = '' OR split_part(n, '.', 3) = '' OR NOT split_part(n, '.', 3) ~ '^[0-9]+$' THEN 0 ELSE CAST(split_part(n, '.', 3) AS INTEGER) END ASC
    `;
    res.json({ data: items.map(mapItem) });
  } catch (err) { next(err); }
}

// POST /v1/obras/:id/compras/import
export async function importXlsx(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: obraId } = req.params;
    if (!req.file) throw AppError.badRequest('Arquivo não enviado');

    const obra = await prisma.obra.findUnique({ where: { id: obraId } });
    if (!obra) throw AppError.notFound('Obra não encontrada');

    console.log('[import] file:', req.file?.originalname, 'size:', req.file?.size, 'buffer:', req.file?.buffer?.length);
    if (!req.file?.buffer || req.file.buffer.length === 0) throw AppError.badRequest('Buffer do arquivo vazio');
    console.log('[import] step: parsing xlsx');
    const wb = new ExcelJS.Workbook();
    try {
      const { Readable } = require('stream') as typeof import('stream');
      const stream = new Readable({ read() { this.push(req.file!.buffer); this.push(null); } });
      await wb.xlsx.read(stream);
    } catch (parseErr) {
      console.error('[import] xlsx parse error:', parseErr);
      throw AppError.badRequest('Arquivo Excel inválido ou corrompido. Envie um arquivo .xlsx válido.');
    }
    console.log('[import] step: xlsx parsed, sheets:', wb.worksheets.length);

    const rows: {
      n: string | null; tipo: string; categoria: string; descritivo: string | null;
      venda: number; pctMeta: number; comprado: number; fornecedor: string | null;
    }[] = [];

    wb.eachSheet((ws) => {
      ws.eachRow((row, rowNum) => {
        if (rowNum < 12) return;
        const parsed = parseRow(row);
        if (parsed) rows.push(parsed);
      });
    });

    console.log('[import] step: rows extracted:', rows.length);
    if (rows.length === 0) throw AppError.badRequest('Nenhuma linha válida encontrada no arquivo');

    console.log('[import] step: saving to DB');
    await prisma.$transaction([
      prisma.comprasMeta.deleteMany({ where: { obraId } }),
      prisma.comprasMeta.createMany({
        data: rows.map((r) => ({ ...r, obraId })),
      }),
    ]);
    console.log('[import] step: DB saved, querying result');

    const created = await prisma.$queryRaw<any[]>`
      SELECT * FROM compras_metas
      WHERE obra_id = ${obraId}::uuid
      ORDER BY
        CASE WHEN n IS NULL OR n = '' OR NOT split_part(n, '.', 1) ~ '^[0-9]+$' THEN 999999 ELSE CAST(split_part(n, '.', 1) AS INTEGER) END ASC,
        CASE WHEN n IS NULL OR n = '' OR split_part(n, '.', 2) = '' OR NOT split_part(n, '.', 2) ~ '^[0-9]+$' THEN 0 ELSE CAST(split_part(n, '.', 2) AS INTEGER) END ASC,
        CASE WHEN n IS NULL OR n = '' OR split_part(n, '.', 3) = '' OR NOT split_part(n, '.', 3) ~ '^[0-9]+$' THEN 0 ELSE CAST(split_part(n, '.', 3) AS INTEGER) END ASC
    `;

    res.json({ data: created.map(mapItem), imported: rows.length });
  } catch (err) {
    if (err instanceof AppError) return next(err);
    console.error('[import] Unhandled error:', err);
    next(err);
  }
}

// PATCH /v1/obras/:id/compras/:itemId
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    const { pctMeta, comprado, fornecedor, faturamento, pacote, compradoOk, categoria, venda } = req.body;

    const item = await prisma.comprasMeta.findUnique({ where: { id: itemId } });
    if (!item) throw AppError.notFound('Item não encontrado');

    const updated = await prisma.comprasMeta.update({
      where: { id: itemId },
      data: {
        ...(pctMeta !== undefined && { pctMeta: Number(pctMeta) }),
        ...(comprado !== undefined && { comprado: Number(comprado) }),
        ...(fornecedor !== undefined && { fornecedor: String(fornecedor) || null }),
        ...(faturamento !== undefined && { faturamento: String(faturamento) || null }),
        ...(pacote !== undefined && { pacote: pacote === null ? null : Number(pacote) }),
        ...(compradoOk !== undefined && { compradoOk: Boolean(compradoOk) }),
        ...(categoria !== undefined && { categoria: String(categoria) }),
        ...(venda !== undefined && { venda: Number(venda) }),
      },
    });

    res.json({ data: updated });
  } catch (err) { next(err); }
}

// DELETE /v1/obras/:id/compras
export async function clear(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: obraId } = req.params;
    await prisma.comprasMeta.deleteMany({ where: { obraId } });
    res.json({ data: { deleted: true } });
  } catch (err) { next(err); }
}
