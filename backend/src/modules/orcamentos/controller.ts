import { Request, Response } from 'express';
import * as service from './service';
import { sendSuccess, sendCreated } from '../../utils/response';
import { AppError } from '../../utils/errors';

const WRITE_ROLES = ['diretoria', 'coordenacao', 'pmo', 'engenharia', 'financeiro', 'orcamentos', 'compras'];

function assertCanWrite(req: Request) {
  if (!WRITE_ROLES.includes(req.user!.role)) {
    throw AppError.forbidden('Apenas admin e comercial podem modificar orçamentos');
  }
}

export async function listOrcamentos(req: Request, res: Response) {
  const items = await service.list(req.query as any);
  sendSuccess(res, items);
}

export async function getTimeline(_req: Request, res: Response) {
  const items = await service.timeline();
  sendSuccess(res, items);
}

export async function getOrcamento(req: Request, res: Response) {
  const item = await service.getById(req.params.id);
  sendSuccess(res, item);
}

export async function createOrcamento(req: Request, res: Response) {
  assertCanWrite(req);
  const item = await service.create(req.user!.userId, req.body);
  sendCreated(res, item);
}

export async function updateOrcamento(req: Request, res: Response) {
  assertCanWrite(req);
  const item = await service.update(req.params.id, req.user!.email, req.body);
  sendSuccess(res, item);
}

export async function deleteOrcamento(req: Request, res: Response) {
  await service.remove(req.params.id);
  sendSuccess(res, { ok: true });
}

export async function duplicarOrcamento(req: Request, res: Response) {
  assertCanWrite(req);
  const item = await service.duplicar(req.params.id, req.user!.userId);
  sendCreated(res, item);
}

export async function reorderOrcamentos(req: Request, res: Response) {
  assertCanWrite(req);
  const { idA, idB } = req.body;
  if (!idA || !idB) throw AppError.badRequest('idA e idB são obrigatórios');
  await service.reorder(idA, idB);
  sendSuccess(res, { ok: true });
}

export async function getStats(_req: Request, res: Response) {
  const data = await service.stats();
  sendSuccess(res, data);
}
