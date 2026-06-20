import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../../middleware/auth';
import { isR2Configured } from '../../services/storage';
import * as ctrl from './controller';

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, process.env.UPLOAD_DIR || './uploads'),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: isR2Configured() ? multer.memoryStorage() : diskStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const w = (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

const r = Router();
r.use(authenticate);

r.get('/',         w(ctrl.list));
r.post('/',        upload.single('file'), w(ctrl.upload));
r.delete('/:id',   w(ctrl.remove));

export default r;
