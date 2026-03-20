import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createChecklistSchema, answerItemSchema, addItemSchema } from './types';

const router = Router();

// Template routes (no obra context)
const templateRouter = Router();
templateRouter.use(authenticate);
templateRouter.get('/', controller.listTemplates);

// Obra-scoped routes (mounted at /obras/:id/checklists)
const obraChecklistRouter = Router({ mergeParams: true });
obraChecklistRouter.use(authenticate);
obraChecklistRouter.get('/', controller.listByObra);
obraChecklistRouter.post('/', requireRole('gestor'), validate(createChecklistSchema), controller.createChecklist);

// Checklist-specific routes (mounted at /checklists/:id)
router.use(authenticate);
router.get('/:id', controller.getById);
router.patch('/:id/items/:itemId', validate(answerItemSchema), controller.answerItem);
router.post('/:id/items', requireRole('gestor'), validate(addItemSchema), controller.addItem);
router.patch('/:id/complete', requireRole('gestor'), controller.completeChecklist);

export { templateRouter, obraChecklistRouter };
export default router;
