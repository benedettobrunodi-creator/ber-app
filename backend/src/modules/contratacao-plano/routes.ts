import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import { createPlanoSchema, updatePlanoSchema } from './types';
import * as service from './service';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

export const obraPlanoRouter = Router({ mergeParams: true });
export const planoRouter = Router();

// Visão global do hub de Compras (24/09/26) — todas as obras, mesma fonte.
planoRouter.get('/', w(async (_req, res) => {
  const data = await service.listGlobal();
  res.json({ data });
}));

obraPlanoRouter.get('/', w(async (req, res) => {
  const data = await service.listByObra(req.params.obraId);
  res.json({ data });
}));
obraPlanoRouter.post('/', obraMemberOnly, validate(createPlanoSchema), w(async (req, res) => {
  const data = await service.create(req.params.obraId, req.body);
  res.status(201).json({ data });
}));

async function resolveObraId(req: Request, _res: Response, next: NextFunction) {
  try {
    const { prisma } = await import('../../config/database');
    const p = await prisma.obraContratacaoPlano.findUnique({ where: { id: req.params.id }, select: { obraId: true } });
    if (!p) return next(new Error('Plano não encontrado'));
    req.params.obraId = p.obraId;
    next();
  } catch (err) { next(err); }
}

planoRouter.patch('/:id', resolveObraId, obraMemberOnly, validate(updatePlanoSchema), w(async (req, res) => {
  const data = await service.update(req.params.id, req.body);
  res.json({ data });
}));

planoRouter.delete('/:id', resolveObraId, obraMemberOnly, w(async (req, res) => {
  await service.remove(req.params.id);
  res.status(204).end();
}));

// Disparo manual do alerta de atrasados (teste/reenvio): POST /v1/contratacao-plano/alerta-atrasados
planoRouter.post('/alerta-atrasados', w(async (req, res) => {
  const { checkContratacoesAtrasadas } = await import('./alertas');
  const data = await checkContratacoesAtrasadas({ send: req.query.dry !== '1' });
  res.json({ data });
}));
