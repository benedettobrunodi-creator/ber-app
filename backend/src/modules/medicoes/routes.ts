import { Router } from 'express';
import * as c from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

const router = Router();
router.use(authenticate);

// Medição-level routes
router.get('/:id', (req, res, next) => c.getMedicao(req, res, next).catch(next));
router.patch('/:id', (req, res, next) => c.updateMedicao(req, res, next).catch(next));
router.patch('/:id/lancamentos', requireRole('gestor'), (req, res, next) => c.saveLancamentos(req, res, next).catch(next));
router.patch('/:id/status', requireRole('coordenacao'), (req, res, next) => c.updateStatus(req, res, next).catch(next));

export default router;
