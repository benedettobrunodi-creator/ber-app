import { Request, Response } from 'express';
import * as chatService from './service';
import { sendSuccess, sendCreated, sendPaginated, parsePagination, buildPagination } from '../../utils/response';

export async function listRooms(req: Request, res: Response) {
  const rooms = await chatService.listRooms(req.user!.userId);
  sendSuccess(res, rooms);
}

export async function createRoom(req: Request, res: Response) {
  const room = await chatService.createRoom(req.user!.userId, req.body);
  sendCreated(res, room);
}

export async function getMessages(req: Request, res: Response) {
  const { page, limit } = parsePagination(req.query as any);
  const { messages, total } = await chatService.getMessages(req.params.id, req.user!.userId, page, limit);
  sendPaginated(res, messages, buildPagination(page, limit, total));
}

export async function sendMessage(req: Request, res: Response) {
  const message = await chatService.sendMessage(req.params.id, req.user!.userId, req.body);
  sendCreated(res, message);
}
