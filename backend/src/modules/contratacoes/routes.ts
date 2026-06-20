import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import { createContratacaoSchema, updateContratacaoSchema } from './types';
import * as ctrl from './controller';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const obraContratacoesRouter = Router({ mergeParams: true });
export const contratacoesRouter = Router();

obraContratacoesRouter.get('/', w(ctrl.list));
obraContratacoesRouter.post('/', obraMemberOnly, validate(createContratacaoSchema), w(ctrl.create));

async function resolveObraId(req: Request, _res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../../config/database');
    const c = await prisma.obraContratacao.findUnique({
      where: { id: req.params.id },
      select: { obraId: true },
    });
    if (!c) return next(new Error('Contratação não encontrada'));
    req.params.obraId = c.obraId;
    next();
  } catch (err) { next(err); }
}

contratacoesRouter.get('/:id', w(ctrl.getOne));
contratacoesRouter.patch('/:id', resolveObraId, obraMemberOnly, validate(updateContratacaoSchema), w(ctrl.update));
contratacoesRouter.delete('/:id', resolveObraId, obraMemberOnly, w(ctrl.remove));
