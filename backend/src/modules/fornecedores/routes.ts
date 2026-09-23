import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import * as service from './service';
import { sendSuccess, sendCreated } from '../../utils/response';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

/** /v1/fornecedores — cadastro único global (montado em app.ts, perm 'obras'). */
const router = Router();
router.use(authenticate);

router.get('/', w(async (req, res) => {
  sendSuccess(res, await service.listar(req.query.q as string | undefined));
}));

router.post('/', w(async (req, res) => {
  const r = await service.criar(req.body, (req.user! as { userId: string }).userId);
  if (r.criado) sendCreated(res, r);
  else sendSuccess(res, r); // 200 com similares/jaExistente — o front decide
}));

router.patch('/:id', w(async (req, res) => {
  sendSuccess(res, await service.atualizar(req.params.id, req.body));
}));

export default router;
