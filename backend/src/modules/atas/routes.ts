import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import {
  createTopicoSchema,
  updateTopicoSchema,
  reorderTopicosSchema,
  createReuniaoSchema,
  upsertNotaSchema,
} from './types';
import * as ctrl from './controller';

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

// Rotas montadas sob /obras/:obraId/atas
export const obraAtasRouter = Router({ mergeParams: true });

// Documento completo da ata corrida da obra
obraAtasRouter.get('/', w(ctrl.getAta));

// Tópicos (linhas)
obraAtasRouter.post('/topicos', obraMemberOnly, validate(createTopicoSchema), w(ctrl.createTopico));
obraAtasRouter.patch('/topicos/reorder', obraMemberOnly, validate(reorderTopicosSchema), w(ctrl.reorderTopicos));
obraAtasRouter.patch('/topicos/:topicoId', obraMemberOnly, validate(updateTopicoSchema), w(ctrl.updateTopico));
obraAtasRouter.delete('/topicos/:topicoId', obraMemberOnly, w(ctrl.removeTopico));

// Reuniões (colunas)
obraAtasRouter.post('/reunioes', obraMemberOnly, validate(createReuniaoSchema), w(ctrl.createReuniao));
obraAtasRouter.delete('/reunioes/:reuniaoId', obraMemberOnly, w(ctrl.removeReuniao));

// Notas (células)
obraAtasRouter.put('/notas', obraMemberOnly, validate(upsertNotaSchema), w(ctrl.upsertNota));
