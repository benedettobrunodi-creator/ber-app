/**
 * Fase do Sequenciamento da obra (PP1..PP6) — leitura, correção manual e
 * reprocessamento sob demanda. (02/09/26)
 */
import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';
import { getFaseObra, atualizarLeituraCronograma, FASES_SEQ } from '../../services/fase-sequenciamento';

export async function getFaseSeq(req: Request, res: Response) {
  const fase = await getFaseObra(req.params.id);
  sendSuccess(res, fase);
}

/** Correção manual: body { faseManual: 'PP1'..'PP6' } ou { faseManual: null } pra voltar ao automático. */
export async function setFaseSeqManual(req: Request, res: Response) {
  const { faseManual } = req.body as { faseManual: string | null };
  if (faseManual !== null && !FASES_SEQ.includes(faseManual as never)) {
    throw AppError.badRequest(`faseManual inválida. Use ${FASES_SEQ.join(', ')} ou null pra automático.`);
  }
  await prisma.obra.update({ where: { id: req.params.id }, data: { faseSeqManual: faseManual } });
  sendSuccess(res, await getFaseObra(req.params.id));
}

/** Reprocessa a leitura do cronograma agora (botão "reler cronograma"). */
export async function relerCronograma(req: Request, res: Response) {
  try {
    await atualizarLeituraCronograma(req.params.id);
  } catch (e) {
    throw AppError.badRequest(`Leitura do cronograma falhou: ${(e as Error).message.slice(0, 160)}`);
  }
  sendSuccess(res, await getFaseObra(req.params.id));
}
