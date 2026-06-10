import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as controller from './controller';

const router = Router();

router.use(authenticate);
router.get('/', requireRole('socio'), controller.getOrgChart);
router.put('/', requireRole('socio'), controller.putOrgChart);

export default router;
