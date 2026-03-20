import { Request, Response } from 'express';
import * as canteiroService from './service';
import { sendSuccess, sendCreated } from '../../utils/response';

export async function getTemplate(_req: Request, res: Response) {
  const template = await canteiroService.getActiveTemplate();
  sendSuccess(res, template);
}

export async function listByObra(req: Request, res: Response) {
  const checklists = await canteiroService.listByObra(req.params.id);
  sendSuccess(res, checklists);
}

export async function createForCurrentWeek(req: Request, res: Response) {
  const checklist = await canteiroService.createForCurrentWeek(req.params.id, req.user!.userId);
  sendCreated(res, checklist);
}

export async function getById(req: Request, res: Response) {
  const checklist = await canteiroService.getById(req.params.id);
  sendSuccess(res, checklist);
}

export async function answerItem(req: Request, res: Response) {
  const item = await canteiroService.answerItem(req.params.id, req.params.itemId, req.user!.userId, req.body);
  sendSuccess(res, item);
}

export async function approveChecklist(req: Request, res: Response) {
  const checklist = await canteiroService.approveChecklist(req.params.id, req.user!.userId, req.body);
  sendSuccess(res, checklist);
}
