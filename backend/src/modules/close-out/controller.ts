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
