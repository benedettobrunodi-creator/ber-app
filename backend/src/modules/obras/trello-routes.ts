import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { prisma } from '../../config/database';
import * as trelloService from '../../services/trello';

const router = Router();

router.use(authenticate);

// GET /v1/obras/trello/boards — lista boards disponíveis no Trello
router.get(
  '/trello/boards',
  requireRole('coordenacao'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const boards = await trelloService.getBoards();
      res.json({ data: boards });
    } catch (err) {
      next(err);
    }
  }
);

// POST /v1/obras/:id/trello/sync — vincula board e sincroniza tarefas
router.post(
  '/:id/trello/sync',
  requireRole('coordenacao'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { boardId } = req.body;

      if (!boardId || typeof boardId !== 'string') {
        res.status(400).json({ error: 'boardId é obrigatório' });
        return;
      }

      const result = await trelloService.syncObraFromTrello(id, boardId);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }
);

// GET /v1/obras/:id/trello/lists — debug: lista nomes das listas do board vinculado
router.get(
  '/:id/trello/lists',
  requireRole('coordenacao'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const obra = await prisma.obra.findUnique({
        where: { id: req.params.id },
        select: { trelloBoardId: true, name: true },
      });

      if (!obra?.trelloBoardId) {
        res.status(400).json({ error: 'Obra não possui board vinculado' });
        return;
      }

      const lists = await trelloService.getBoardLists(obra.trelloBoardId);
      console.log(`[Trello Debug] Listas do board ${obra.trelloBoardId} (obra: ${obra.name}):`);
      lists.forEach((l, i) => console.log(`  ${i + 1}. "${l.name}" (id: ${l.id})`));

      res.json({ data: { boardId: obra.trelloBoardId, lists: lists.map((l) => ({ id: l.id, name: l.name })) } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
