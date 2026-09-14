import { Router, Request, Response, NextFunction } from 'express';
import * as ctrl from './controller';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

// Montado sob /v1/reunioes-engenharia (menu Atas do painel de obras, 14/09/26)
const router = Router();

router.get('/', w(ctrl.listar));
router.post('/', w(ctrl.criar));
router.get('/:id', w(ctrl.detalhe));
router.patch('/:id/participantes', w(ctrl.atualizarParticipantes));
router.post('/:id/encerrar', w(ctrl.encerrar));
router.get('/:id/pdf', w(ctrl.pdf));
router.post('/:id/enviar', w(ctrl.enviar));

export default router;
