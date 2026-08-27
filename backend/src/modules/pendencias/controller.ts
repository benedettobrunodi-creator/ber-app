import { Request, Response } from 'express';
import * as service from './service';
import { sendSuccess, sendCreated } from '../../utils/response';
import { uploadToR2, isR2Configured } from '../../services/storage';
import { AppError } from '../../utils/errors';

export async function listByObra(req: Request, res: Response) {
  const { status, tipo } = req.query as { status?: string; tipo?: string };
  const pendencias = await service.listByObra(req.params.id, { status, tipo });
  sendSuccess(res, pendencias);
}

export async function resumoByObra(req: Request, res: Response) {
  sendSuccess(res, await service.resumoByObra(req.params.id));
}

export async function create(req: Request, res: Response) {
  const pendencia = await service.create(req.params.id, req.user!.userId, req.body);
  sendCreated(res, pendencia);
}

export async function update(req: Request, res: Response) {
  sendSuccess(res, await service.update(req.params.pendenciaId, req.body));
}

export async function mudarStatus(req: Request, res: Response) {
  sendSuccess(res, await service.mudarStatus(req.params.pendenciaId, req.body));
}

/**
 * Upload da foto (abertura ou conclusão). Fotos ficam em resolução original
 * ("nítidas, tamanhos bons" — decisão do Bruno): sem resize/compressão.
 */
export async function uploadFoto(req: Request, res: Response) {
  const tipo = req.params.tipo as 'abertura' | 'conclusao';
  if (tipo !== 'abertura' && tipo !== 'conclusao') {
    throw AppError.badRequest('Tipo de foto inválido (abertura|conclusao)');
  }
  const file = req.file;
  if (!file) throw AppError.badRequest('Envie o arquivo da foto (campo "file")');
  if (!isR2Configured()) throw AppError.badRequest('Storage de fotos não configurado no servidor');
  const url = await uploadToR2(file.buffer, `pendencias/${req.params.pendenciaId}-${tipo}-${file.originalname}`, file.mimetype);
  sendSuccess(res, await service.setFoto(req.params.pendenciaId, tipo, url));
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.pendenciaId);
  sendSuccess(res, { ok: true });
}
