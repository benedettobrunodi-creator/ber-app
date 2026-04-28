import { Request, Response } from 'express';
import * as service from './service';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';

export async function list(_req: Request, res: Response) {
  const data = await service.listRecursosExternos();
  sendSuccess(res, data);
}

export async function create(req: Request, res: Response) {
  const data = await service.createRecursoExterno(req.body, req.user!.userId);
  sendCreated(res, data);
}

export async function remove(req: Request, res: Response) {
  await service.deleteRecursoExterno(req.params.id);
  sendNoContent(res);
}
