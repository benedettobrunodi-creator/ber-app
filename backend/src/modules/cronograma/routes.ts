import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import multer from 'multer';
import * as ctrl from './controller';

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Multer/busboy decodifica o header Content-Disposition como latin1 por
// padrão — nome de arquivo com acento/ç vira mojibake (achado real no
// Controle de Documentos, 03/10/26 — mesmo risco aqui). Reinterpreta como UTF-8.
function corrigirCodificacaoArquivo(req: Request, _res: Response, next: NextFunction) {
  if (req.file) req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  next();
}

router.use(authenticate);

router.get('/', ctrl.getCronograma);
router.post('/upload', upload.single('file'), corrigirCodificacaoArquivo, ctrl.uploadCronograma);
router.post('/parse', ctrl.parseCronograma);

// Depositório do arquivo nativo (MPP/Primavera) — sem parsing, só
// guarda/baixa/substitui (Francisco Gritti, 03/10/26).
router.get('/mpp', ctrl.getCronogramaArquivo);
router.post('/mpp', upload.single('file'), corrigirCodificacaoArquivo, ctrl.uploadCronogramaArquivo);
router.delete('/mpp', ctrl.deleteCronogramaArquivo);
router.post('/sync', ctrl.syncToKanban);
router.patch('/tasks/:ref', ctrl.updateTaskOverride);
router.delete('/', ctrl.deleteCronograma);

export default router;
