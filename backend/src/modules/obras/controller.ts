import { Request, Response } from 'express';
import * as obraService from './service';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated, parsePagination, buildPagination } from '../../utils/response';

export async function listObras(req: Request, res: Response) {
  const { page, limit } = parsePagination(req.query as any);
  const status = req.query.status as string | undefined;
  const { obras, total } = await obraService.listObras(page, limit, status, req.user!.userId, req.user!.role);
  sendPaginated(res, obras, buildPagination(page, limit, total));
}

export async function getObra(req: Request, res: Response) {
  const obra = await obraService.getObraById(req.params.id);
  sendSuccess(res, obra);
}

export async function createObra(req: Request, res: Response) {
  const obra = await obraService.createObra(req.body);
  sendCreated(res, obra);
}

export async function updateObra(req: Request, res: Response) {
  const obra = await obraService.updateObra(req.params.id, req.body);
  sendSuccess(res, obra);
}

export async function getMembers(req: Request, res: Response) {
  const members = await obraService.getMembers(req.params.id);
  sendSuccess(res, members);
}

export async function addMember(req: Request, res: Response) {
  const member = await obraService.addMember(req.params.id, req.body);
  sendCreated(res, member);
}

export async function removeMember(req: Request, res: Response) {
  await obraService.removeMember(req.params.id, req.params.userId);
  sendNoContent(res);
}

export async function getStats(req: Request, res: Response) {
  const stats = await obraService.getStats(req.params.id);
  sendSuccess(res, stats);
}
