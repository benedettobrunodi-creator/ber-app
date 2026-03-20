import { Request, Response } from 'express';
import * as meetingService from './service';
import { sendSuccess, sendCreated, sendNoContent, sendPaginated, parsePagination, buildPagination } from '../../utils/response';

export async function listMeetings(req: Request, res: Response) {
  const { page, limit } = parsePagination(req.query as any);
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const { meetings, total } = await meetingService.listMeetings(page, limit, startDate, endDate);
  sendPaginated(res, meetings, buildPagination(page, limit, total));
}

export async function getUpcoming(_req: Request, res: Response) {
  const meetings = await meetingService.getUpcoming();
  sendSuccess(res, meetings);
}

export async function createMeeting(req: Request, res: Response) {
  const meeting = await meetingService.createMeeting(req.user!.userId, req.body);
  sendCreated(res, meeting);
}

export async function updateMeeting(req: Request, res: Response) {
  const meeting = await meetingService.updateMeeting(req.params.id, req.body);
  sendSuccess(res, meeting);
}

export async function deleteMeeting(req: Request, res: Response) {
  await meetingService.deleteMeeting(req.params.id);
  sendNoContent(res);
}

export async function syncGoogleCalendar(_req: Request, res: Response) {
  const result = await meetingService.syncFromGoogleCalendar();
  sendSuccess(res, result);
}
