import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import { upsertKickoffSchema } from './types';
import * as service from './service';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const obraKickoffRouter = Router({ mergeParams: true });

obraKickoffRouter.get('/', w(async (req: Request, res: Response) => {
  const data = await service.getByObra(req.params.obraId);
  res.json({ data });
}));

obraKickoffRouter.put('/', obraMemberOnly, validate(upsertKickoffSchema), w(async (req: Request, res: Response) => {
  const data = await service.upsert(req.params.obraId, req.body);
  res.json({ data });
}));
