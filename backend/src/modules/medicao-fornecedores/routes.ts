import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import {
  createFornecedorSchema,
  updateFornecedorSchema,
  quickAddSchema,
  updateEtapaFornecedorSchema,
} from './types';
import * as ctrl from './controller';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const obraFornecedoresRouter = Router({ mergeParams: true });
export const fornecedoresRouter     = Router();
export const etapaQuickAddRouter    = Router({ mergeParams: true });
export const etapaFornecedoresRouter = Router();

// Fornecedores standalone (cadastrados na obra)
obraFornecedoresRouter.get('/', w(ctrl.listFornecedores));
obraFornecedoresRouter.post('/', obraMemberOnly, validate(createFornecedorSchema), w(ctrl.createFornecedor));

async function resolveObraIdFromFornecedor(req: Request, _res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../../config/database');
    const f = await prisma.fornecedor.findUnique({ where: { id: req.params.id }, select: { obraId: true } });
    if (!f) return next(new Error('Fornecedor não encontrado'));
    req.params.obraId = f.obraId;
    next();
  } catch (err) { next(err); }
}

fornecedoresRouter.patch('/:id', resolveObraIdFromFornecedor, obraMemberOnly, validate(updateFornecedorSchema), w(ctrl.updateFornecedor));
fornecedoresRouter.delete('/:id', resolveObraIdFromFornecedor, obraMemberOnly, w(ctrl.removeFornecedor));

// Quick add — vincula fornecedor a uma etapa
etapaQuickAddRouter.post('/', obraMemberOnly, validate(quickAddSchema), w(ctrl.quickAdd));

// EtapaFornecedor update/delete
async function resolveObraIdFromEf(req: Request, _res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../../config/database');
    const ef = await prisma.etapaFornecedor.findUnique({
      where: { id: req.params.id },
      include: { etapa: { select: { obraId: true } } },
    });
    if (!ef) return next(new Error('EtapaFornecedor não encontrado'));
    req.params.obraId = ef.etapa.obraId;
    next();
  } catch (err) { next(err); }
}

etapaFornecedoresRouter.patch('/:id', resolveObraIdFromEf, obraMemberOnly, validate(updateEtapaFornecedorSchema), w(ctrl.updateEtapaFornecedor));
etapaFornecedoresRouter.delete('/:id', resolveObraIdFromEf, obraMemberOnly, w(ctrl.removeEtapaFornecedor));
