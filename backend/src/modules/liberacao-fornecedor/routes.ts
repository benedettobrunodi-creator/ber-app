import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import * as service from './service';
import { sendSuccess, sendCreated } from '../../utils/response';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

/** Rota GLOBAL — /v1/liberacao-fornecedor (montada em app.ts, perm 'obras'). */
export const geralRouter = Router();
geralRouter.use(authenticate);

geralRouter.get('/', w(async (_req, res) => {
  sendSuccess(res, await service.getPainelGeral());
}));

geralRouter.patch('/:id/aprovar-financeiro', w(async (req, res) => {
  sendSuccess(res, await service.aprovarFinanceiro(req.params.id, req.body.dataPagamento, req.user! as { userId: string; role: string }));
}));

geralRouter.patch('/:id/aprovar-diretoria', w(async (req, res) => {
  sendSuccess(res, await service.aprovarDiretoria(req.params.id, req.user! as { userId: string; role: string }, req.body.email));
}));

geralRouter.patch('/:id/recusar', w(async (req, res) => {
  sendSuccess(res, await service.recusar(req.params.id, req.body.motivo, req.user! as { userId: string; role: string }));
}));

/** Rota POR OBRA — /v1/obras/:id/liberacao-fornecedor (mergeParams). */
export const obraRouter = Router({ mergeParams: true });
obraRouter.use(authenticate);

obraRouter.get('/opcoes', w(async (req, res) => {
  sendSuccess(res, await service.listarOpcoes(req.params.id));
}));

obraRouter.post('/', w(async (req, res) => {
  sendCreated(res, await service.solicitar(req.params.id, req.body, (req.user! as { userId: string }).userId));
}));
