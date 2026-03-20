import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createMeetingSchema, updateMeetingSchema } from './types';

const router = Router();

router.use(authenticate);

router.get('/upcoming', requireRole('coordenacao'), controller.getUpcoming);
router.get('/', requireRole('coordenacao'), controller.listMeetings);
router.post('/', requireRole('coordenacao'), validate(createMeetingSchema), controller.createMeeting);
router.put('/:id', requireRole('coordenacao'), validate(updateMeetingSchema), controller.updateMeeting);
router.delete('/:id', requireRole('diretoria'), controller.deleteMeeting);
router.post('/sync', requireRole('diretoria'), controller.syncGoogleCalendar);

export default router;
