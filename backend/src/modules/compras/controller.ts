/**
 * Module: Metas de Compra
 * Autor: Linux (BER Engenharia)
 * Data: 2026-04-06
 */

import { Request, Response, NextFunction } from 'express';
import * as XLSX from 'xlsx';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';

function parseNum(val: unknown): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  return parseFloat(String(val).replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
}

// row: SheetJS object with column-letter keys (header:'A')
// Col B = n, Col C = tipo ("Item"/"Etapa"), Col G = categoria, Col AD = preço c/ BDI, Col S = custo total
function parseRow(row: Record<string, unknown>): {
  n: string | null; tipo: string; categoria: string; descritivo: string | null;
  venda: number; pctMeta: number; comprado: number; fornecedor: string | null;
} | null {
  const tipoRaw = String(row['C'] ?? '').trim().toLowerCase();
  if (tipoRaw !== 'item' && tipoRaw !== 'etapa') return null;
  const descricao = String(row['G'] ?? '').trim();
  if (!descricao) return null;
  const tipo = tipoRaw === 'etapa' ? 'etapa' : 'item';
  // Tenta preço com BDI (col AD) primeiro; cai para custo total (col S)
  const precoTotal = parseNum(row['AD']);
  const custoTotal = parseNum(row['S']);
  const venda = precoTotal > 0 ? precoTotal : custoTotal;
  if (tipo === 'item' && venda === 0) return null;
  const nRaw = String(row['B'] ?? '').trim();
  return {
    n: (nRaw || null)?.substring(0, 20) ?? null,
    tipo,
    categoria: descricao.substring(0, 200),
    descritivo: null,
    venda,
    pctMeta: tipo === 'etapa' ? 0 : 0.2,
    comprado: 0,
    fornecedor: null,
  };
}


function mapItem(row: any, splits: any[] = []) {
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
    splits: splits.map(s => ({
      id: s.id,
      descricao: s.descricao ?? null,
      fornecedor: s.fornecedor,
      faturamento: s.faturamento,
      valor: Number(s.valor),
      coTipo: s.co_tipo ?? null,
      pctMeta: s.pct_meta !== undefined && s.pct_meta !== null ? Number(s.pct_meta) : 0.2,
      comprado: s.comprado !== undefined && s.comprado !== null ? Number(s.comprado) : 0,
      compradoOk: !!s.comprado_ok,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /v1/obras/:id/compras
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: obraId } = req.params;
    const [items, splits] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT * FROM compras_metas
        WHERE obra_id = ${obraId}::uuid
        ORDER BY
          CASE WHEN n IS NULL OR n = '' OR NOT split_part(n, '.', 1) ~ '^[0-9]+$' THEN 999999 ELSE CAST(split_part(n, '.', 1) AS INTEGER) END ASC,
          CASE WHEN n IS NULL OR n = '' OR split_part(n, '.', 2) = '' OR NOT split_part(n, '.', 2) ~ '^[0-9]+$' THEN 0 ELSE CAST(split_part(n, '.', 2) AS INTEGER) END ASC,
          CASE WHEN n IS NULL OR n = '' OR split_part(n, '.', 3) = '' OR NOT split_part(n, '.', 3) ~ '^[0-9]+$' THEN 0 ELSE CAST(split_part(n, '.', 3) AS INTEGER) END ASC
      `,
      prisma.$queryRaw<any[]>`
        SELECT cs.* FROM compras_splits cs
        JOIN compras_metas cm ON cm.id = cs.compras_meta_id
        WHERE cm.obra_id = ${obraId}::uuid
        ORDER BY cs.created_at ASC
      `,
    ]);
    const splitsByMeta: Record<string, any[]> = {};
    for (const s of splits) {
      const key = s.compras_meta_id;
      if (!splitsByMeta[key]) splitsByMeta[key] = [];
      splitsByMeta[key].push(s);
    }
    res.json({ data: items.map(row => mapItem(row, splitsByMeta[row.id] ?? [])) });
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
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    } catch (parseErr) {
      console.error('[import] xlsx parse error:', parseErr);
      throw AppError.badRequest('Arquivo Excel inválido ou corrompido. Envie um arquivo .xlsx válido.');
    }
    console.log('[import] step: xlsx parsed, sheets:', wb.SheetNames.length);

    const rows: {
      n: string | null; tipo: string; categoria: string; descritivo: string | null;
      venda: number; pctMeta: number; comprado: number; fornecedor: string | null;
    }[] = [];

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      // header:'A' → each row is { A: val, B: val, C: val, ... } keyed by column letter
      // Force read full range — SheetJS may auto-detect a smaller used range.
      // Compute actual range from cell keys to avoid truncation.
      const cellKeys = Object.keys(ws).filter(k => !k.startsWith('!'));
      let maxRow = 0;
      for (const k of cellKeys) {
        const m = k.match(/^[A-Z]+(\d+)$/);
        if (m) maxRow = Math.max(maxRow, parseInt(m[1], 10));
      }
      console.log('[import] computed maxRow from cells:', maxRow);
      const range = `A1:AZ${Math.max(maxRow, 1)}`;
      const allRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 'A', defval: null, range });
      console.log('[import] sheet:', sheetName, 'total rows:', allRows.length);
      // Log rows 1-15 to confirm header position and data start
      for (let i = 0; i < Math.min(15, allRows.length); i++) {
        const r = allRows[i];
        console.log(`[import] row ${i + 1}: B=${JSON.stringify(r['B'])} C=${JSON.stringify(r['C'])} G=${JSON.stringify(r['G'])} S=${JSON.stringify(r['S'])}`);
      }
      // Log distinct values found in col C for diagnosis
      const colCValues = new Set(allRows.map(r => String(r['C'] ?? '').trim()).filter(Boolean));
      console.log('[import] distinct col C values:', [...colCValues].slice(0, 20));

      // Log todas as colunas da primeira linha de dados (tipo Etapa/Item) para mapear colunas de preço
      const firstDataRow = allRows.find(r => ['etapa','item','subetapa'].includes(String(r['C'] ?? '').trim().toLowerCase()));
      if (firstDataRow) {
        const nonNull = Object.entries(firstDataRow).filter(([,v]) => v !== null && v !== '').map(([k,v]) => `${k}=${JSON.stringify(v)}`);
        console.log('[import] first data row cols:', nonNull.join(' | '));
      }

      for (let i = 0; i < allRows.length; i++) {
        const parsed = parseRow(allRows[i]);
        if (parsed) rows.push(parsed);
      }
    }

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

    res.json({ data: created.map(row => mapItem(row)), imported: rows.length });
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

// POST /v1/obras/:id/compras/:itemId/splits
export async function addSplit(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    const item = await prisma.comprasMeta.findUnique({ where: { id: itemId } });
    if (!item) throw AppError.notFound('Item não encontrado');
    const coTipo = req.body.coTipo ?? null;
    const split = await prisma.comprasSplit.create({
      data: { comprasMetaId: itemId, descricao: null, fornecedor: null, faturamento: null, valor: 0, coTipo },
    });
    res.json({ data: {
      id: split.id,
      descricao: null,
      fornecedor: null,
      faturamento: null,
      valor: 0,
      coTipo,
      pctMeta: Number(split.pctMeta),
      comprado: Number(split.comprado),
      compradoOk: split.compradoOk,
    }});
  } catch (err) { next(err); }
}

// PATCH /v1/obras/:id/compras/:itemId/splits/:splitId
export async function updateSplit(req: Request, res: Response, next: NextFunction) {
  try {
    const { splitId } = req.params;
    const { descricao, fornecedor, faturamento, valor, coTipo, pctMeta, comprado, compradoOk } = req.body;
    const split = await prisma.comprasSplit.update({
      where: { id: splitId },
      data: {
        ...(descricao !== undefined && { descricao: descricao || null }),
        ...(fornecedor !== undefined && { fornecedor: fornecedor || null }),
        ...(faturamento !== undefined && { faturamento: faturamento || null }),
        ...(valor !== undefined && { valor: Number(valor) }),
        ...(coTipo !== undefined && { coTipo: coTipo || null }),
        ...(pctMeta !== undefined && { pctMeta: Number(pctMeta) }),
        ...(comprado !== undefined && { comprado: Number(comprado) }),
        ...(compradoOk !== undefined && { compradoOk: !!compradoOk }),
      },
    });
    res.json({ data: {
      id: split.id,
      descricao: split.descricao ?? null,
      fornecedor: split.fornecedor,
      faturamento: split.faturamento,
      valor: Number(split.valor),
      coTipo: split.coTipo ?? null,
      pctMeta: Number(split.pctMeta),
      comprado: Number(split.comprado),
      compradoOk: split.compradoOk,
    }});
  } catch (err) { next(err); }
}

// DELETE /v1/obras/:id/compras/:itemId/splits/:splitId
export async function deleteSplit(req: Request, res: Response, next: NextFunction) {
  try {
    const { splitId } = req.params;
    await prisma.comprasSplit.delete({ where: { id: splitId } });
    res.json({ data: { deleted: true } });
  } catch (err) { next(err); }
}

// POST /v1/obras/:id/compras — cria um item avulso (change order)
export async function createItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: obraId } = req.params;
    const obra = await prisma.obra.findUnique({ where: { id: obraId } });
    if (!obra) throw AppError.notFound('Obra não encontrada');

    const item = await prisma.comprasMeta.create({
      data: {
        obraId,
        n: null,
        tipo: 'co',
        categoria: String(req.body.categoria || 'Change Order').substring(0, 200),
        descritivo: req.body.descritivo ? String(req.body.descritivo).substring(0, 500) : null,
        venda: Number(req.body.venda) || 0,
        pctMeta: req.body.pctMeta !== undefined ? Number(req.body.pctMeta) : 0.2,
        comprado: 0,
      },
    });

    res.json({ data: mapItem(item) });
  } catch (err) { next(err); }
}

// DELETE /v1/obras/:id/compras/:itemId — deleta um item específico
export async function deleteItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { itemId } = req.params;
    await prisma.comprasMeta.delete({ where: { id: itemId } });
    res.json({ data: { deleted: true } });
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

// GET /v1/obras/:id/compras/config
export async function getConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: obraId } = req.params;
    const config = await prisma.comprasConfig.findUnique({ where: { obraId } });
    res.json({ data: { comissao: config?.comissao ?? 0 } });
  } catch (err) { next(err); }
}

// PUT /v1/obras/:id/compras/config
export async function upsertConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: obraId } = req.params;
    const comissao = Number(req.body.comissao) || 0;
    const config = await prisma.comprasConfig.upsert({
      where: { obraId },
      update: { comissao },
      create: { obraId, comissao },
    });
    res.json({ data: { comissao: config.comissao } });
  } catch (err) { next(err); }
}
