import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

const router = Router();

router.use(authenticate);

router.get('/unread-count', requireRole('campo'), controller.getUnreadCount);
router.get('/', requireRole('campo'), controller.listNotifications);
router.patch('/read-all', requireRole('campo'), controller.markAllAsRead);
router.patch('/:id/read', requireRole('campo'), controller.markAsRead);

export default router;
