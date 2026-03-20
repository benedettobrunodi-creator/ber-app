import { Request, Response } from 'express';
import * as checklistService from './service';
import { sendSuccess, sendCreated } from '../../utils/response';

export async function listTemplates(req: Request, res: Response) {
  const type = req.query.type as string | undefined;
  const segment = req.query.segment as string | undefined;
  const templates = await checklistService.listTemplates(type, segment);
  sendSuccess(res, templates);
}

export async function createChecklist(req: Request, res: Response) {
  const obraId = req.params.id;
  const checklist = await checklistService.createChecklist(obraId, req.user!.userId, req.body);
  sendCreated(res, checklist);
}

export async function listByObra(req: Request, res: Response) {
  const checklists = await checklistService.listByObra(req.params.id);
  sendSuccess(res, checklists);
}

export async function getById(req: Request, res: Response) {
  const checklist = await checklistService.getById(req.params.id);
  sendSuccess(res, checklist);
}

export async function answerItem(req: Request, res: Response) {
  const item = await checklistService.answerItem(req.params.id, req.params.itemId, req.user!.userId, req.body);
  sendSuccess(res, item);
}

export async function addItem(req: Request, res: Response) {
  const item = await checklistService.addItem(req.params.id, req.body);
  sendCreated(res, item);
}

export async function completeChecklist(req: Request, res: Response) {
  const checklist = await checklistService.completeChecklist(req.params.id);
  sendSuccess(res, checklist);
}
