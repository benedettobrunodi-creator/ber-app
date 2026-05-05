import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole, requireAnyRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createProposalSchema, updateProposalSchema } from './types';

const router = Router();

router.use(authenticate);

router.get('/stats', requireAnyRole('coordenacao', 'orcamentos'), controller.getStats);
router.get('/agendor-stats', requireRole('coordenacao'), controller.agendorStats);
router.get('/sync-agendor', requireRole('diretoria'), controller.syncAgendor);
router.post('/sync', requireRole('diretoria'), controller.syncAgendor);
router.get('/', requireAnyRole('coordenacao', 'orcamentos'), controller.listProposals);
router.get('/:id', requireAnyRole('coordenacao', 'orcamentos'), controller.getProposal);
router.post('/', requireRole('coordenacao'), validate(createProposalSchema), controller.createProposal);
router.put('/:id', requireRole('coordenacao'), validate(updateProposalSchema), controller.updateProposal);

export default router;
