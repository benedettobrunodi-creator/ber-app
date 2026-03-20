import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  createSequenciamentoSchema,
  startEtapaSchema,
  submitEtapaSchema,
  approveEtapaSchema,
  rejectEtapaSchema,
  updateEtapaSchema,
  reorderEtapasSchema,
  addEtapaSchema,
} from './types';

// ─── Templates (global) ────────────────────────────────────────────────────
const templateRouter = Router();
templateRouter.use(authenticate);
templateRouter.get('/', controller.listTemplates);

// ─── Obra-scoped: /obras/:id/sequenciamento ─────────────────────────────
const obraSeqRouter = Router({ mergeParams: true });
obraSeqRouter.use(authenticate);
obraSeqRouter.get('/', controller.getSequenciamento);
obraSeqRouter.post('/', requireRole('gestor'), validate(createSequenciamentoSchema), controller.createSequenciamento);
obraSeqRouter.post('/freeze', requireRole('gestor'), controller.freezeSequenciamento);
obraSeqRouter.put('/reorder', requireRole('gestor'), validate(reorderEtapasSchema), controller.reorderEtapas);
obraSeqRouter.post('/etapas', requireRole('gestor'), validate(addEtapaSchema), controller.addEtapa);

// ─── Obra etapa actions: /obras/:id/etapas/:etapaId/* ────────────────────
const obraEtapaRouter = Router({ mergeParams: true });
obraEtapaRouter.use(authenticate);
obraEtapaRouter.put('/:etapaId', requireRole('gestor'), validate(updateEtapaSchema), controller.updateEtapa);
obraEtapaRouter.delete('/:etapaId', requireRole('gestor'), controller.removeEtapa);
obraEtapaRouter.patch('/:etapaId/start', requireRole('gestor'), validate(startEtapaSchema), controller.startEtapa);
obraEtapaRouter.patch('/:etapaId/submit', requireRole('gestor'), validate(submitEtapaSchema), controller.submitEtapa);
obraEtapaRouter.patch('/:etapaId/approve', requireRole('coordenacao'), validate(approveEtapaSchema), controller.approveEtapa);
obraEtapaRouter.patch('/:etapaId/reject', requireRole('coordenacao'), validate(rejectEtapaSchema), controller.rejectEtapa);

export { templateRouter as seqTemplateRouter, obraSeqRouter, obraEtapaRouter };
