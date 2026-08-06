import { Request, Response } from 'express';
import * as service from './service';
import { sendSuccess, sendCreated } from '../../utils/response';

export async function listFeriados(req: Request, res: Response) {
  const ano = req.query.ano ? Number(req.query.ano) : undefined;
  sendSuccess(res, await service.listFeriados(ano));
}

export async function createFeriado(req: Request, res: Response) {
  sendCreated(res, await service.createFeriado(req.body));
}

export async function updateFeriado(req: Request, res: Response) {
  sendSuccess(res, await service.updateFeriado(req.params.id, req.body));
}

export async function removeFeriado(req: Request, res: Response) {
  await service.removeFeriado(req.params.id);
  sendSuccess(res, { ok: true });
}

export async function upsertAjuste(req: Request, res: Response) {
  sendCreated(res, await service.upsertAjuste(req.body, req.user!.userId));
}

export async function listAjustes(req: Request, res: Response) {
  const { startDate, endDate, userId } = req.query as { startDate: string; endDate: string; userId?: string };
  sendSuccess(res, await service.listAjustes(startDate, endDate, userId));
}

export async function calcularDia(req: Request, res: Response) {
  const { userId, data } = req.query as { userId: string; data: string };
  sendSuccess(res, await service.calcularDia(userId, data));
}

export async function processar(req: Request, res: Response) {
  const { startDate, endDate, userId } = req.body;
  sendSuccess(res, await service.processarPeriodo(startDate, endDate, userId));
}

export async function consumir(req: Request, res: Response) {
  sendCreated(res, await service.consumir(req.body, req.user!.userId));
}

export async function painel(_req: Request, res: Response) {
  sendSuccess(res, await service.painel());
}

export async function lotesPorUsuario(req: Request, res: Response) {
  sendSuccess(res, await service.lotesPorUsuario(req.params.userId));
}

export async function listExtras(req: Request, res: Response) {
  const pago = req.query.pago === undefined ? undefined : req.query.pago === 'true';
  sendSuccess(res, await service.listExtras(pago));
}

export async function marcarExtraPago(req: Request, res: Response) {
  sendSuccess(res, await service.marcarExtraPago(req.params.id, req.body.pago));
}
