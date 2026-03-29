import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import {
  listFvsByObra, getFvsByEtapa, createFvs, autoProvision,
  checkItem, submitInicio, submitConclusao,
  approveGestor, approveCoord, rejectFvs,
} from './controller';

// Wrap async handlers for Express 4
const w = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// Mounted at /v1/obras/:id (mergeParams)
export const obraFvsRouter = Router({ mergeParams: true });
obraFvsRouter.get('/fvs', authenticate, w(listFvsByObra));
obraFvsRouter.post('/fvs/auto-provision', authenticate, requireRole('gestor'), w(autoProvision));
obraFvsRouter.get('/etapas/:etapaId/fvs', authenticate, w(getFvsByEtapa));
obraFvsRouter.post('/etapas/:etapaId/fvs', authenticate, requireRole('gestor'), w(createFvs));

// Mounted at /v1/obra-fvs
export const fvsRouter = Router();
fvsRouter.patch('/:fvsId/items/:itemId', authenticate, w(checkItem));
fvsRouter.post('/:fvsId/submit-inicio', authenticate, w(submitInicio));
fvsRouter.post('/:fvsId/submit-conclusao', authenticate, w(submitConclusao));
fvsRouter.post('/:fvsId/approve-gestor', authenticate, w(approveGestor));
fvsRouter.post('/:fvsId/approve-coord', authenticate, w(approveCoord));
fvsRouter.post('/:fvsId/reject', authenticate, w(rejectFvs));
