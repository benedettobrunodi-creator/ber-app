import { Request, Response } from 'express';
import * as service from './service';
import { AppError } from '../../utils/errors';

export async function list(req: Request, res: Response) {
  const data = await service.listByObra(req.params.obraId);
  res.json({ data });
}

export async function getOne(req: Request, res: Response) {
  const data = await service.getOne(req.params.id);
  res.json({ data });
}

export async function create(req: Request, res: Response) {
  const data = await service.create(req.params.obraId, req.body);
  res.status(201).json({ data });
}

export async function update(req: Request, res: Response) {
  const data = await service.update(req.params.id, req.body);
  res.json({ data });
}

export async function decide(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  const data = await service.decide(req.params.id, req.body, req.user.userId);
  res.json({ data });
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id);
  res.status(204).end();
}
