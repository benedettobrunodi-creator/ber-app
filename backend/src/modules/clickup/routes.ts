import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { syncAllTasksFromClickUp } from '../../services/clickup-tasks-sync';

const router = Router();
router.use(authenticate);

router.post('/sync', requireRole('gestor'), async (req, res, next) => {
  try {
    const results = await syncAllTasksFromClickUp();
    const totals = results.reduce((acc, r) => ({
      obras: acc.obras + 1,
      inserted: acc.inserted + r.inserted,
      updated: acc.updated + r.updated,
    }), { obras: 0, inserted: 0, updated: 0 });
    res.json({ data: results, summary: totals });
  } catch (err) { next(err); }
});

export default router;
