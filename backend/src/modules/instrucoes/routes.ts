import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createITSchema, updateITSchema, publishITSchema, bulkITSchema } from './types';

const w = (fn: any) => (req: any, res: any, next: any) => fn(req, res, next).catch(next);

const instrucoesRouter = Router();
instrucoesRouter.use(authenticate);

instrucoesRouter.get('/',         w(controller.list));
instrucoesRouter.get('/:id',      w(controller.getById));
instrucoesRouter.post('/',        requireRole('coordenacao'), validate(createITSchema), w(controller.create));
instrucoesRouter.put('/:id',      requireRole('coordenacao'), validate(updateITSchema), w(controller.update));
instrucoesRouter.patch('/:id/publish', requireRole('coordenacao'), validate(publishITSchema), w(controller.publish));
instrucoesRouter.post('/bulk',    requireRole('coordenacao'), validate(bulkITSchema), w(controller.bulk));

export default instrucoesRouter;
