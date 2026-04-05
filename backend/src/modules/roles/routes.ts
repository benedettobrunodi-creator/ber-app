import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as ctrl from './controller';

const w = (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const router = Router();
router.use(authenticate);

router.get('/modules', w(ctrl.listModules));
router.get('/', requireRole('coordenacao'), w(ctrl.listRoles));
router.get('/:id', requireRole('coordenacao'), w(ctrl.getRole));
router.post('/', requireRole('diretoria'), w(ctrl.createRole));
router.put('/:id', requireRole('diretoria'), w(ctrl.updateRole));
router.delete('/:id', requireRole('diretoria'), w(ctrl.deleteRole));

export default router;
