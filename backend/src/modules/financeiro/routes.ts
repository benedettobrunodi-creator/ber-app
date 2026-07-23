import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as ctrl from './controller';

// Permissão de módulo já vem do app.ts (requirePermission('financeiro')).
// Aqui só authenticate como reforço + roteamento.

const router = Router();
router.use(authenticate);

// Ciclos
router.get('/ciclos', ctrl.listCiclos);
router.post('/ciclos', ctrl.createCiclo);
router.patch('/ciclos/:id', ctrl.updateCiclo);
router.delete('/ciclos/:id', ctrl.deleteCiclo);
router.post('/ciclos/:id/duplicar', ctrl.duplicarCiclo);

// Snapshot (ciclo + linhas + valores)
router.get('/ciclos/:cicloId/snapshot', ctrl.getSnapshot);

// Linhas
router.post('/ciclos/:cicloId/linhas', ctrl.createLinha);
router.patch('/linhas/:linhaId', ctrl.updateLinha);
router.delete('/linhas/:linhaId', ctrl.deleteLinha);
router.post('/ciclos/:cicloId/linhas/reorder', ctrl.reorderLinhas);

// Valores
router.put('/linhas/:linhaId/valor', ctrl.setValor);

export default router;
