import { Request, Response } from 'express';
import * as taskService from './service';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';

export async function listTasks(req: Request, res: Response) {
  const status = req.query.status as string | undefined;
  const tasks = await taskService.listTasks(req.params.obraId, status);
  sendSuccess(res, tasks);
}

export async function createTask(req: Request, res: Response) {
  const task = await taskService.createTask(req.params.obraId, req.user!.userId, req.body);
  sendCreated(res, task);
}

export async function updateTask(req: Request, res: Response) {
  const task = await taskService.updateTask(req.params.id, req.body);
  sendSuccess(res, task);
}

export async function updateStatus(req: Request, res: Response) {
  const task = await taskService.updateStatus(req.params.id, req.body.status);
  sendSuccess(res, task);
}

export async function updatePosition(req: Request, res: Response) {
  const task = await taskService.updatePosition(req.params.id, req.body.position, req.body.status);
  sendSuccess(res, task);
}

export async function deleteTask(req: Request, res: Response) {
  await taskService.deleteTask(req.params.id);
  sendNoContent(res);
}

export async function getBurndown(req: Request, res: Response) {
  const data = await taskService.getBurndown(req.params.obraId);
  sendSuccess(res, data);
}
