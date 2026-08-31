import { Router } from 'express';
import multer from 'multer';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createAmostraSchema, updateAmostraSchema } from './types';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Montado em /v1/obras/:id/amostras — campo (engenheiro residente) cria,
// edita, fotografa e dispara e-mail; exclusão é de coordenação pra cima.
const router = Router({ mergeParams: true });
router.use(authenticate);

router.get('/', controller.list);
router.post('/', requireRole('campo'), validate(createAmostraSchema), controller.create);
router.patch('/:amostraId', requireRole('campo'), validate(updateAmostraSchema), controller.update);
router.post('/:amostraId/foto', requireRole('campo'), upload.single('file'), controller.uploadFoto);
router.delete('/:amostraId/foto', requireRole('campo'), controller.removeFoto);
router.post('/:amostraId/enviar-email', requireRole('campo'), controller.enviarEmail);
router.delete('/:amostraId', requireRole('coordenacao'), controller.remove);

export default router;
