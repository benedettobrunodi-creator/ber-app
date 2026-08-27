import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

// Folha é sensível: leitura financeiro+ · fechar/reabrir diretoria.
const router = Router();
router.use(authenticate);
router.get('/preview', requireRole('financeiro', 'diretoria'), controller.preview);
router.get('/fechamentos', requireRole('financeiro', 'diretoria'), controller.list);
router.get('/export', requireRole('financeiro', 'diretoria'), controller.exportCsv);
router.post('/fechar', requireRole('diretoria'), controller.fechar);
router.post('/reabrir', requireRole('diretoria'), controller.reabrir);

export default router;
