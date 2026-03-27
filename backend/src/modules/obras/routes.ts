import { Router } from 'express';
import * as controller from './controller';
import * as faseController from './fase.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createObraSchema, updateObraSchema, addMemberSchema } from './types';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('gestor'), controller.listObras);
router.post("/progresso", controller.updateProgresso);
router.get('/:id', requireRole('gestor'), controller.getObra);
router.post('/', requireRole('coordenacao'), validate(createObraSchema), controller.createObra);
router.put('/:id', requireRole('coordenacao'), validate(updateObraSchema), controller.updateObra);

router.get('/:id/members', requireRole('gestor'), controller.getMembers);
router.post('/:id/members', requireRole('coordenacao'), validate(addMemberSchema), controller.addMember);
router.delete('/:id/members/:userId', requireRole('coordenacao'), controller.removeMember);

router.get('/:id/stats', requireRole('gestor'), controller.getStats);

// Fase management
router.put('/:id/fase', requireRole('coordenacao'), faseController.updateFase);
router.get('/:id/fase-history', requireRole('gestor'), faseController.getFaseHistory);

export default router;
