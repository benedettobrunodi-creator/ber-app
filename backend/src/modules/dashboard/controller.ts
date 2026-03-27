import { Request, Response } from 'express';
import * as dashboardService from './service';
import { sendSuccess } from '../../utils/response';

export async function getRadar(_req: Request, res: Response) {
  const radar = await dashboardService.getRadar();
  sendSuccess(res, radar);
}
