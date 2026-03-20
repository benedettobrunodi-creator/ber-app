import { Request, Response } from 'express';
import * as authService from './service';
import { sendSuccess } from '../../utils/response';

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body);
  sendSuccess(res, result);
}

export async function refresh(req: Request, res: Response) {
  const result = await authService.refresh(req.body.refreshToken);
  sendSuccess(res, result);
}

export async function forgotPassword(req: Request, res: Response) {
  const result = await authService.forgotPassword(req.body);
  sendSuccess(res, result);
}

export async function resetPassword(req: Request, res: Response) {
  const result = await authService.resetPassword(req.body);
  sendSuccess(res, result);
}
