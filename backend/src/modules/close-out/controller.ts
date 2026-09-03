import { Request, Response } from 'express';
import * as service from './service';
import { sendSuccess, sendCreated } from '../../utils/response';
import { uploadToR2, isR2Configured } from '../../services/storage';
import { AppError } from '../../utils/errors';

export async function listByObra(req: Request, res: Response) {
  sendSuccess(res, await service.listByObra(req.params.id));
}

export async function aplicarPadrao(req: Request, res: Response) {
  sendSuccess(res, await service.aplicarChecklistPadrao(req.params.id));
}

export async function create(req: Request, res: Response) {
  sendCreated(res, await service.create(req.params.id, req.body));
}

export async function update(req: Request, res: Response) {
  sendSuccess(res, await service.update(req.params.itemId, req.body));
}

export async function uploadArquivo(req: Request, res: Response) {
  const file = req.file;
  if (!file) throw AppError.badRequest('Envie o arquivo (campo "file")');
  if (!isR2Configured()) throw AppError.badRequest('Storage não configurado no servidor');
  const url = await uploadToR2(file.buffer, `close-out/${req.params.itemId}-${file.originalname}`, file.mimetype);
  sendSuccess(res, await service.setArquivo(req.params.itemId, url, file.originalname));
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.itemId);
  sendSuccess(res, { ok: true });
}

export async function manual(req: Request, res: Response) {
  sendSuccess(res, await service.manualData(req.params.id));
}

// ─── Manual do Proprietário digital (03/09/26) ───

export async function getManualProprietario(req: Request, res: Response) {
  const mp = await import('./manual-proprietario');
  sendSuccess(res, await mp.getManual(req.params.id));
}

export async function updateManualProprietario(req: Request, res: Response) {
  const mp = await import('./manual-proprietario');
  const parsed = mp.updateManualSchema.safeParse(req.body);
  if (!parsed.success) throw AppError.badRequest('Dados inválidos do manual');
  sendSuccess(res, await mp.updateManual(req.params.id, parsed.data));
}

export async function uploadArquivoManualProprietario(req: Request, res: Response) {
  if (!req.file) throw AppError.badRequest('Envie o arquivo (campo "file")');
  const mp = await import('./manual-proprietario');
  sendSuccess(res, await mp.uploadArquivoManual(req.params.id, req.file));
}

export async function gerarPdfManualProprietario(req: Request, res: Response) {
  const React = await import('react');
  const { renderToBuffer } = await import('@react-pdf/renderer');
  const mp = await import('./manual-proprietario');
  const { ManualProprietarioPdf } = await import('./manual-pdf');

  const { manual, auto } = await mp.getManual(req.params.id);
  const buffer = await renderToBuffer(
    React.createElement(ManualProprietarioPdf, {
      data: {
        obra: auto.obra,
        manual: manual as never,
        projetos: auto.projetos,
      },
    }) as never,
  );

  const slug = (auto.obra.name || 'obra').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="manual-do-proprietario-${slug}.pdf"`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.send(buffer);
}
