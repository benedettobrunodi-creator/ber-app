import { Request, Response } from 'express';
import * as service from './service';
import { sendSuccess, sendCreated } from '../../utils/response';
import { AppError } from '../../utils/errors';

export async function listKeys(req: Request, res: Response) {
  const keys = await service.list(req.user!.userId);
  sendSuccess(res, keys);
}

export async function createKey(req: Request, res: Response) {
  const { name } = req.body;
  if (!name?.trim()) throw AppError.badRequest('Nome é obrigatório');
  const raw = await service.create(req.user!.userId, name.trim());
  sendCreated(res, { key: raw, message: 'Guarde esta chave — ela não será exibida novamente.' });
}

export async function revokeKey(req: Request, res: Response) {
  await service.revoke(req.params.id, req.user!.userId);
  sendSuccess(res, { ok: true });
}
