import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as service from './service';
import { sendSuccess, sendCreated, sendNoContent } from '../../utils/response';

// Montado em /v1/obras/:id/liberacao-medicao (app.ts).
// Semáforo "pode medir?" por fornecedor — ver service.ts. Consulta: todos os
// membros; override (exceção): a checagem de papel fica no service.
const router = Router({ mergeParams: true });
router.use(authenticate);

const overrideSchema = z.object({
  liberado: z.boolean(),
  justificativa: z.string().min(5).max(2000),
});
const vinculoSchema = z.object({ planoId: z.string().uuid().nullable() });

router.get('/', async (req: Request, res: Response) => {
  sendSuccess(res, await service.getPainel(req.params.id));
});

router.post('/:planoId/override', validate(overrideSchema), async (req: Request, res: Response) => {
  sendCreated(res, await service.criarOverride(req.params.id, req.params.planoId, req.body, req.user! as { userId: string; role: string }));
});

router.delete('/:planoId/override', async (req: Request, res: Response) => {
  await service.removerOverride(req.params.id, req.params.planoId, req.user! as { role: string });
  sendNoContent(res);
});

router.patch('/fichas/:fvsId/vinculo', validate(vinculoSchema), async (req: Request, res: Response) => {
  sendSuccess(res, await service.vincularFicha(req.params.id, req.params.fvsId, req.body.planoId));
});

export default router;
