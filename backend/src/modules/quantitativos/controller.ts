import { Request, Response } from 'express';
import * as service from './service';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';
import { AppError } from '../../utils/errors';

const WRITE_ROLES = ['diretoria', 'coordenacao', 'pmo', 'engenharia', 'orcamentos', 'compras'];

function assertCanWrite(req: Request) {
  if (!WRITE_ROLES.includes(req.user!.role)) {
    throw AppError.forbidden('Sem permissão pra editar quantitativos');
  }
}

// POST /v1/orcamentos/:orcamentoId/quantitativos
export async function create(req: Request, res: Response) {
  assertCanWrite(req);
  const q = await service.createQuantitativo(req.params.orcamentoId, req.user!.userId, req.body.observacoes);
  sendCreated(res, q);
}

// GET /v1/orcamentos/:orcamentoId/quantitativos
export async function listByOrcamento(req: Request, res: Response) {
  const list = await service.listByOrcamento(req.params.orcamentoId);
  sendSuccess(res, list);
}

// GET /v1/quantitativos/:id
export async function get(req: Request, res: Response) {
  const q = await service.getQuantitativo(req.params.id);
  sendSuccess(res, q);
}

// PATCH /v1/quantitativos/:id
export async function update(req: Request, res: Response) {
  assertCanWrite(req);
  const q = await service.updateQuantitativo(req.params.id, req.body);
  sendSuccess(res, q);
}

// DELETE /v1/quantitativos/:id
export async function remove(req: Request, res: Response) {
  assertCanWrite(req);
  await service.deleteQuantitativo(req.params.id);
  sendNoContent(res);
}

// POST /v1/quantitativos/:id/pdfs
export async function uploadPdf(req: Request, res: Response) {
  assertCanWrite(req);
  const file = req.file;
  if (!file || !file.buffer) throw AppError.badRequest('Arquivo PDF ausente');
  const att = await service.attachPdf(req.params.id, file.buffer, file.originalname, file.mimetype, req.user!.userId);
  sendCreated(res, att);
}

// DELETE /v1/quantitativos/:id/pdfs/:attachmentId
export async function removePdf(req: Request, res: Response) {
  assertCanWrite(req);
  await service.removePdf(req.params.id, req.params.attachmentId);
  sendNoContent(res);
}

// POST /v1/quantitativos/:id/processar
export async function processar(req: Request, res: Response) {
  assertCanWrite(req);
  const result = await service.processarQuantitativo(req.params.id);
  sendSuccess(res, result);
}

// POST /v1/quantitativos/:id/itens
export async function createItem(req: Request, res: Response) {
  assertCanWrite(req);
  const item = await service.createItem(req.params.id, req.body);
  sendCreated(res, item);
}

// PATCH /v1/quantitativos/:id/itens/:itemId
export async function updateItem(req: Request, res: Response) {
  assertCanWrite(req);
  const item = await service.updateItem(req.params.id, req.params.itemId, req.user!.userId, req.body);
  sendSuccess(res, item);
}

// DELETE /v1/quantitativos/:id/itens/:itemId
export async function deleteItem(req: Request, res: Response) {
  assertCanWrite(req);
  await service.deleteItem(req.params.id, req.params.itemId);
  sendNoContent(res);
}
