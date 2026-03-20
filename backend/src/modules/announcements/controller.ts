import { Request, Response } from 'express';
import * as announcementService from './service';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated, parsePagination, buildPagination } from '../../utils/response';

export async function listAnnouncements(req: Request, res: Response) {
  const { page, limit } = parsePagination(req.query as any);
  const { announcements, total } = await announcementService.listAnnouncements(page, limit, req.user!.role);
  sendPaginated(res, announcements, buildPagination(page, limit, total));
}

export async function getAnnouncement(req: Request, res: Response) {
  const announcement = await announcementService.getAnnouncementById(req.params.id, req.user!.userId);
  sendSuccess(res, announcement);
}

export async function createAnnouncement(req: Request, res: Response) {
  const announcement = await announcementService.createAnnouncement(req.user!.userId, req.body);
  sendCreated(res, announcement);
}

export async function updateAnnouncement(req: Request, res: Response) {
  const announcement = await announcementService.updateAnnouncement(req.params.id, req.body);
  sendSuccess(res, announcement);
}

export async function deleteAnnouncement(req: Request, res: Response) {
  await announcementService.deleteAnnouncement(req.params.id);
  sendNoContent(res);
}

export async function getReads(req: Request, res: Response) {
  const reads = await announcementService.getReads(req.params.id);
  sendSuccess(res, reads);
}
