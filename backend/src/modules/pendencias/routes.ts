import { Router } from 'express';
import multer from 'multer';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createPendenciaSchema, updatePendenciaSchema, mudarStatusSchema } from './types';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Montado em /v1/obras/:id/pendencias — campo (engenheiro residente) pode
// criar, editar, fotografar e dar baixa; exclusão é de coordenação pra cima.
const obraPendenciasRouter = Router({ mergeParams: true });
obraPendenciasRouter.use(authenticate);
obraPendenciasRouter.get('/', controller.listByObra);
obraPendenciasRouter.get('/resumo', controller.resumoByObra);
obraPendenciasRouter.get('/pdf', async (req, res, next) => {
  try {
    const { downloadPendenciasPdf } = await import('./pdf.controller');
    await downloadPendenciasPdf(req, res);
  } catch (e) { next(e); }
});
obraPendenciasRouter.post('/', requireRole('campo'), validate(createPendenciaSchema), controller.create);
obraPendenciasRouter.patch('/:pendenciaId', requireRole('campo'), validate(updatePendenciaSchema), controller.update);
obraPendenciasRouter.patch('/:pendenciaId/status', requireRole('campo'), validate(mudarStatusSchema), controller.mudarStatus);
obraPendenciasRouter.post('/:pendenciaId/foto/:tipo', requireRole('campo'), upload.single('file'), controller.uploadFoto);
obraPendenciasRouter.delete('/:pendenciaId', requireRole('coordenacao'), controller.remove);

export { obraPendenciasRouter };
