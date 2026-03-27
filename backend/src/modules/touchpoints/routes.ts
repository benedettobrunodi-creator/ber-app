import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createTouchpointSchema, updateTouchpointSchema } from './types';

// Obra-scoped routes: /v1/obras/:id/touchpoints
const obraTouchpointRouter = Router({ mergeParams: true });
obraTouchpointRouter.use(authenticate);
obraTouchpointRouter.get('/', requireRole('gestor'), controller.listByObra);
obraTouchpointRouter.post('/', requireRole('gestor'), validate(createTouchpointSchema), controller.createTouchpoint);

// Global routes: /v1/touchpoints
const router = Router();
router.use(authenticate);
router.get('/pending-actions', requireRole('gestor'), controller.getPendingActions);
router.put('/:id', requireRole('gestor'), validate(updateTouchpointSchema), controller.updateTouchpoint);

export { obraTouchpointRouter };
export default router;
