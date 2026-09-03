import { Request, Response } from 'express';
import * as service from './service';
import { QUALIDADE_CHECKLIST } from './template';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';

export async function template(_req: Request, res: Response) {
  sendSuccess(res, QUALIDADE_CHECKLIST);
}

export async function painel(req: Request, res: Response) {
  sendSuccess(res, await service.getPainel(req.params.id));
}

export async function atividadesCatalogo(_req: Request, res: Response) {
  sendSuccess(res, await service.listAtividadesCatalogo());
}

export async function create(req: Request, res: Response) {
  sendCreated(res, await service.createVistoria(req.params.id, req.body, req.user!.userId));
}

export async function getOne(req: Request, res: Response) {
  sendSuccess(res, await service.getVistoria(req.params.vistoriaId));
}

export async function resolverPendencia(req: Request, res: Response) {
  sendSuccess(res, await service.resolverPendencia(req.params.itemId, req.user!.userId, req.body.resolvido));
}

export async function uploadFoto(req: Request, res: Response) {
  if (!req.file) {
    res.status(400).json({ error: { message: 'Envie a foto no campo "file"' } });
    return;
  }
  sendSuccess(res, await service.uploadFotoItem(req.params.itemId, req.file));
}

export async function remove(req: Request, res: Response) {
  await service.removeVistoria(req.params.vistoriaId);
  sendNoContent(res);
}
