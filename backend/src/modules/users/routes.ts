import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requirePermission } from '../../middleware/permission';
import { createUserSchema, updateUserSchema, updateProfileSchema, pushTokenSchema, changePasswordSchema, resetPasswordSchema } from './types';

const router = Router();

router.use(authenticate);

// Profile routes — accessible to all authenticated users
router.get('/me', controller.getMe);
router.put('/me', validate(updateProfileSchema), controller.updateMe);
router.put('/me/push-token', validate(pushTokenSchema), controller.updatePushToken);
router.post('/me/change-password', validate(changePasswordSchema), controller.changePassword);

// Admin routes — require admin permission
const adminPerm = requirePermission('admin');
router.get('/', adminPerm, controller.listUsers);
router.post('/', adminPerm, validate(createUserSchema), controller.createUser);
router.put('/:id', adminPerm, validate(updateUserSchema), controller.updateUser);
router.put('/:id/password', adminPerm, validate(resetPasswordSchema), controller.resetPassword);
router.delete('/:id', adminPerm, controller.deleteUser);

export default router;
