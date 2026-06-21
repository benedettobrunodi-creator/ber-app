import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import { createRaciSchema, updateRaciSchema } from './types';
import * as service from './service';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const obraRaciRouter = Router({ mergeParams: true });
export const raciRouter = Router();

obraRaciRouter.get('/', w(async (req: Request, res: Response) => {
  const data = await service.listByObra(req.params.obraId);
  res.json({ data });
}));

obraRaciRouter.post('/', obraMemberOnly, validate(createRaciSchema), w(async (req: Request, res: Response) => {
  const data = await service.create(req.params.obraId, req.body);
  res.status(201).json({ data });
}));

obraRaciRouter.post('/apply-template', obraMemberOnly, w(async (req: Request, res: Response) => {
  const data = await service.applyTemplate(req.params.obraId);
  res.status(201).json({ data });
}));

async function resolveObraId(req: Request, _res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../../config/database');
    const r = await prisma.obraRaci.findUnique({ where: { id: req.params.id }, select: { obraId: true } });
    if (!r) return next(new Error('RACI item não encontrado'));
    req.params.obraId = r.obraId;
    next();
  } catch (err) { next(err); }
}

raciRouter.patch('/:id', resolveObraId, obraMemberOnly, validate(updateRaciSchema), w(async (req: Request, res: Response) => {
  const data = await service.update(req.params.id, req.body);
  res.json({ data });
}));

raciRouter.delete('/:id', resolveObraId, obraMemberOnly, w(async (req: Request, res: Response) => {
  await service.remove(req.params.id);
  res.status(204).end();
}));
