import { Request, Response } from 'express';
import * as service from './service';

export async function list(req: Request, res: Response) {
  const tipo = typeof req.query.tipo === 'string' ? req.query.tipo : undefined;
  const data = await service.listByObra(req.params.obraId, tipo);
  res.json({ data });
}

export async function getOne(req: Request, res: Response) {
  const data = await service.getOne(req.params.id);
  res.json({ data });
}

export async function create(req: Request, res: Response) {
  const data = await service.create(req.params.obraId, req.body, req.user?.userId);
  res.status(201).json({ data });
}

export async function update(req: Request, res: Response) {
  const data = await service.update(req.params.id, req.body);
  res.json({ data });
}

export async function addPendencia(req: Request, res: Response) {
  const data = await service.addPendencia(req.params.id, req.body, req.user?.userId);
  res.status(201).json({ data });
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.id);
  res.status(204).end();
}
