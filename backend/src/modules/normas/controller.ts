import { Request, Response } from 'express';
import * as service from './service';
import { sendSuccess } from '../../utils/response';

export async function listNormas(req: Request, res: Response) {
  const normas = await service.listNormas({
    discipline: req.query.discipline as string | undefined,
    search: req.query.search as string | undefined,
  });
  sendSuccess(res, normas);
}

export async function getById(req: Request, res: Response) {
  const norma = await service.getById(req.params.id);
  sendSuccess(res, norma);
}

export async function searchExternal(req: Request, res: Response) {
  const q = req.query.q as string;
  if (!q) {
    return sendSuccess(res, []);
  }
  const results = await service.searchExternal(q);
  sendSuccess(res, results);
}
