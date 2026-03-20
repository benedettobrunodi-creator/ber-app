import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createUserSchema, updateUserSchema, updateProfileSchema, pushTokenSchema, changePasswordSchema } from './types';

const router = Router();

router.use(authenticate);

router.get('/me', controller.getMe);
router.put('/me', validate(updateProfileSchema), controller.updateMe);
router.put('/me/push-token', validate(pushTokenSchema), controller.updatePushToken);
router.post('/me/change-password', validate(changePasswordSchema), controller.changePassword);

router.get('/', requireRole('coordenacao'), controller.listUsers);
router.post('/', requireRole('diretoria'), validate(createUserSchema), controller.createUser);
router.put('/:id', requireRole('diretoria'), validate(updateUserSchema), controller.updateUser);
router.delete('/:id', requireRole('diretoria'), controller.deleteUser);

export default router;
