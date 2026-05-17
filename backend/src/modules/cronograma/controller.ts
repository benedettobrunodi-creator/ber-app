import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { uploadToR2, isR2Configured } from '../../services/storage';
import { parseCronogramaPDF } from '../../services/cronograma-parser';
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
  try {
    const cronograma = await prisma.cronograma.findFirst({ where: { obraId } });
    if (!cronograma) return res.status(404).json({ error: { message: 'Nenhum cronograma enviado' } });

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: { message: 'ANTHROPIC_API_KEY não configurada' } });
    }

    // Fetch PDF bytes
    let pdfBuffer: Buffer;
    if (cronograma.fileUrl.startsWith('http')) {
      const response = await fetch(cronograma.fileUrl);
      if (!response.ok) throw new Error(`Falha ao baixar PDF: ${response.status} ${response.statusText}`);
      pdfBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      const localPath = path.resolve(env.uploadDir, path.basename(cronograma.fileUrl));
      pdfBuffer = fs.readFileSync(localPath);
    }

    const result = await parseCronogramaPDF(pdfBuffer);

    const updated = await prisma.cronograma.update({
      where: { id: cronograma.id },
      data: {
        parsedAt: new Date(),
        parsedData: result as unknown as import('@prisma/client').Prisma.JsonObject,
        progressPct: result.progressoGeral,
      },
    });

    return res.json({ data: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[CRONOGRAMA PARSE ERROR]', msg);
    return res.status(500).json({ error: { message: msg } });
  }
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
    if (t.percentualConcluido >= 100 || (fim && fim < today)) {
      status = 'done';
    } else if (inicio && inicio <= weekEnd && (!fim || fim >= today)) {
      status = 'in_progress';
    } else if (inicio && inicio <= today) {
      status = 'in_progress';
    } else {
      status = 'todo';
    }

    const existing = await prisma.obraTask.findFirst({
      where: { obraId, cronogramaRef: t.wbs || t.nome },
    });

    if (existing) {
      await prisma.obraTask.update({
        where: { id: existing.id },
        data: {
          title: t.nome,
          status,
          dueDate: fim,
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

export async function deleteCronograma(req: Request, res: Response) {
  const { id: obraId } = req.params;
  await prisma.cronograma.deleteMany({ where: { obraId } });
  return res.json({ data: { ok: true } });
}
