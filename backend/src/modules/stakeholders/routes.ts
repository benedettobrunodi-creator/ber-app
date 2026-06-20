import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import { createStakeholderSchema, updateStakeholderSchema } from './types';
import * as ctrl from './controller';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const obraStakeholdersRouter = Router({ mergeParams: true });
export const stakeholdersRouter = Router();

obraStakeholdersRouter.get('/', w(ctrl.list));
obraStakeholdersRouter.post('/', obraMemberOnly, validate(createStakeholderSchema), w(ctrl.create));

async function resolveObraId(req: Request, _res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../../config/database');
    const s = await prisma.obraStakeholder.findUnique({ where: { id: req.params.id }, select: { obraId: true } });
    if (!s) return next(new Error('Stakeholder não encontrado'));
    req.params.obraId = s.obraId;
    next();
  } catch (err) { next(err); }
}

stakeholdersRouter.patch('/:id', resolveObraId, obraMemberOnly, validate(updateStakeholderSchema), w(ctrl.update));
stakeholdersRouter.delete('/:id', resolveObraId, obraMemberOnly, w(ctrl.remove));
