import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { uploadToR2, isR2Configured } from '../../services/storage';
import path from 'path';
import fs from 'fs';
import { env } from '../../config/env';

export async function getCronograma(req: Request, res: Response) {
  const { id: obraId } = req.params;
  const cronograma = await prisma.cronograma.findFirst({
    where: { obraId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json({ data: cronograma });
}

export async function uploadCronograma(req: Request, res: Response) {
  const { id: obraId } = req.params;
  if (!req.file) return res.status(400).json({ error: { message: 'Arquivo obrigatório' } });

  let fileUrl: string;
  if (isR2Configured()) {
    fileUrl = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype);
  } else {
    const dir = path.resolve(env.uploadDir);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const fname = `${Date.now()}-${req.file.originalname}`;
    fs.writeFileSync(path.join(dir, fname), req.file.buffer);
    fileUrl = `/uploads/${fname}`;
  }

  // Upsert: uma obra tem um cronograma ativo por vez
  const existing = await prisma.cronograma.findFirst({ where: { obraId } });
  const cronograma = existing
    ? await prisma.cronograma.update({
        where: { id: existing.id },
        data: { fileUrl, fileName: req.file.originalname, parsedAt: null, parsedData: undefined, progressPct: null },
      })
    : await prisma.cronograma.create({
        data: { obraId, fileUrl, fileName: req.file.originalname },
      });

  return res.json({ data: cronograma });
}

export async function parseCronograma(req: Request, res: Response) {
  const { id: obraId } = req.params;
  console.log(`[PARSE] start obra=${obraId}`);
  const cronograma = await prisma.cronograma.findFirst({ where: { obraId } });
  if (!cronograma) {
    console.log(`[PARSE] sem cronograma obra=${obraId}`);
    return res.status(404).json({ error: { message: 'Nenhum cronograma encontrado para esta obra' } });
  }
  console.log(`[PARSE] obra=${obraId} fileUrl=${cronograma.fileUrl.slice(0, 80)}`);

  let pdfBuffer: Buffer;
  try {
    if (cronograma.fileUrl.startsWith('http')) {
      const resp = await fetch(cronograma.fileUrl);
      if (!resp.ok) throw new Error(`Falha ao baixar PDF (${resp.status})`);
      pdfBuffer = Buffer.from(await resp.arrayBuffer());
      console.log(`[PARSE] PDF baixado: ${pdfBuffer.length} bytes`);
    } else {
      pdfBuffer = fs.readFileSync(path.resolve(env.uploadDir, cronograma.fileUrl.replace('/uploads/', '')));
    }
  } catch (err) {
    console.error(`[PARSE] erro download:`, err);
    return res.status(500).json({ error: { message: `Erro ao baixar PDF: ${(err as Error).message}` } });
  }

  const { parseCronogramaPDF } = await import('../../services/cronograma-parser');
  let parsed;
  try {
    parsed = await parseCronogramaPDF(pdfBuffer);
    console.log(`[PARSE] Gemini OK: ${parsed.tarefas.length} tarefas`);
  } catch (err) {
    console.error(`[PARSE] erro Gemini:`, err);
    return res.status(500).json({ error: { message: (err as Error).message } });
  }

  const leaf = parsed.tarefas.filter(t => !t.ehResumo && (t.duracaoDias ?? 0) > 0);
  const totalDias = leaf.reduce((s, t) => s + (t.duracaoDias ?? 0), 0);
  const progressPct = totalDias > 0
    ? Math.round(leaf.reduce((s, t) => s + (t.duracaoDias ?? 0) * t.percentualConcluido / 100, 0) / totalDias * 100)
    : 0;

  const updated = await prisma.cronograma.update({
    where: { id: cronograma.id },
    data: {
      parsedAt: new Date(),
      parsedData: parsed as unknown as import('@prisma/client').Prisma.InputJsonValue,
      progressPct,
    },
  });
  console.log(`[PARSE] OK obra=${obraId} pct=${progressPct} tarefas=${parsed.tarefas.length}`);

  return res.json({ data: { id: updated.id, parsedAt: updated.parsedAt, progressPct, numTarefas: parsed.tarefas.length } });
}

export async function syncToKanban(req: Request, res: Response) {
  const { id: obraId } = req.params;
  const cronograma = await prisma.cronograma.findFirst({ where: { obraId } });
  if (!cronograma?.parsedData) {
    return res.status(400).json({ error: { message: 'Processe o cronograma antes de sincronizar' } });
  }

  const parsed = cronograma.parsedData as unknown as {
    progressoGeral: number;
    tarefas: {
      wbs: string; nome: string; inicio: string | null; fim: string | null;
      percentualConcluido: number; ehResumo: boolean; nivel: number;
    }[];
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Leaf tasks only (non-summary)
  const leafTasks = parsed.tarefas.filter((t) => !t.ehResumo);

  let created = 0;
  let updated = 0;

  for (const t of leafTasks) {
    const fim = t.fim ? new Date(t.fim) : null;
    const inicio = t.inicio ? new Date(t.inicio) : null;

    let status: string;
    if (t.percentualConcluido >= 100) {
      status = 'done';
    } else if (inicio && inicio <= today) {
      status = 'in_progress';
    } else if (inicio && inicio <= weekEnd) {
      status = 'in_progress';
    } else {
      status = 'todo';
    }

    const existing = await prisma.obraTask.findFirst({
      where: { obraId, cronogramaRef: t.wbs || t.nome },
      select: { id: true, completedAt: true },
    });

    const completedAt = status === 'done' ? (fim ?? new Date()) : null;

    if (existing) {
      await prisma.obraTask.update({
        where: { id: existing.id },
        data: {
          title: t.nome,
          status,
          dueDate: fim,
          ...(status === 'done' && !existing.completedAt ? { completedAt: completedAt! } : {}),
          ...(status !== 'done' ? { completedAt: null } : {}),
        },
      });
      updated++;
    } else {
      const maxPos = await prisma.obraTask.aggregate({
        where: { obraId, status },
        _max: { position: true },
      });
      await prisma.obraTask.create({
        data: {
          obraId,
          title: t.nome,
          status,
          priority: 'medium',
          dueDate: fim,
          cronogramaRef: t.wbs || t.nome,
          position: (maxPos._max.position ?? -1) + 1,
          completedAt,
        },
      });
      created++;
    }
  }

  // Atualizar progresso da obra
  await prisma.obra.update({
    where: { id: obraId },
    data: { progressPercent: parsed.progressoGeral },
  });

  return res.json({ data: { created, updated, progressoGeral: parsed.progressoGeral } });
}

export async function updateTaskOverride(req: Request, res: Response) {
  const { id: obraId, ref } = req.params;
  const cronograma = await prisma.cronograma.findFirst({ where: { obraId } });
  if (!cronograma) return res.status(404).json({ error: { message: 'Cronograma não encontrado' } });

  const { pct, inicioRealizado, fimRealizado, observacao } = req.body as {
    pct?: number; inicioRealizado?: string | null; fimRealizado?: string | null; observacao?: string;
  };

  const overrides = ((cronograma.overrides ?? {}) as Record<string, Record<string, unknown>>);
  overrides[ref] = { ...(overrides[ref] ?? {}) };
  if (pct !== undefined) overrides[ref].pct = Math.min(100, Math.max(0, pct));
  if ('inicioRealizado' in req.body) overrides[ref].inicioRealizado = inicioRealizado ?? null;
  if ('fimRealizado' in req.body) overrides[ref].fimRealizado = fimRealizado ?? null;
  if ('observacao' in req.body) overrides[ref].observacao = observacao ?? '';

  // Recalculate progressPct from parsedData + overrides
  const parsed = cronograma.parsedData as {
    tarefas: { wbs: string; nome: string; duracaoDias: number | null; percentualConcluido: number; ehResumo: boolean }[];
  } | null;
  let progressPct = cronograma.progressPct;
  if (parsed?.tarefas) {
    const leaf = parsed.tarefas.filter((t) => !t.ehResumo && (t.duracaoDias ?? 0) > 0);
    const total = leaf.reduce((s, t) => s + (t.duracaoDias ?? 0), 0);
    if (total > 0) {
      const completed = leaf.reduce((s, t) => {
        const key = t.wbs || t.nome;
        const ov = overrides[key] as { pct?: number } | undefined;
        const taskPct = ov?.pct !== undefined ? ov.pct : t.percentualConcluido;
        return s + (t.duracaoDias ?? 0) * taskPct / 100;
      }, 0);
      progressPct = Math.round(completed / total * 100);
    }
  }

  const updated = await prisma.cronograma.update({
    where: { id: cronograma.id },
    data: { overrides: overrides as import('@prisma/client').Prisma.InputJsonValue, progressPct },
  });

  return res.json({ data: updated });
}

export async function deleteCronograma(req: Request, res: Response) {
  const { id: obraId } = req.params;
  await prisma.cronograma.deleteMany({ where: { obraId } });
  return res.json({ data: { ok: true } });
}
