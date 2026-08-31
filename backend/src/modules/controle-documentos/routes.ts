import { Router } from 'express';
import multer from 'multer';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createDocumentoSchema, updateDocumentoSchema, createRevisaoSchema } from './types';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Montado em /v1/obras/:id/controle-documentos — NÃO confundir com
// /v1/obras/:obraId/documentos (módulo distinto, Gestão 360, 1 revisão em
// texto livre + workflow de aprovação). Este é o controle de revisões
// normalizado (histórico ilimitado, arquivo por revisão) pedido pelo Bruno
// 31/08/26 depois de analisar uma planilha real de controle de documentos.
const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/', controller.list);
router.post('/', requireRole('campo'), validate(createDocumentoSchema), controller.create);
router.patch('/:documentoId', requireRole('campo'), validate(updateDocumentoSchema), controller.update);
router.delete('/:documentoId', requireRole('coordenacao'), controller.remove);

router.get('/:documentoId/proxima-revisao', controller.proximaRevisao);
router.post('/:documentoId/revisoes', requireRole('campo'), upload.single('file'), validate(createRevisaoSchema), controller.addRevisao);
router.delete('/:documentoId/revisoes/:revisaoId', requireRole('coordenacao'), controller.removeRevisao);

export default router;
