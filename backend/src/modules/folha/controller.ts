import { Request, Response } from 'express';
import * as service from './service';
import { sendSuccess } from '../../utils/response';

export async function preview(req: Request, res: Response) {
  sendSuccess(res, await service.previewFechamento(String(req.query.competencia ?? '')));
}

export async function fechar(req: Request, res: Response) {
  sendSuccess(res, await service.fecharMes(String(req.body?.competencia ?? ''), req.user!.userId, req.body?.observacoes));
}

export async function reabrir(req: Request, res: Response) {
  sendSuccess(res, await service.reabrirMes(String(req.body?.competencia ?? ''), req.user!.userId));
}

export async function list(_req: Request, res: Response) {
  sendSuccess(res, await service.listFechamentos());
}

export async function exportCsv(req: Request, res: Response) {
  const competencia = String(req.query.competencia ?? '');
  const csv = await service.exportCsv(competencia);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="folha-${competencia}.csv"`);
  res.send('﻿' + csv); // BOM pro Excel abrir com acentos
}
