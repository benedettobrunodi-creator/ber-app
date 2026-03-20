import { Request, Response } from 'express';
import * as service from './service';
import { sendSuccess, sendCreated } from '../../utils/response';

export async function listTemplates(_req: Request, res: Response) {
  const templates = await service.listTemplates();
  sendSuccess(res, templates);
}

export async function createSequenciamento(req: Request, res: Response) {
  const seq = await service.createSequenciamento(
    req.params.id,
    req.user!.userId,
    req.body,
  );
  sendCreated(res, seq);
}

export async function getSequenciamento(req: Request, res: Response) {
  const seq = await service.getSequenciamento(req.params.id);
  sendSuccess(res, seq);
}

// ─── Edit mode ──────────────────────────────────────────────────────────────

export async function updateEtapa(req: Request, res: Response) {
  const etapa = await service.updateEtapa(req.params.id, req.params.etapaId, req.body);
  sendSuccess(res, etapa);
}

export async function reorderEtapas(req: Request, res: Response) {
  const seq = await service.reorderEtapas(req.params.id, req.body);
  sendSuccess(res, seq);
}

export async function addEtapa(req: Request, res: Response) {
  const seq = await service.addEtapa(req.params.id, req.body);
  sendCreated(res, seq);
}

export async function removeEtapa(req: Request, res: Response) {
  const seq = await service.removeEtapa(req.params.id, req.params.etapaId);
  sendSuccess(res, seq);
}

export async function freezeSequenciamento(req: Request, res: Response) {
  const seq = await service.freezeSequenciamento(req.params.id);
  sendSuccess(res, seq);
}

// ─── Etapa actions ──────────────────────────────────────────────────────────

export async function startEtapa(req: Request, res: Response) {
  const etapa = await service.startEtapa(
    req.params.id,
    req.params.etapaId,
    req.user!.userId,
    req.body,
  );
  sendSuccess(res, etapa);
}

export async function submitEtapa(req: Request, res: Response) {
  const etapa = await service.submitEtapa(
    req.params.id,
    req.params.etapaId,
    req.user!.userId,
    req.body,
  );
  sendSuccess(res, etapa);
}

export async function approveEtapa(req: Request, res: Response) {
  const etapa = await service.approveEtapa(
    req.params.id,
    req.params.etapaId,
    req.user!.userId,
    req.body,
  );
  sendSuccess(res, etapa);
}

export async function rejectEtapa(req: Request, res: Response) {
  const etapa = await service.rejectEtapa(
    req.params.id,
    req.params.etapaId,
    req.user!.userId,
    req.body,
  );
  sendSuccess(res, etapa);
}
