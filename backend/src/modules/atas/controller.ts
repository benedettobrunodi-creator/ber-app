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

export async function addAtualizacao(req: Request, res: Response) {
  const data = await service.addAtualizacao(req.params.topicoId, req.body);
  res.status(201).json({ data });
}

export async function updateAtualizacao(req: Request, res: Response) {
  const data = await service.updateAtualizacao(req.params.atualizacaoId, req.body);
  res.json({ data });
}

export async function removeAtualizacao(req: Request, res: Response) {
  await service.removeAtualizacao(req.params.atualizacaoId);
  res.status(204).end();
}
