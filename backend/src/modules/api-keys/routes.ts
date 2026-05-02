import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as controller from './controller';

const router = Router();
router.use(authenticate);
router.get('/',     controller.listKeys);
router.post('/',    controller.createKey);
router.delete('/:id', controller.revokeKey);

export default router;
