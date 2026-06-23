import { Request, Response } from 'express';
import * as service from './service';

export async function issue(req: Request, res: Response) {
  const data = await service.issueAcesso(req.params.obraId, req.body);
  res.status(201).json({ data });
}
export async function listAcessos(req: Request, res: Response) {
  const data = await service.listAcessosByObra(req.params.obraId);
  res.json({ data });
}
export async function revogar(req: Request, res: Response) {
  await service.revogarAcesso(req.params.id);
  res.status(204).end();
}
export async function getPortal(req: Request, res: Response) {
  const data = await service.getMedicaoPorToken(req.params.token);
  res.json({ data });
}
export async function aprovar(req: Request, res: Response) {
  const data = await service.clienteAprovar(req.params.token, req.body);
  res.json({ data });
}
export async function contestar(req: Request, res: Response) {
  const data = await service.clienteContestar(req.params.token, req.body);
  res.json({ data });
}
