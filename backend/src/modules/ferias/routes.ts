import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import {
  createColaboradorSchema, updateColaboradorSchema,
  createPeriodoSchema, updatePeriodoSchema,
} from './types';
import * as service from './service';

// authenticate + requirePermission('ferias') são aplicados na montagem em app.ts
const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const router = Router();

// ─── Colaboradores ───────────────────────────────────────────────────
router.get('/colaboradores', w(async (_req, res) => {
  res.json({ data: await service.listColaboradores() });
}));

router.post('/colaboradores', validate(createColaboradorSchema), w(async (req, res) => {
  res.status(201).json({ data: await service.createColaborador(req.body) });
}));

router.patch('/colaboradores/:id', validate(updateColaboradorSchema), w(async (req, res) => {
  res.json({ data: await service.updateColaborador(req.params.id, req.body) });
}));

router.delete('/colaboradores/:id', w(async (req, res) => {
  await service.removeColaborador(req.params.id);
  res.status(204).end();
}));

// ─── Períodos de férias ──────────────────────────────────────────────
router.post('/periodos', validate(createPeriodoSchema), w(async (req, res) => {
  res.status(201).json({ data: await service.createPeriodo(req.body) });
}));

router.patch('/periodos/:id', validate(updatePeriodoSchema), w(async (req, res) => {
  res.json({ data: await service.updatePeriodo(req.params.id, req.body) });
}));

router.delete('/periodos/:id', w(async (req, res) => {
  await service.removePeriodo(req.params.id);
  res.status(204).end();
}));

export default router;
