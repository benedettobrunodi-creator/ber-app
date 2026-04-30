import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { syncAllTasksFromClickUp } from '../../services/clickup-tasks-sync';
import { getFolders, SPACES, extractObraName, nameMatches } from '../../services/clickup';
import { prisma } from '../../config/database';

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

// Diagnóstico: lista todos os folders encontrados no ClickUp e quais matchearam
router.get('/debug', requireRole('gestor'), async (req, res, next) => {
  try {
    const obras = await prisma.obra.findMany({
      where: { status: { in: ['em_andamento', 'planejamento'] } },
      select: { id: true, name: true },
    });

    const spaceNames: Record<string, string> = {
      [SPACES.PROJETOS]:   'PROJETOS',
      [SPACES.ENGENHARIA]: 'ENGENHARIA',
      [SPACES.COMPRAS]:    'COMPRAS',
      [SPACES.ORCAMENTOS]: 'ORCAMENTOS',
    };

    const result: Record<string, { spaceId: string; folders: { id: string; name: string; extracted: string | null; matchedObra: string | null }[] }> = {};

    for (const [spaceId, spaceName] of Object.entries(spaceNames)) {
      try {
        const folders = await getFolders(spaceId);
        result[spaceName] = {
          spaceId,
          folders: folders.map(f => {
            const extracted = extractObraName(f.name);
            const matched = extracted ? obras.find(o => nameMatches(o.name, extracted)) : null;
            return { id: f.id, name: f.name, extracted, matchedObra: matched?.name ?? null };
          }),
        };
      } catch (err: any) {
        result[spaceName] = { spaceId, folders: [] };
      }
    }

    res.json({ obras: obras.map(o => o.name), spaces: result });
  } catch (err) { next(err); }
});

export default router;
