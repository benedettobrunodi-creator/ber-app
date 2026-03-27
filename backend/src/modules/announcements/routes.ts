import { Router } from 'express';
import * as controller from './controller';
import * as comunicadoController from './comunicado.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createAnnouncementSchema, updateAnnouncementSchema } from './types';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('campo'), controller.listAnnouncements);
router.get('/:id', requireRole('campo'), controller.getAnnouncement);
router.post('/', requireRole('coordenacao'), validate(createAnnouncementSchema), controller.createAnnouncement);
router.put('/:id', requireRole('coordenacao'), validate(updateAnnouncementSchema), controller.updateAnnouncement);
router.delete('/:id', requireRole('diretoria'), controller.deleteAnnouncement);
router.get('/:id/reads', requireRole('coordenacao'), controller.getReads);

// Comunicado semanal
router.post('/:id/enviar', requireRole('coordenacao'), comunicadoController.enviarComunicado);

// Obra-scoped comunicado routes
const obraComunicadoRouter = Router({ mergeParams: true });
obraComunicadoRouter.use(authenticate);
obraComunicadoRouter.post('/comunicado-semanal/gerar', requireRole('gestor'), comunicadoController.gerarComunicadoSemanal);

export { obraComunicadoRouter };
export default router;
