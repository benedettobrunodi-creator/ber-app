/**
 * Module: Metas de Compra
 * Autor: Linux (BER Engenharia)
 * Data: 2026-04-06
 */

import { Request, Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';

const SKIP_CATEGORIES = new Set(['N', 'CONTRATO PRINCIPAL', 'RESUMO', 'EXTRAS', '']);

function parseRow(row: ExcelJS.Row): {
  n: string; categoria: string; descritivo: string | null;
  venda: number; pctMeta: number; comprado: number; fornecedor: string | null;
} | null {
  const values = row.values as (string | number | null | undefined)[];
  // colunas 1-indexed: B=2, C=3, D=4, E=5, F=6, G=7, H=8, K=11
  const venda = Number(values[5]);
  if (!venda || isNaN(venda) || venda === 0) return null;

  const cat = String(values[3] ?? '').trim();
  if (!cat || SKIP_CATEGORIES.has(cat)) return null;

  return {
    n: String(values[2] ?? '').trim(),
    categoria: cat,
    descritivo: String(values[4] ?? '').trim() || null,
    venda,
    pctMeta: Number(values[7] ?? 0.2) || 0.2,
    comprado: Number(values[8] ?? 0) || 0,
    fornecedor: String(values[11] ?? '').trim() || null,
  };
}

// GET /v1/obras/:id/compras
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: obraId } = req.params;
    const items = await prisma.comprasMeta.findMany({
      where: { obraId },
      orderBy: [{ n: 'asc' }, { categoria: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ data: items });
  } catch (err) { next(err); }
}

// POST /v1/obras/:id/compras/import
export async function importXlsx(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: obraId } = req.params;
    if (!req.file) throw AppError.badRequest('Arquivo não enviado');

    // Verificar obra
    const obra = await prisma.obra.findUnique({ where: { id: obraId } });
    if (!obra) throw AppError.notFound('Obra não encontrada');

    // Parsear xlsx
    const wb = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await wb.xlsx.load(req.file.buffer as any);

    const rows: {
      n: string; categoria: string; descritivo: string | null;
      venda: number; pctMeta: number; comprado: number; fornecedor: string | null;
    }[] = [];

    wb.eachSheet((ws) => {
      ws.eachRow((row, rowNum) => {
        if (rowNum < 6) return; // pular cabeçalho
        const parsed = parseRow(row);
        if (parsed) rows.push(parsed);
      });
    });

    if (rows.length === 0) throw AppError.badRequest('Nenhuma linha válida encontrada no arquivo');

    // Deletar existentes e reinserir
    await prisma.$transaction([
      prisma.comprasMeta.deleteMany({ where: { obraId } }),
      prisma.comprasMeta.createMany({
        data: rows.map((r) => ({ ...r, obraId })),
      }),
    ]);

    const created = await prisma.comprasMeta.findMany({
      where: { obraId },
      orderBy: [{ n: 'asc' }, { categoria: 'asc' }],
    });

    res.json({ data: created, imported: rows.length });
  } catch (err) { next(err); }
}

// PATCH /v1/obras/:id/compras/:itemId
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    const { pctMeta, comprado, fornecedor } = req.body;

    const item = await prisma.comprasMeta.findUnique({ where: { id: itemId } });
    if (!item) throw AppError.notFound('Item não encontrado');

    const updated = await prisma.comprasMeta.update({
      where: { id: itemId },
      data: {
        ...(pctMeta !== undefined && { pctMeta: Number(pctMeta) }),
        ...(comprado !== undefined && { comprado: Number(comprado) }),
        ...(fornecedor !== undefined && { fornecedor: String(fornecedor) || null }),
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
