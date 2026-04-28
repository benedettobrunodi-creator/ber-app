import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createRecursoExternoSchema } from './types';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('coordenacao'), controller.list);
router.post('/', requireRole('coordenacao'), validate(createRecursoExternoSchema), controller.create);
router.delete('/:id', requireRole('coordenacao'), controller.remove);

export default router;
