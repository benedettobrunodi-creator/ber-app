import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createTaskSchema, updateTaskSchema, updateStatusSchema, updatePositionSchema } from './types';

const router = Router();

router.use(authenticate);

// Obra-scoped task routes (mounted under /obras/:obraId/tasks)
export const obraTaskRoutes = Router({ mergeParams: true });
obraTaskRoutes.use(authenticate);
obraTaskRoutes.get('/burndown', requireRole('campo'), controller.getBurndown);
obraTaskRoutes.get('/', requireRole('campo'), controller.listTasks);
obraTaskRoutes.post('/', requireRole('gestor'), validate(createTaskSchema), controller.createTask);

// Task-level routes (mounted under /tasks)
router.put('/:id', requireRole('gestor'), validate(updateTaskSchema), controller.updateTask);
router.patch('/:id/status', requireRole('campo'), validate(updateStatusSchema), controller.updateStatus);
router.patch('/:id/position', requireRole('campo'), validate(updatePositionSchema), controller.updatePosition);
router.delete('/:id', requireRole('gestor'), controller.deleteTask);

export default router;
