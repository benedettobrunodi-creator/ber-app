import { Request, Response } from 'express';
import * as service from './service';

export async function listFornecedores(req: Request, res: Response) {
  const data = await service.listFornecedoresByObra(req.params.obraId);
  res.json({ data });
}
export async function createFornecedor(req: Request, res: Response) {
  const data = await service.createFornecedor(req.params.obraId, req.body);
  res.status(201).json({ data });
}
export async function updateFornecedor(req: Request, res: Response) {
  const data = await service.updateFornecedor(req.params.id, req.body);
  res.json({ data });
}
export async function removeFornecedor(req: Request, res: Response) {
  await service.removeFornecedor(req.params.id);
  res.status(204).end();
}

export async function quickAdd(req: Request, res: Response) {
  const data = await service.quickAdd(req.params.etapaId, req.body);
  res.status(201).json({ data });
}
export async function updateEtapaFornecedor(req: Request, res: Response) {
  const data = await service.updateEtapaFornecedor(req.params.id, req.body);
  res.json({ data });
}
export async function removeEtapaFornecedor(req: Request, res: Response) {
  await service.removeEtapaFornecedor(req.params.id);
  res.status(204).end();
}
