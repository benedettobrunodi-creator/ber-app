import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as controller from './controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authenticate);

router.get('/:id/compras', requireRole('campo'), controller.list);
router.post('/:id/compras/import', requireRole('gestor'), upload.single('file'), controller.importXlsx);
router.patch('/:id/compras/:itemId', requireRole('campo'), controller.update);
router.delete('/:id/compras', requireRole('gestor'), controller.clear);
router.post('/:id/compras/:itemId/splits', requireRole('campo'), controller.addSplit);
router.patch('/:id/compras/:itemId/splits/:splitId', requireRole('campo'), controller.updateSplit);
router.delete('/:id/compras/:itemId/splits/:splitId', requireRole('campo'), controller.deleteSplit);

export default router;
