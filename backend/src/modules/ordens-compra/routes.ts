import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import { createOcSchema, updateOcSchema } from './types';
import * as ctrl from './controller';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const obraOcsRouter = Router({ mergeParams: true });
export const ocsRouter = Router();

obraOcsRouter.get('/', w(ctrl.list));
obraOcsRouter.post('/', obraMemberOnly, validate(createOcSchema), w(ctrl.create));

async function resolveObraId(req: Request, _res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../../config/database');
    const o = await prisma.obraOrdemCompra.findUnique({
      where: { id: req.params.id },
      select: { obraId: true },
    });
    if (!o) return next(new Error('OC não encontrada'));
    req.params.obraId = o.obraId;
    next();
  } catch (err) { next(err); }
}

ocsRouter.patch('/:id', resolveObraId, obraMemberOnly, validate(updateOcSchema), w(ctrl.update));
ocsRouter.delete('/:id', resolveObraId, obraMemberOnly, w(ctrl.remove));
