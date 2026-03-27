import { Request, Response } from 'express';
import * as comunicadoService from './comunicado.service';
import { sendCreated, sendSuccess } from '../../utils/response';

export async function gerarComunicadoSemanal(req: Request, res: Response) {
  const obraId = req.params.id || req.params.obraId;
  const comunicado = await comunicadoService.gerarComunicadoSemanal(obraId, req.user!.userId);
  sendCreated(res, comunicado);
}

export async function enviarComunicado(req: Request, res: Response) {
  const comunicado = await comunicadoService.enviarComunicado(req.params.id);
  sendSuccess(res, comunicado);
}
