import { Request, Response } from 'express';
import * as service from './service';

export async function list(req: Request, res: Response) {
  const data = await service.listByObra(req.params.obraId);
  res.json({ data });
}
export async function getDetail(req: Request, res: Response) {
  const data = await service.getDetail(req.params.id);
  res.json({ data });
}
export async function create(req: Request, res: Response) {
  const data = await service.create(req.params.obraId, req.user?.userId ?? null, req.body);
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
export async function transition(req: Request, res: Response) {
  const data = await service.transition(req.params.id, req.user?.userId ?? null, req.body);
  res.json({ data });
}
export async function updateItem(req: Request, res: Response) {
  const data = await service.updateItem(req.params.id, req.body);
  res.json({ data });
}
export async function upsertPagamentoDireto(req: Request, res: Response) {
  const data = await service.upsertPagamentoDireto(req.params.id, req.body);
  res.json({ data });
}
