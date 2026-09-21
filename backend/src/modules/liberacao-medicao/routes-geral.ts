import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import * as service from './service';
import { sendSuccess } from '../../utils/response';

// Montado em /v1/liberacao-medicao (app.ts) — painel GERAL, todas as obras
// juntas (Bruno 21/09/26: item de menu lateral em vez de entrar obra por
// obra). Ações (override/vincular) continuam só na tela por obra, que já
// funciona; aqui é leitura/consulta.
const router = Router();
router.use(authenticate);

router.get('/', async (_req: Request, res: Response) => {
  sendSuccess(res, await service.getPainelGeral());
});

export default router;
