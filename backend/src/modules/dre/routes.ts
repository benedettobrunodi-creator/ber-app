import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);
router.get('/', requireRole('diretoria'), controller.getAll);
router.put('/', requireRole('diretoria'), controller.bulkUpsert);

export default router;
