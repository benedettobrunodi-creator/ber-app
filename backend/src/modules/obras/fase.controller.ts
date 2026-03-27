import { Request, Response } from 'express';
import * as faseService from './fase.service';
import { sendSuccess } from '../../utils/response';

export async function updateFase(req: Request, res: Response) {
  const { fase, notes } = req.body;
  if (!fase) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Campo "fase" é obrigatório' } });
  }

  const result = await faseService.updateFase(req.params.id, fase, req.user!.userId, notes);

  if (result.blocked) {
    return res.status(422).json({
      error: {
        code: 'FASE_BLOCKED',
        message: result.message,
        blockingChecklists: result.blockingChecklists,
      },
    });
  }

  sendSuccess(res, result);
}

export async function getFaseHistory(req: Request, res: Response) {
  const history = await faseService.getFaseHistory(req.params.id);
  sendSuccess(res, history);
}
