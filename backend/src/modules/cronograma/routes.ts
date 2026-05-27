import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import multer from 'multer';
import * as ctrl from './controller';

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.use(authenticate);

router.get('/', ctrl.getCronograma);
router.post('/upload', upload.single('file'), ctrl.uploadCronograma);
router.post('/parse', ctrl.parseCronograma);
router.post('/sync', ctrl.syncToKanban);
router.patch('/tasks/:ref', ctrl.updateTaskOverride);
router.delete('/', ctrl.deleteCronograma);

export default router;
