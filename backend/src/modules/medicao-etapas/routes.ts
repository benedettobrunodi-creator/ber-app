import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import { createEtapaSchema, updateEtapaSchema, reordenarEtapasSchema } from './types';
import * as ctrl from './controller';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const obraEtapasRouter = Router({ mergeParams: true });
export const etapasRouter = Router();

obraEtapasRouter.get('/', w(ctrl.list));
obraEtapasRouter.post('/', obraMemberOnly, validate(createEtapaSchema), w(ctrl.create));
obraEtapasRouter.put('/reordenar', obraMemberOnly, validate(reordenarEtapasSchema), w(ctrl.reordenar));

async function resolveObraId(req: Request, _res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../../config/database');
    const e = await prisma.etapa.findUnique({ where: { id: req.params.id }, select: { obraId: true } });
    if (!e) return next(new Error('Etapa não encontrada'));
    req.params.obraId = e.obraId;
    next();
  } catch (err) { next(err); }
}

etapasRouter.get('/:id', w(ctrl.getOne));
etapasRouter.patch('/:id', resolveObraId, obraMemberOnly, validate(updateEtapaSchema), w(ctrl.update));
etapasRouter.delete('/:id', resolveObraId, obraMemberOnly, w(ctrl.remove));
