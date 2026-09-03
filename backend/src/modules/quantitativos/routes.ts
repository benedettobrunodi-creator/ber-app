import { Router } from 'express';
import multer from 'multer';
import * as ctrl from './controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createQuantitativoSchema, updateQuantitativoSchema,
  createItemSchema, updateItemSchema,
} from './types';

// Rotas com prefixo /orcamentos/:orcamentoId/quantitativos
export const orcamentoQuantitativoRouter = Router({ mergeParams: true });
orcamentoQuantitativoRouter.use(authenticate);
orcamentoQuantitativoRouter.get('/', ctrl.listByOrcamento);
orcamentoQuantitativoRouter.post('/', validate(createQuantitativoSchema), ctrl.create);

// Rotas com prefixo /quantitativos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Envie apenas PDFs'));
    cb(null, true);
  },
});

const router = Router();
router.use(authenticate);
router.get('/:id', ctrl.get);
router.patch('/:id', validate(updateQuantitativoSchema), ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/:id/pdfs', upload.single('file'), ctrl.uploadPdf);
router.delete('/:id/pdfs/:attachmentId', ctrl.removePdf);
router.post('/:id/processar', ctrl.processar);
router.post('/:id/itens', validate(createItemSchema), ctrl.createItem);
router.patch('/:id/itens/:itemId', validate(updateItemSchema), ctrl.updateItem);
router.delete('/:id/itens/:itemId', ctrl.deleteItem);

export default router;
