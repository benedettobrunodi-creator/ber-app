import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createITSchema, updateITSchema, publishITSchema } from './types';

const instrucoesRouter = Router();
instrucoesRouter.use(authenticate);

instrucoesRouter.get('/', controller.list);
instrucoesRouter.get('/:id', controller.getById);
instrucoesRouter.post('/', requireRole('coordenacao'), validate(createITSchema), controller.create);
instrucoesRouter.put('/:id', requireRole('coordenacao'), validate(updateITSchema), controller.update);
instrucoesRouter.patch('/:id/publish', requireRole('coordenacao'), validate(publishITSchema), controller.publish);

export default instrucoesRouter;
