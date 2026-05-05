import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireAnyRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createOrcamentoSchema, updateOrcamentoSchema } from './types';

const router = Router();

router.use(authenticate);

router.get('/stats',       controller.getStats);
router.get('/timeline',    controller.getTimeline);
router.get('/',            controller.listOrcamentos);
router.get('/:id',         controller.getOrcamento);
router.post('/',             validate(createOrcamentoSchema), controller.createOrcamento);
router.post('/reorder',      controller.reorderOrcamentos);
router.patch('/:id',         validate(updateOrcamentoSchema), controller.updateOrcamento);
router.delete('/:id',        requireAnyRole('coordenacao', 'orcamentos'), controller.deleteOrcamento);
router.post('/:id/duplicar', controller.duplicarOrcamento);

export default router;
