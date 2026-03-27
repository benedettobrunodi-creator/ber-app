import { Request, Response } from 'express';
import * as touchpointService from './service';
import { sendSuccess, sendCreated, sendPaginated, parsePagination, buildPagination } from '../../utils/response';

export async function listByObra(req: Request, res: Response) {
  const { page, limit } = parsePagination(req.query as any);
  const obraId = req.params.id || req.params.obraId;
  const { touchpoints, total } = await touchpointService.listByObra(obraId, page, limit);
  sendPaginated(res, touchpoints, buildPagination(page, limit, total));
}

export async function createTouchpoint(req: Request, res: Response) {
  const obraId = req.params.id || req.params.obraId;
  const touchpoint = await touchpointService.createTouchpoint(obraId, req.user!.userId, req.body);
  sendCreated(res, touchpoint);
}

export async function updateTouchpoint(req: Request, res: Response) {
  const touchpoint = await touchpointService.updateTouchpoint(req.params.id, req.body);
  sendSuccess(res, touchpoint);
}

export async function getPendingActions(req: Request, res: Response) {
  const { page, limit } = parsePagination(req.query as any);
  const { touchpoints, total } = await touchpointService.getPendingActions(page, limit);
  sendPaginated(res, touchpoints, buildPagination(page, limit, total));
}
