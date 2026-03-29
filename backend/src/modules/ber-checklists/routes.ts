import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import {
  listTemplates, listByObra, createChecklist, getChecklist,
  patchItem, submitChecklist, addAmbiente,
} from './controller';

const w = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// Mounted at /v1/obras/:id
export const obraClRouter = Router({ mergeParams: true });
obraClRouter.get('/ber-checklists', authenticate, w(listByObra));
obraClRouter.post('/ber-checklists', authenticate, w(createChecklist));

// Standalone routes
export const clRouter = Router();
clRouter.get('/:id', authenticate, w(getChecklist));
clRouter.patch('/:id/items/:itemId', authenticate, w(patchItem));
clRouter.post('/:id/submit', authenticate, w(submitChecklist));
clRouter.post('/:id/ambientes', authenticate, w(addAmbiente));
