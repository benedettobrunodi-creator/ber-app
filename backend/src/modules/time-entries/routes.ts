import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { checkinSchema, checkoutSchema } from './types';

const router = Router();

router.use(authenticate);

// Personal routes — qualquer usuário autenticado
router.post('/checkin', validate(checkinSchema), controller.checkin);
router.post('/checkout', validate(checkoutSchema), controller.checkout);
router.get('/me', controller.getMyEntries);
router.get('/me/status', controller.getMyStatus);

// Export route
router.get('/export', requireRole('coordenacao'), controller.exportToExcel);

// Admin routes
router.get('/active', requireRole('coordenacao'), controller.getActiveWorkers);
router.get('/report', requireRole('coordenacao'), controller.getReport);
router.get('/', requireRole('coordenacao'), controller.getAllEntries);
router.delete('/:id', requireRole('diretoria'), controller.deleteEntry);

export default router;
