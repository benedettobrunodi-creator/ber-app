import { Request, Response } from 'express';
import * as service from './service';
import { AppError } from '../../utils/errors';

export async function upload(req: Request, res: Response) {
  const { entityType, entityId } = req.body as { entityType?: string; entityId?: string };
  if (!entityType || !entityId) throw AppError.badRequest('entityType e entityId são obrigatórios');
  if (!req.file) throw AppError.badRequest('Arquivo ausente (campo "file")');

  const att = await service.createAttachment({
    entityType,
    entityId,
    file: req.file,
    uploadedById: req.user?.userId,
  });
  res.status(201).json({ data: att });
}

export async function list(req: Request, res: Response) {
  const { entityType, entityId } = req.query as { entityType?: string; entityId?: string };
  if (!entityType || !entityId) throw AppError.badRequest('entityType e entityId são obrigatórios');
  const data = await service.listAttachments(entityType, entityId);
  res.json({ data });
}

export async function remove(req: Request, res: Response) {
  await service.deleteAttachment(req.params.id);
  res.status(204).end();
}
