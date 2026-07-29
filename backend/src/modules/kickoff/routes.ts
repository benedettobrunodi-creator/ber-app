import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import { upsertKickoffSchema, updateKickoffItemSchema } from './types';
import * as service from './service';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const obraKickoffRouter = Router({ mergeParams: true });

obraKickoffRouter.get('/', w(async (req: Request, res: Response) => {
  const data = await service.getByObra(req.params.obraId);
  res.json({ data });
}));

// PDF do kickoff
obraKickoffRouter.get('/pdf', w(async (req: Request, res: Response) => {
  const { downloadKickoffPdf } = await import('./pdf.controller');
  return downloadKickoffPdf(req, res);
}));

obraKickoffRouter.put('/', obraMemberOnly, validate(upsertKickoffSchema), w(async (req: Request, res: Response) => {
  const data = await service.upsert(req.params.obraId, req.body);
  res.json({ data });
}));

// Atualiza um item do checklist (responsável, na rede, data alvo, status, obs)
obraKickoffRouter.patch('/itens/:itemId', obraMemberOnly, validate(updateKickoffItemSchema), w(async (req: Request, res: Response) => {
  const data = await service.updateItem(req.params.itemId, req.body);
  res.json({ data });
}));
