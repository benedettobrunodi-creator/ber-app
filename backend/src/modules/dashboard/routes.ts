import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);
router.get('/radar', requireRole('gestor'), controller.getRadar);

export default router;
