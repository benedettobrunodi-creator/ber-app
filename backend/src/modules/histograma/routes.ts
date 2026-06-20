import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import { bulkUpsertSchema, upsertCellSchema, renameFuncaoSchema, deleteFuncaoSchema } from './types';
import * as service from './service';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const obraHistogramaRouter = Router({ mergeParams: true });

obraHistogramaRouter.get('/', w(async (req, res) => {
  const data = await service.listByObra(req.params.obraId);
  res.json({ data });
}));

// PUT bulk de células ao salvar planilha inteira
obraHistogramaRouter.put('/', obraMemberOnly, validate(bulkUpsertSchema), w(async (req, res) => {
  const data = await service.bulkUpsert(req.params.obraId, req.body);
  res.json({ data });
}));

// POST 1 célula (edição inline)
obraHistogramaRouter.post('/cell', obraMemberOnly, validate(upsertCellSchema), w(async (req, res) => {
  const data = await service.upsertCell(req.params.obraId, req.body);
  res.json({ data });
}));

obraHistogramaRouter.post('/funcao/rename', obraMemberOnly, validate(renameFuncaoSchema), w(async (req, res) => {
  await service.renameFuncao(req.params.obraId, req.body.from, req.body.to);
  res.status(204).end();
}));

obraHistogramaRouter.delete('/funcao', obraMemberOnly, validate(deleteFuncaoSchema), w(async (req, res) => {
  await service.deleteFuncao(req.params.obraId, req.body.funcao);
  res.status(204).end();
}));
