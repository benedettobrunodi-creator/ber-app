import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import { issueAcessoSchema, aprovarSchema, contestarSchema } from './types';
import * as ctrl from './controller';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

// Routers internos (com auth)
export const obraClienteAcessoRouter = Router({ mergeParams: true });
export const clienteAcessoRouter     = Router();

obraClienteAcessoRouter.get('/', w(ctrl.listAcessos));
obraClienteAcessoRouter.post('/', obraMemberOnly, validate(issueAcessoSchema), w(ctrl.issue));

async function resolveObraIdFromAcesso(req: Request, _res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../../config/database');
    const a = await prisma.clienteAcesso.findUnique({ where: { id: req.params.id }, select: { obraId: true } });
    if (!a) return next(new Error('Acesso não encontrado'));
    req.params.obraId = a.obraId;
    next();
  } catch (err) { next(err); }
}

clienteAcessoRouter.delete('/:id', resolveObraIdFromAcesso, obraMemberOnly, w(ctrl.revogar));

// Router público — SEM auth (rate-limit aplicado no mount em app.ts)
export const publicoClienteRouter = Router();
publicoClienteRouter.get('/medicao/:token', w(ctrl.getPortal));
publicoClienteRouter.post('/medicao/:token/aprovar', validate(aprovarSchema), w(ctrl.aprovar));
publicoClienteRouter.post('/medicao/:token/contestar', validate(contestarSchema), w(ctrl.contestar));
