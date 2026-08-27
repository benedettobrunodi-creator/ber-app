import { Router } from 'express';
import multer from 'multer';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Folha é sensível: leitura financeiro+ · fechar/reabrir diretoria.
const router = Router();
router.use(authenticate);
router.get('/preview', requireRole('financeiro', 'diretoria'), controller.preview);
router.get('/fechamentos', requireRole('financeiro', 'diretoria'), controller.list);
router.get('/export', requireRole('financeiro', 'diretoria'), controller.exportCsv);
router.post('/fechar', requireRole('diretoria'), controller.fechar);
router.post('/reabrir', requireRole('diretoria'), controller.reabrir);

export default router;

// NFs dos colaboradores PJ — montado em /v1/nfs com perm('ponto'):
// todo colaborador acessa a própria NF; painel/validação só financeiro+.
export const nfRouter = Router();
nfRouter.use(authenticate);
nfRouter.get('/minhas', controller.minhaNf);
nfRouter.post('/', upload.single('file'), controller.enviarNf);
nfRouter.get('/painel', requireRole('financeiro', 'diretoria'), controller.painelNfs);
nfRouter.post('/:id/status', requireRole('financeiro', 'diretoria'), controller.statusNf);
