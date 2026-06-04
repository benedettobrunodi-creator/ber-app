import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import multer from 'multer';
import * as ctrl from './controller';

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authenticate);

router.get('/', ctrl.listRelatorios);
router.post('/', ctrl.createRelatorio);
router.get('/curva-s', ctrl.getCurvaS);
router.put('/curva-s', ctrl.replaceCurvaS);
router.post('/curva-s', ctrl.upsertCurvaSPlanejado);
router.get('/tarefas', ctrl.getAllTarefas);
router.get('/dados-periodo', ctrl.getDadosPeriodo);
router.get('/:relatorioId', ctrl.getRelatorio);
router.patch('/:relatorioId', ctrl.updateRelatorio);
router.delete('/:relatorioId', ctrl.deleteRelatorio);
router.post('/:relatorioId/fotos', upload.single('file'), ctrl.uploadFoto);
router.delete('/:relatorioId/fotos/:fotoId', ctrl.deleteFoto);

export default router;
