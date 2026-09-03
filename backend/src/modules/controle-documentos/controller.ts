import { Request, Response } from 'express';
import * as service from './service';
import { AppError } from '../../utils/errors';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';
import { uploadToR2, isR2Configured } from '../../services/storage';
import { bulkMetaSchema } from './types';

export async function list(req: Request, res: Response) {
  const data = await service.listByObra(req.params.id);
  sendSuccess(res, data);
}

export async function create(req: Request, res: Response) {
  const data = await service.create(req.params.id, req.body, req.user!.userId);
  sendCreated(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await service.update(req.params.documentoId, req.body);
  sendSuccess(res, data);
}

export async function remove(req: Request, res: Response) {
  await service.remove(req.params.documentoId);
  sendNoContent(res);
}

export async function proximaRevisao(req: Request, res: Response) {
  const sugestao = await service.sugerirProximaRevisao(req.params.documentoId);
  sendSuccess(res, { sugestao });
}

export async function addRevisao(req: Request, res: Response) {
  let arquivo: { url: string; nome: string } | null = null;
  if (req.file) {
    if (!isR2Configured()) throw AppError.badRequest('Storage de arquivos não configurado no servidor');
    const url = await uploadToR2(
      req.file.buffer,
      `documentos/${req.params.documentoId}-${req.body.revisao}-${req.file.originalname}`,
      req.file.mimetype,
    );
    arquivo = { url, nome: req.file.originalname };
  }
  const data = await service.addRevisao(req.params.documentoId, req.body, arquivo, req.user!.userId);
  sendCreated(res, data);
}

export async function updateRevisao(req: Request, res: Response) {
  const data = await service.updateRevisao(req.params.revisaoId, req.body);
  sendSuccess(res, data);
}

export async function removeRevisao(req: Request, res: Response) {
  await service.removeRevisao(req.params.revisaoId);
  sendNoContent(res);
}

export async function bulkUpload(req: Request, res: Response) {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) throw AppError.badRequest('Envie ao menos um arquivo (campo "files")');
  // meta (opcional): JSON com código/revisão/disciplina confirmados na tela de
  // conferência do front. Sem meta = comportamento antigo (parse pelo nome).
  let meta;
  if (req.body?.meta) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(req.body.meta);
    } catch {
      throw AppError.badRequest('Campo "meta" não é um JSON válido');
    }
    const r = bulkMetaSchema.safeParse(parsed);
    if (!r.success) throw AppError.badRequest('Metadados do lote inválidos');
    meta = r.data;
  }
  const data = await service.bulkUpload(req.params.id, files, req.user!.userId, meta);
  sendCreated(res, data);
}
