import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { sendSuccess, sendNoContent } from '../../utils/response';
import * as service from './service';

// Montado em /v1/push (11/09/26) — inscrição do PWA nos alertas.
const router = Router();

router.get('/chave-publica', (_req: Request, res: Response) => {
  sendSuccess(res, { chave: service.chavePublica() });
});

router.use(authenticate);

const subSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(300), auth: z.string().max(100) }),
});

router.post('/inscrever', validate(subSchema), async (req: Request, res: Response) => {
  await service.inscrever(req.user!.userId, req.body);
  sendSuccess(res, { ok: true });
});

router.post('/desinscrever', async (req: Request, res: Response) => {
  if (typeof req.body?.endpoint === 'string') await service.desinscrever(req.body.endpoint);
  sendNoContent(res);
});

export default router;
