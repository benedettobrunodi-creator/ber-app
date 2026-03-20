import { Request, Response } from 'express';
import * as userService from './service';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated, parsePagination, buildPagination } from '../../utils/response';

export async function listUsers(req: Request, res: Response) {
  const { page, limit } = parsePagination(req.query as { page?: string; limit?: string });
  const { users, total } = await userService.listUsers(page, limit);
  sendPaginated(res, users, buildPagination(page, limit, total));
}

export async function getMe(req: Request, res: Response) {
  const user = await userService.getUserById(req.user!.userId);
  sendSuccess(res, user);
}

export async function updateMe(req: Request, res: Response) {
  const user = await userService.updateProfile(req.user!.userId, req.body);
  sendSuccess(res, user);
}

export async function createUser(req: Request, res: Response) {
  const user = await userService.createUser(req.body);
  sendCreated(res, user);
}

export async function updateUser(req: Request, res: Response) {
  const user = await userService.updateUser(req.params.id, req.body);
  sendSuccess(res, user);
}

export async function deleteUser(req: Request, res: Response) {
  await userService.deactivateUser(req.params.id);
  sendNoContent(res);
}

export async function updatePushToken(req: Request, res: Response) {
  await userService.updatePushToken(req.user!.userId, req.body.pushToken);
  sendSuccess(res, { message: 'Push token atualizado' });
}

export async function changePassword(req: Request, res: Response) {
  await userService.changePassword(req.user!.userId, req.body);
  sendSuccess(res, { message: 'Senha alterada com sucesso' });
}
