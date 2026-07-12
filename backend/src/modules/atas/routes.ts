import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../../middleware/validate';
import { obraMemberOnly } from '../../middleware/obraMemberOnly';
import {
  createTopicoSchema,
  updateTopicoSchema,
  reorderTopicosSchema,
  createAtualizacaoSchema,
  updateAtualizacaoSchema,
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

// Atualizações do tópico (timeline interna)
obraAtasRouter.post('/topicos/:topicoId/atualizacoes', obraMemberOnly, validate(createAtualizacaoSchema), w(ctrl.addAtualizacao));
obraAtasRouter.patch('/atualizacoes/:atualizacaoId', obraMemberOnly, validate(updateAtualizacaoSchema), w(ctrl.updateAtualizacao));
obraAtasRouter.delete('/atualizacoes/:atualizacaoId', obraMemberOnly, w(ctrl.removeAtualizacao));
