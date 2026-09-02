import { Request, Response } from 'express';
import * as service from './service';
import * as nfService from './nf.service';
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

// ─── NFs dos colaboradores PJ ─────────────────────────────────────────────
export async function minhaNf(req: Request, res: Response) {
  sendSuccess(res, await nfService.minhaNf(req.user!.userId, String(req.query.competencia ?? '')));
}

/**
 * Aceita valor em formato brasileiro ou americano: "9.000,00", "9000,00",
 * "9000.00", "9000", "R$ 9.000,00". (02/09/26 — "9.000,00" virava NaN e o
 * colaborador ficava preso no erro; caso real do Josué.)
 */
export function parseValorBRL(raw: unknown): number {
  let s = String(raw ?? '').trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (s.includes('.') && s.includes(',')) {
    // "9.000,00" — ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    // "9000,00" — vírgula decimal
    s = s.replace(',', '.');
  } else if (/\.\d{3}$/.test(s)) {
    // "9.000" — ponto de milhar sem casas decimais
    s = s.replace(/\./g, '');
  }
  return Math.round(Number(s) * 100);
}

export async function enviarNf(req: Request, res: Response) {
  const file = (req as Request & { file?: { buffer: Buffer; originalname: string; mimetype: string } }).file;
  if (!file) { res.status(400).json({ success: false, error: { message: 'Arquivo da NF é obrigatório (PDF ou XML)' } }); return; }
  const valorCentavos = parseValorBRL(req.body?.valor);
  sendSuccess(res, await nfService.enviarNf(
    req.user!.userId,
    String(req.body?.competencia ?? ''),
    { numero: String(req.body?.numero ?? ''), valorCentavos, observacoes: req.body?.observacoes },
    file,
  ), 201);
}

export async function painelNfs(req: Request, res: Response) {
  sendSuccess(res, await nfService.painelNfs(String(req.query.competencia ?? '')));
}

export async function statusNf(req: Request, res: Response) {
  const acao = String(req.body?.acao ?? '');
  if (!['validar', 'pagar', 'rejeitar'].includes(acao)) { res.status(400).json({ success: false, error: { message: 'Ação inválida (validar | pagar | rejeitar)' } }); return; }
  sendSuccess(res, await nfService.mudarStatusNf(req.params.id, acao as 'validar' | 'pagar' | 'rejeitar', req.user!.userId, req.body?.motivo));
}
