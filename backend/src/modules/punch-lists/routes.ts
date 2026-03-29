import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as c from './controller';

// Mounted at /v1/obras/:id/punch-lists  and  /v1/punch-lists
export const obraPunchListRouter = Router({ mergeParams: true });
export const punchListRouter = Router();

obraPunchListRouter.use(authenticate);
punchListRouter.use(authenticate);

// GET /obras/:id/punch-lists
obraPunchListRouter.get('/', requireRole('gestor'), c.listByObra);
// POST /obras/:id/punch-lists
obraPunchListRouter.post('/', requireRole('gestor'), c.create);

// POST /punch-lists/:id/items
punchListRouter.post('/:id/items', requireRole('gestor'), c.addItem);
// GET /punch-lists/:id
punchListRouter.get('/:id', requireRole('gestor'), c.getOne);
// PATCH /punch-lists/:id  (update status)
punchListRouter.patch('/:id', requireRole('coordenacao'), c.updateStatus);

// PATCH /punch-list-items/:itemId
export const punchListItemRouter = Router();
punchListItemRouter.use(authenticate);
punchListItemRouter.patch('/:itemId', requireRole('gestor'), c.updateItem);
