import { Router } from 'express';
import multer from 'multer';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createCloseOutItemSchema, updateCloseOutItemSchema } from './types';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Montado em /v1/obras/:id/close-out
const obraCloseOutRouter = Router({ mergeParams: true });
obraCloseOutRouter.use(authenticate);
obraCloseOutRouter.get('/', controller.listByObra);
obraCloseOutRouter.get('/manual', controller.manual);
obraCloseOutRouter.post('/aplicar-padrao', requireRole('campo'), controller.aplicarPadrao);
obraCloseOutRouter.post('/', requireRole('campo'), validate(createCloseOutItemSchema), controller.create);
obraCloseOutRouter.patch('/:itemId', requireRole('campo'), validate(updateCloseOutItemSchema), controller.update);
obraCloseOutRouter.post('/:itemId/arquivo', requireRole('campo'), upload.single('file'), controller.uploadArquivo);
obraCloseOutRouter.delete('/:itemId', requireRole('coordenacao'), controller.remove);

export { obraCloseOutRouter };
