import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createRecebimentoSchema, updateRecebimentoSchema } from './types';

// Nested under /obras/:id/recebimentos
export const obraRecebimentoRouter = Router({ mergeParams: true });
obraRecebimentoRouter.use(authenticate);
obraRecebimentoRouter.get('/', controller.listByObra);
obraRecebimentoRouter.post('/', requireRole('gestor'), validate(createRecebimentoSchema), controller.create);

// Standalone /recebimentos/:id
const recebimentoRouter = Router();
recebimentoRouter.use(authenticate);
recebimentoRouter.get('/:id', controller.getById);
recebimentoRouter.patch('/:id', requireRole('gestor'), validate(updateRecebimentoSchema), controller.update);

export default recebimentoRouter;
