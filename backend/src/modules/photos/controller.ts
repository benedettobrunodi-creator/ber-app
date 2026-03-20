import { Request, Response } from 'express';
import * as photoService from './service';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated, parsePagination, buildPagination } from '../../utils/response';

export async function listPhotos(req: Request, res: Response) {
  const { page, limit } = parsePagination(req.query as any);
  const { photos, total } = await photoService.listPhotos(req.params.obraId, page, limit);
  sendPaginated(res, photos, buildPagination(page, limit, total));
}

export async function uploadPhoto(req: Request, res: Response) {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: { code: 'NO_FILE', message: 'Nenhum arquivo enviado' } });
  }

  // In production, upload to S3/R2 and get URL
  // For now, use local path
  const imageUrl = `/uploads/${file.filename}`;
  const caption = req.body.caption;

  const photo = await photoService.createPhoto(req.params.obraId, req.user!.userId, imageUrl, caption);
  sendCreated(res, photo);
}

export async function deletePhoto(req: Request, res: Response) {
  await photoService.deletePhoto(req.params.id, req.user!.userId, req.user!.role);
  sendNoContent(res);
}

export async function listComments(req: Request, res: Response) {
  const comments = await photoService.listComments(req.params.id);
  sendSuccess(res, comments);
}

export async function createComment(req: Request, res: Response) {
  const comment = await photoService.createComment(req.params.id, req.user!.userId, req.body.body);
  sendCreated(res, comment);
}
