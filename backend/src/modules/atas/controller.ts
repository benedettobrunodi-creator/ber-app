import { Request, Response } from 'express';
import * as service from './service';

export async function getAta(req: Request, res: Response) {
  const data = await service.getAtaCorrida(req.params.obraId);
  res.json({ data });
}

export async function createTopico(req: Request, res: Response) {
  const data = await service.createTopico(req.params.obraId, req.body);
  res.status(201).json({ data });
}

export async function updateTopico(req: Request, res: Response) {
  const data = await service.updateTopico(req.params.topicoId, req.body);
  res.json({ data });
}

export async function removeTopico(req: Request, res: Response) {
  await service.removeTopico(req.params.topicoId);
  res.status(204).end();
}

export async function reorderTopicos(req: Request, res: Response) {
  const data = await service.reorderTopicos(req.params.obraId, req.body.ordem);
  res.json({ data });
}

export async function createReuniao(req: Request, res: Response) {
  const data = await service.createReuniao(req.params.obraId, req.body);
  res.status(201).json({ data });
}

export async function removeReuniao(req: Request, res: Response) {
  await service.removeReuniao(req.params.reuniaoId);
  res.status(204).end();
}

export async function upsertNota(req: Request, res: Response) {
  const data = await service.upsertNota(req.body);
  res.json({ data });
}
