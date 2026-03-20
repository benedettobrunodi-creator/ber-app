import { Router } from 'express';
import * as controller from './controller';
import { validate } from '../../middleware/validate';
import { loginSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema } from './types';

const router = Router();

router.post('/login', validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshSchema), controller.refresh);
router.post('/forgot-password', validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), controller.resetPassword);

export default router;
