import { Router } from 'express';
import multer from 'multer';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createVistoriaSchema, resolverPendenciaSchema } from './types';

// Montado em /v1/obras/:id/qualidade (app.ts). Vistoria de Qualidade —
// digitalização do Checklist MODELO.xlsx (03/09/26). Preencher: campo+
// (decisão Bruno msg 11128: "todos"). Excluir vistoria: coordenação+.
const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/template', controller.template);
router.get('/atividades', controller.atividadesCatalogo);
router.get('/', controller.painel);
router.post('/', requireRole('campo'), validate(createVistoriaSchema), controller.create);
router.get('/vistorias/:vistoriaId', controller.getOne);
router.delete('/vistorias/:vistoriaId', requireRole('coordenacao'), controller.remove);
router.patch('/pendencias/:itemId', requireRole('campo'), validate(resolverPendenciaSchema), controller.resolverPendencia);

// Foto de evidência por item (comprimida no cliente; 15MB de folga)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
router.post('/itens/:itemId/foto', requireRole('campo'), upload.single('file'), controller.uploadFoto);

export default router;
