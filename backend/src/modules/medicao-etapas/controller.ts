import { Request, Response } from 'express';
import * as service from './service';

export async function list(req: Request, res: Response) {
  const data = await service.listByObra(req.params.obraId);
  res.json({ data });
}
export async function getOne(req: Request, res: Response) {
  const data = await service.getById(req.params.id);
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
export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id);
  res.status(204).end();
}
export async function reordenar(req: Request, res: Response) {
  await service.reordenar(req.params.obraId, req.body);
  res.status(204).end();
}
