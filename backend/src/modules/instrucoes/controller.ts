import { Request, Response } from 'express';
import * as service from './service';
import { sendSuccess, sendCreated } from '../../utils/response';

export async function list(req: Request, res: Response) {
  const data = await service.list({
    discipline: req.query.discipline as string | undefined,
    search: req.query.search as string | undefined,
  });
  sendSuccess(res, data);
}

export async function getById(req: Request, res: Response) {
  const data = await service.getById(req.params.id);
  sendSuccess(res, data);
}

export async function create(req: Request, res: Response) {
  const data = await service.create(req.user!.userId, req.body);
  sendCreated(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await service.update(req.params.id, req.user!.userId, req.body);
  sendSuccess(res, data);
}

export async function publish(req: Request, res: Response) {
  const data = await service.publish(req.params.id, req.user!.userId, req.body.status);
  sendSuccess(res, data);
}
