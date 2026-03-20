import { Request, Response } from 'express';
import * as notificationService from './service';
import { sendSuccess, sendPaginated, parsePagination, buildPagination } from '../../utils/response';

export async function listNotifications(req: Request, res: Response) {
  const { page, limit } = parsePagination(req.query as any);
  const { notifications, total } = await notificationService.listNotifications(req.user!.userId, page, limit);
  sendPaginated(res, notifications, buildPagination(page, limit, total));
}

export async function getUnreadCount(req: Request, res: Response) {
  const count = await notificationService.getUnreadCount(req.user!.userId);
  sendSuccess(res, { count });
}

export async function markAsRead(req: Request, res: Response) {
  const notification = await notificationService.markAsRead(req.params.id, req.user!.userId);
  sendSuccess(res, notification);
}

export async function markAllAsRead(req: Request, res: Response) {
  await notificationService.markAllAsRead(req.user!.userId);
  sendSuccess(res, { message: 'Todas as notificações marcadas como lidas' });
}
