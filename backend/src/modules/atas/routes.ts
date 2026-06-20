import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import { createAtaSchema, updateAtaSchema, addPendenciaSchema } from './types';
import * as ctrl from './controller';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const obraAtasRouter = Router({ mergeParams: true });
export const atasRouter = Router();

obraAtasRouter.get('/', w(ctrl.list));
obraAtasRouter.post('/', obraMemberOnly, validate(createAtaSchema), w(ctrl.create));

async function resolveObraId(req: Request, _res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../../config/database');
    const a = await prisma.obraAta.findUnique({
      where: { id: req.params.id },
      select: { obraId: true },
    });
    if (!a) return next(new Error('Ata não encontrada'));
    req.params.obraId = a.obraId;
    next();
  } catch (err) { next(err); }
}

atasRouter.get('/:id', w(ctrl.getOne));
atasRouter.patch('/:id', resolveObraId, obraMemberOnly, validate(updateAtaSchema), w(ctrl.update));
atasRouter.post('/:id/pendencias', resolveObraId, obraMemberOnly, validate(addPendenciaSchema), w(ctrl.addPendencia));
atasRouter.delete('/:id', resolveObraId, obraMemberOnly, w(ctrl.remove));
