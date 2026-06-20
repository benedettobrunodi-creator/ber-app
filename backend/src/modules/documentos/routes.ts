import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import { createDocumentoSchema, updateDocumentoSchema } from './types';
import * as ctrl from './controller';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const obraDocumentosRouter = Router({ mergeParams: true });
export const documentosRouter = Router();

obraDocumentosRouter.get('/', w(ctrl.list));
obraDocumentosRouter.post('/', obraMemberOnly, validate(createDocumentoSchema), w(ctrl.create));

async function resolveObraId(req: Request, _res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../../config/database');
    const d = await prisma.obraDocumento.findUnique({ where: { id: req.params.id }, select: { obraId: true } });
    if (!d) return next(new Error('Documento não encontrado'));
    req.params.obraId = d.obraId;
    next();
  } catch (err) { next(err); }
}

documentosRouter.patch('/:id', resolveObraId, obraMemberOnly, validate(updateDocumentoSchema), w(ctrl.update));
documentosRouter.delete('/:id', resolveObraId, obraMemberOnly, w(ctrl.remove));
