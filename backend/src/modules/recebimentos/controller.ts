import { Request, Response } from 'express';
import * as service from './service';
import { sendSuccess, sendCreated } from '../../utils/response';

export async function listByObra(req: Request, res: Response) {
  const data = await service.listByObra(req.params.id);
  sendSuccess(res, data);
}

export async function getById(req: Request, res: Response) {
  const data = await service.getById(req.params.id);
  sendSuccess(res, data);
}

export async function create(req: Request, res: Response) {
  const data = await service.create(req.params.id, req.user!.userId, req.body);
  sendCreated(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await service.update(req.params.id, req.body);
  sendSuccess(res, data);
}
