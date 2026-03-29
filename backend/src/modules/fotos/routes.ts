import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import * as ctrl from './controller';

const w = (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const r = Router({ mergeParams: true });
r.use(authenticate);

// Plantas
r.get('/plantas',                  w(ctrl.listPlantas));
r.post('/plantas',                 w(ctrl.createPlanta));
r.delete('/plantas/:plantaId',     w(ctrl.deletePlanta));

// Ambientes
r.get('/ambientes',                w(ctrl.listAmbientes));
r.post('/ambientes',               w(ctrl.createAmbiente));
r.patch('/ambientes/:ambienteId',  w(ctrl.updateAmbiente));
r.delete('/ambientes/:ambienteId', w(ctrl.deleteAmbiente));

// Fotos
r.get('/fotos',                    w(ctrl.listFotos));
r.post('/fotos',                   w(ctrl.createFoto));
r.post('/fotos/batch',             w(ctrl.createFotosBatch));
r.delete('/fotos/:fotoId',         w(ctrl.deleteFoto));
r.get('/fotos/referencia',         w(ctrl.getFotoReferencia));

export default r;
