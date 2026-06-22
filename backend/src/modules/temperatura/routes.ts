import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import { createTemperaturaSchema, updateTemperaturaSchema } from './types';
import * as service from './service';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const obraTemperaturaRouter = Router({ mergeParams: true });
export const temperaturaRouter = Router();

obraTemperaturaRouter.get('/', w(async (req: Request, res: Response) => {
  const data = await service.listByObra(req.params.obraId);
  res.json({ data });
}));

obraTemperaturaRouter.post('/', obraMemberOnly, validate(createTemperaturaSchema), w(async (req: Request, res: Response) => {
  const userId = (req as Request & { user?: { id: string } }).user!.id;
  const data = await service.create(req.params.obraId, req.body, userId);
  res.status(201).json({ data });
}));

async function resolveObraId(req: Request, _res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../../config/database');
    const r = await prisma.obraTemperatura.findUnique({ where: { id: req.params.id }, select: { obraId: true } });
    if (!r) return next(new Error('Temperatura não encontrada'));
    req.params.obraId = r.obraId;
    next();
  } catch (err) { next(err); }
}

temperaturaRouter.patch('/:id', resolveObraId, obraMemberOnly, validate(updateTemperaturaSchema), w(async (req: Request, res: Response) => {
  const data = await service.update(req.params.id, req.body);
  res.json({ data });
}));

temperaturaRouter.delete('/:id', resolveObraId, obraMemberOnly, w(async (req: Request, res: Response) => {
  await service.remove(req.params.id);
  res.status(204).end();
}));
