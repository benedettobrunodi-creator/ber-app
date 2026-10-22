import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as controller from './controller';

const router = Router();

router.use(authenticate);
router.get('/', requireRole('socio'), controller.getOrgChart);
router.put('/', requireRole('socio'), controller.putOrgChart);
router.get('/versoes', requireRole('socio'), controller.getVersoes);
router.post('/versoes/:id/restaurar', requireRole('socio'), controller.restaurarVersao);

export default router;
