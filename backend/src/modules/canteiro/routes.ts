import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { answerCanteiroItemSchema, approveCanteiroSchema } from './types';

// Template route
const templateRouter = Router();
templateRouter.use(authenticate);
templateRouter.get('/', controller.getTemplate);

// Obra-scoped routes (mounted at /obras/:id/canteiro)
const obraCanteiroRouter = Router({ mergeParams: true });
obraCanteiroRouter.use(authenticate);
obraCanteiroRouter.get('/', controller.listByObra);
obraCanteiroRouter.post('/', requireRole('campo'), controller.createForCurrentWeek);

// Canteiro-specific routes (mounted at /canteiro/:id)
const router = Router();
router.use(authenticate);
router.get('/:id', controller.getById);
router.patch('/:id/items/:itemId', validate(answerCanteiroItemSchema), controller.answerItem);
router.patch('/:id/approve', requireRole('coordenacao'), validate(approveCanteiroSchema), controller.approveChecklist);

export { templateRouter as canteiroTemplateRouter, obraCanteiroRouter };
export default router;
