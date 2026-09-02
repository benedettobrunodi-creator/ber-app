import { Request, Response } from 'express';
import * as React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';
import * as service from './service';
import { RecebimentoPDF } from './recebimento-pdf';

export async function getRelatorio(req: Request, res: Response) {
  sendSuccess(res, await service.getOrCreate(req.params.id, req.user!.userId));
}

export async function patchRelatorio(req: Request, res: Response) {
  sendSuccess(res, await service.updateRelatorio(req.params.relatorioId, req.body ?? {}));
}

export async function uploadFotos(req: Request, res: Response) {
  const files = (req as Request & { files?: { buffer: Buffer; originalname: string; mimetype: string }[] }).files;
  if (!files?.length) throw AppError.badRequest('Envie ao menos uma foto');
  sendSuccess(res, await service.addFotos(req.params.relatorioId, files), 201);
}

export async function patchFoto(req: Request, res: Response) {
  sendSuccess(res, await service.updateFoto(req.params.fotoId, req.body ?? {}));
}

export async function removeFoto(req: Request, res: Response) {
  await service.deleteFoto(req.params.fotoId);
  sendSuccess(res, { ok: true });
}

export async function createAmbiente(req: Request, res: Response) {
  sendSuccess(res, await service.addAmbiente(req.params.relatorioId, String(req.body?.nome ?? '')), 201);
}

export async function patchAmbiente(req: Request, res: Response) {
  sendSuccess(res, await service.updateAmbiente(req.params.ambienteId, req.body ?? {}));
}

export async function removeAmbiente(req: Request, res: Response) {
  await service.deleteAmbiente(req.params.ambienteId);
  sendSuccess(res, { ok: true });
}

export async function sugerirLegenda(req: Request, res: Response) {
  sendSuccess(res, await service.sugerirLegenda(req.params.fotoId));
}

export async function downloadPdf(req: Request, res: Response) {
  const rel = await prisma.recebimentoRelatorio.findUnique({
    where: { id: req.params.relatorioId },
    include: {
      obra: { select: { name: true, client: true, address: true } },
      responsavel: { select: { name: true } },
      ambientes: { orderBy: { ordem: 'asc' }, include: { fotos: { orderBy: { ordem: 'asc' } } } },
    },
  });
  if (!rel) throw AppError.notFound('Relatório');

  const ambientes = rel.ambientes
    .filter(a => a.fotos.length > 0)
    .map(a => ({
      nome: a.nome,
      fotos: a.fotos.map(f => ({ url: f.url, legenda: f.legenda, patologia: f.patologia })),
    }));
  if (ambientes.length === 0) throw AppError.badRequest('Nenhuma foto atribuída a ambientes ainda — organize as fotos antes de gerar o PDF.');

  const buffer = await renderToBuffer(
    React.createElement(RecebimentoPDF, {
      obraNome: rel.obra.name,
      obraTipo: null,
      endereco: rel.obra.address,
      cliente: rel.obra.client,
      responsavel: rel.responsavel?.name ?? null,
      dataVistoria: rel.dataVistoria,
      objetivo: rel.objetivo,
      ambientes,
    }) as never,
  );

  const slug = (rel.obra.name || 'obra').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="relatorio-recebimento-${slug}.pdf"`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.send(buffer);
}
