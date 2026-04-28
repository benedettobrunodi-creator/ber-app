import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createAlocacaoSchema, updateAlocacaoSchema } from './types';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('gestor'), controller.list);
router.post('/', requireRole('coordenacao'), validate(createAlocacaoSchema), controller.create);
router.put('/:id', requireRole('coordenacao'), validate(updateAlocacaoSchema), controller.update);
router.delete('/:id', requireRole('coordenacao'), controller.remove);

export default router;
