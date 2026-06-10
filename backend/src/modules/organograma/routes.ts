import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as controller from './controller';

const router = Router();

router.use(authenticate);
router.get('/', requireRole('diretoria'), controller.getOrgChart);
router.put('/', requireRole('diretoria'), controller.putOrgChart);

export default router;
