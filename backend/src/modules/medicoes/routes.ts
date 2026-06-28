import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import {
  createMedicaoSchema,
  updateMedicaoSchema,
  transitionSchema,
  updateItemSchema,
  upsertPagamentoDiretoSchema,
} from './types';
import * as ctrl from './controller';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const obraMedicoesRouter = Router({ mergeParams: true });
export const medicoesRouter     = Router();
export const medicaoItensRouter = Router();

obraMedicoesRouter.get('/', w(ctrl.list));
obraMedicoesRouter.post('/', obraMemberOnly, validate(createMedicaoSchema), w(ctrl.create));
// Consolidado interno (hub /obras/:id/medicao) — mesma visão do portal cliente
obraMedicoesRouter.get('/consolidado', w(async (req, res) => {
  const { getConsolidadoPorObra } = await import('../cliente-acesso/service');
  const data = await getConsolidadoPorObra(req.params.obraId);
  res.json({ data });
}));

async function resolveObraIdFromMedicao(req: Request, _res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../../config/database');
    const m = await prisma.medicao.findUnique({ where: { id: req.params.id }, select: { obraId: true } });
    if (!m) return next(new Error('Medição não encontrada'));
    req.params.obraId = m.obraId;
    next();
  } catch (err) { next(err); }
}

medicoesRouter.get('/:id', w(ctrl.getDetail));
medicoesRouter.get('/:id/pdf', w(async (req, res) => {
  const { downloadPdf } = await import('./pdf.controller');
  return downloadPdf(req, res);
}));
medicoesRouter.patch('/:id', resolveObraIdFromMedicao, obraMemberOnly, validate(updateMedicaoSchema), w(ctrl.update));
medicoesRouter.delete('/:id', resolveObraIdFromMedicao, obraMemberOnly, w(ctrl.remove));
medicoesRouter.post('/:id/transition', resolveObraIdFromMedicao, obraMemberOnly, validate(transitionSchema), w(ctrl.transition));
medicoesRouter.put('/:id/pagamentos-diretos', resolveObraIdFromMedicao, obraMemberOnly, validate(upsertPagamentoDiretoSchema), w(ctrl.upsertPagamentoDireto));

// PATCH /v1/medicao-itens/:id — atualiza % acumulado (recalcula valor)
async function resolveObraIdFromItem(req: Request, _res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../../config/database');
    const item = await prisma.medicaoItem.findUnique({
      where: { id: req.params.id },
      include: { medicao: { select: { obraId: true } } },
    });
    if (!item) return next(new Error('Item de medição não encontrado'));
    req.params.obraId = item.medicao.obraId;
    next();
  } catch (err) { next(err); }
}

medicaoItensRouter.patch('/:id', resolveObraIdFromItem, obraMemberOnly, validate(updateItemSchema), w(ctrl.updateItem));
