import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createRoomSchema, sendMessageSchema } from './types';

const router = Router();

router.use(authenticate);

router.get('/rooms', requireRole('campo'), controller.listRooms);
router.post('/rooms', requireRole('gestor'), validate(createRoomSchema), controller.createRoom);
router.get('/rooms/:id/messages', requireRole('campo'), controller.getMessages);
router.post('/rooms/:id/messages', requireRole('campo'), validate(sendMessageSchema), controller.sendMessage);

export default router;
