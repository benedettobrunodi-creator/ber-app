import { Request, Response } from 'express';
import * as service from './service';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';

export async function list(_req: Request, res: Response) {
  const data = await service.listAlocacoes();
  sendSuccess(res, data);
}

export async function listConflitos(_req: Request, res: Response) {
  const data = await service.listConflitos();
  sendSuccess(res, data);
}

export async function create(req: Request, res: Response) {
  const data = await service.createAlocacao(req.body);
  sendCreated(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await service.updateAlocacao(req.params.id, req.body);
  sendSuccess(res, data);
}

export async function remove(req: Request, res: Response) {
  await service.deleteAlocacao(req.params.id);
  sendNoContent(res);
}
