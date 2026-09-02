/**
 * Relatório de Recebimento do Imóvel — dois routers com prefixo específico
 * (NUNCA montar em /v1 raiz: o middleware de permissão vazaria pra todas as
 * rotas, inclusive /v1/auth).
 *   obraRecebimentoRouter → /v1/obras  (GET /:id/recebimento)
 *   recebimentoRouter     → /v1/recebimento (demais operações)
 */
import { Router } from 'express';
import multer from 'multer';
import * as controller from './controller';

// Fotos comprimidas no cliente (canvas → JPEG); 15MB de folga por arquivo.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 60 } });

export const obraRecebimentoRouter = Router();
obraRecebimentoRouter.get('/:id/recebimento', controller.getRelatorio);

export const recebimentoRouter = Router();
recebimentoRouter.patch('/:relatorioId', controller.patchRelatorio);
recebimentoRouter.post('/:relatorioId/fotos', upload.array('fotos', 60), controller.uploadFotos);
recebimentoRouter.post('/:relatorioId/ambientes', controller.createAmbiente);
recebimentoRouter.get('/:relatorioId/pdf', controller.downloadPdf);
recebimentoRouter.patch('/fotos/:fotoId', controller.patchFoto);
recebimentoRouter.delete('/fotos/:fotoId', controller.removeFoto);
recebimentoRouter.post('/fotos/:fotoId/sugerir-legenda', controller.sugerirLegenda);
recebimentoRouter.patch('/ambientes/:ambienteId', controller.patchAmbiente);
recebimentoRouter.delete('/ambientes/:ambienteId', controller.removeAmbiente);
