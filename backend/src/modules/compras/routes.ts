import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as controller from './controller';

// mergeParams: o :id da obra vem do mount em app.ts (/v1/obras/:id/compras).
// Paths relativos ao mount — NÃO repetir /:id/compras aqui, senão o gate
// perm('comprasDashboard') do mount amplo vazava para relatorios/diario/cronograma.
const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authenticate);

router.get('/config', requireRole('campo'), controller.getConfig);
router.put('/config', requireRole('gestor'), controller.upsertConfig);
router.get('/', requireRole('campo'), controller.list);
router.post('/import', requireRole('gestor'), upload.single('file'), controller.importXlsx);
router.post('/', requireRole('campo'), controller.createItem);
router.patch('/:itemId', requireRole('campo'), controller.update);
router.delete('/', requireRole('gestor'), controller.clear);
router.delete('/:itemId', requireRole('campo'), controller.deleteItem);
router.post('/:itemId/splits', requireRole('campo'), controller.addSplit);
router.patch('/:itemId/splits/:splitId', requireRole('campo'), controller.updateSplit);
router.delete('/:itemId/splits/:splitId', requireRole('campo'), controller.deleteSplit);

export default router;
