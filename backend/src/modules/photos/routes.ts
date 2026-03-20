import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import * as controller from './controller';
import { createCommentSchema } from './types';
import { env } from '../../config/env';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, env.uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou HEIC.'));
    }
  },
});

// Obra-scoped photo routes (mounted under /obras/:obraId/photos)
export const obraPhotoRoutes = Router({ mergeParams: true });
obraPhotoRoutes.use(authenticate);
obraPhotoRoutes.get('/', requireRole('campo'), controller.listPhotos);
obraPhotoRoutes.post('/', requireRole('campo'), upload.single('image'), controller.uploadPhoto);

// Photo-level routes (mounted under /photos)
const router = Router();
router.use(authenticate);
router.delete('/:id', requireRole('gestor'), controller.deletePhoto);
router.get('/:id/comments', requireRole('campo'), controller.listComments);
router.post('/:id/comments', requireRole('campo'), validate(createCommentSchema), controller.createComment);

export default router;
