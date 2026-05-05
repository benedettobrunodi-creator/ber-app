import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole, requireAnyRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createUserSchema, updateUserSchema, updateProfileSchema, pushTokenSchema, changePasswordSchema, resetPasswordSchema } from './types';

const router = Router();

router.use(authenticate);

router.get('/me', controller.getMe);
router.put('/me', validate(updateProfileSchema), controller.updateMe);
router.put('/me/push-token', validate(pushTokenSchema), controller.updatePushToken);
router.post('/me/change-password', validate(changePasswordSchema), controller.changePassword);

router.get('/', requireAnyRole('coordenacao', 'orcamentos'), controller.listUsers);
router.post('/', requireRole('coordenacao'), validate(createUserSchema), controller.createUser);
router.put('/:id', requireRole('coordenacao'), validate(updateUserSchema), controller.updateUser);
router.put('/:id/password', requireRole('coordenacao'), validate(resetPasswordSchema), controller.resetPassword);
router.delete('/:id', requireRole('coordenacao'), controller.deleteUser);

export default router;
