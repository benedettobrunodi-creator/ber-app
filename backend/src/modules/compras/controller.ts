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
  n: string; categoria: string; descritivo: string | null;
  venda: number; pctMeta: number; comprado: number; fornecedor: string | null;
} | null {
  const values = row.values as (string | number | null | undefined)[];
  const tipo = String(values[3] ?? '').trim();
  if (tipo !== 'Item') return null;
  const descricao = String(values[7] ?? '').trim();
  if (!descricao) return null;
  const venda = Number(values[19]);
  if (!venda || isNaN(venda) || venda === 0) return null;
  return {
    n: String(values[2] ?? '').trim(),
    categoria: descricao,
    descritivo: null,
    venda,
    pctMeta: 0.2,
    comprado: 0,
    fornecedor: null,
  };
}


function mapItem(row: any) {
  return {
    id: row.id,
    obraId: row.obra_id,
    n: row.n,
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
        created_at ASC
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

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer as any);

    const rows: {
      n: string; categoria: string; descritivo: string | null;
      venda: number; pctMeta: number; comprado: number; fornecedor: string | null;
    }[] = [];

    wb.eachSheet((ws) => {
      ws.eachRow((row, rowNum) => {
        if (rowNum < 12) return;
        const parsed = parseRow(row);
        if (parsed) rows.push(parsed);
      });
    });

    if (rows.length === 0) throw AppError.badRequest('Nenhuma linha válida encontrada no arquivo');

    await prisma.$transaction([
      prisma.comprasMeta.deleteMany({ where: { obraId } }),
      prisma.comprasMeta.createMany({
        data: rows.map((r) => ({ ...r, obraId })),
      }),
    ]);

    const created = await prisma.$queryRaw<any[]>`
      SELECT * FROM compras_metas
      WHERE obra_id = ${obraId}::uuid
      ORDER BY
        created_at ASC
    `;

    res.json({ data: created.map(mapItem), imported: rows.length });
  } catch (err) { next(err); }
}

// PATCH /v1/obras/:id/compras/:itemId
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    const { pctMeta, comprado, fornecedor, faturamento, pacote, compradoOk } = req.body;

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
