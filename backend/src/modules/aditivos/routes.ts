import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import { createAditivoSchema, updateAditivoSchema, decisionSchema } from './types';
import * as ctrl from './controller';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

// Mounted at /v1/obras/:obraId/aditivos (read = perm aditivos)
//        and /v1/aditivos                 (read by id / edit / delete = obraMemberOnly when applicable)
export const obraAditivosRouter = Router({ mergeParams: true });
export const aditivosRouter = Router();

// READ — controlled by route's perm() upstream
obraAditivosRouter.get('/', w(ctrl.list));

// WRITE — needs obra membership (or socio/admin)
obraAditivosRouter.post('/', obraMemberOnly, validate(createAditivoSchema), w(ctrl.create));

// Individual aditivo ops — obraMemberOnly via :id is not enough (no obraId in path).
// We attach a helper that resolves obraId from the aditivo first.
async function resolveObraId(req: Request, _res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../../config/database');
    const a = await prisma.obraAditivo.findUnique({
      where: { id: req.params.id },
      select: { obraId: true },
    });
    if (!a) return next(new Error('Aditivo não encontrado'));
    req.params.obraId = a.obraId;
    next();
  } catch (err) {
    next(err);
  }
}

aditivosRouter.get('/:id', w(ctrl.getOne));
aditivosRouter.patch('/:id', resolveObraId, obraMemberOnly, validate(updateAditivoSchema), w(ctrl.update));
aditivosRouter.post('/:id/decision', resolveObraId, obraMemberOnly, validate(decisionSchema), w(ctrl.decide));
aditivosRouter.delete('/:id', resolveObraId, obraMemberOnly, w(ctrl.remove));
