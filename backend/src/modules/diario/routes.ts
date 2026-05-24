import { Router } from 'express';
import multer from 'multer';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  createDiarioSchema, updateDiarioSchema,
  createEfetivoSchema, createAtividadeSchema, createOcorrenciaSchema,
  createVisitaSchema, createMaterialSchema, createEquipamentoSchema,
} from './types';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Nested under /obras/:id/diario
export const obraDiarioRouter = Router({ mergeParams: true });
obraDiarioRouter.use(authenticate);
obraDiarioRouter.get('/', controller.listByObra);
obraDiarioRouter.post('/', validate(createDiarioSchema), controller.create);

// Standalone /diario/:diarioId
const diarioRouter = Router();

// Public route — no auth
diarioRouter.get('/publico/:token', controller.getPublico);

diarioRouter.use(authenticate);
diarioRouter.get('/:diarioId', controller.getById);
diarioRouter.patch('/:diarioId', validate(updateDiarioSchema), controller.update);
diarioRouter.post('/:diarioId/fechar', controller.fechar);
diarioRouter.post('/:diarioId/reabrir', requireRole('gestor'), controller.reabrir);
diarioRouter.delete('/:diarioId', requireRole('gestor'), controller.deleteDiario);

// Sub-entities — todos os autenticados criam e removem
diarioRouter.post('/:diarioId/efetivos', validate(createEfetivoSchema), controller.addEfetivo);
diarioRouter.delete('/:diarioId/efetivos/:efId', controller.removeEfetivo);

diarioRouter.post('/:diarioId/atividades', validate(createAtividadeSchema), controller.addAtividade);
diarioRouter.delete('/:diarioId/atividades/:atId', controller.removeAtividade);

diarioRouter.post('/:diarioId/ocorrencias', validate(createOcorrenciaSchema), controller.addOcorrencia);
diarioRouter.delete('/:diarioId/ocorrencias/:ocId', controller.removeOcorrencia);

diarioRouter.post('/:diarioId/visitas', validate(createVisitaSchema), controller.addVisita);
diarioRouter.delete('/:diarioId/visitas/:viId', controller.removeVisita);

diarioRouter.post('/:diarioId/materiais', validate(createMaterialSchema), controller.addMaterial);
diarioRouter.delete('/:diarioId/materiais/:matId', controller.removeMaterial);

diarioRouter.post('/:diarioId/equipamentos', validate(createEquipamentoSchema), controller.addEquipamento);
diarioRouter.delete('/:diarioId/equipamentos/:eqId', controller.removeEquipamento);

// Fotos
diarioRouter.post('/:diarioId/fotos', upload.single('file'), controller.addFoto);
diarioRouter.delete('/:diarioId/fotos/:fotoId', controller.removeFoto);

export default diarioRouter;
