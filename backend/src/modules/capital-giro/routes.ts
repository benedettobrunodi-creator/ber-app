import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { updateStateSchema } from './types';
import * as service from './service';

// authenticate + requirePermission('capitalGiro') são aplicados na montagem em app.ts
const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const router = Router();

router.get('/state', w(async (_req, res) => {
  res.json({ data: await service.getState() });
}));

router.put('/state', validate(updateStateSchema), w(async (req, res) => {
  res.json({ data: await service.updateState(req.body) });
}));

export default router;
