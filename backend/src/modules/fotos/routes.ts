import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../../middleware/auth';
import * as ctrl from './controller';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

const w = (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const r = Router({ mergeParams: true });
r.use(authenticate);

// Plantas
r.get('/plantas',                  w(ctrl.listPlantas));
r.post('/plantas',                 upload.single('file'), w(ctrl.createPlanta));
r.delete('/plantas/:plantaId',     w(ctrl.deletePlanta));

// Ambientes
r.get('/ambientes',                w(ctrl.listAmbientes));
r.post('/ambientes',               w(ctrl.createAmbiente));
r.patch('/ambientes/:ambienteId',  w(ctrl.updateAmbiente));
r.delete('/ambientes/:ambienteId', w(ctrl.deleteAmbiente));

// Fotos
r.get('/fotos',                    w(ctrl.listFotos));
r.post('/fotos',                   upload.single('file'), w(ctrl.createFoto));
r.post('/fotos/batch',             w(ctrl.createFotosBatch));
r.delete('/fotos/:fotoId',         w(ctrl.deleteFoto));
r.get('/fotos/referencia',         w(ctrl.getFotoReferencia));

export default r;
