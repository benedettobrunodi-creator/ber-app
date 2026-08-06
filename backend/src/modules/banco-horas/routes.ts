import { Router } from 'express';
import * as controller from './controller';
import { validate } from '../../middleware/validate';
import {
  createFeriadoSchema, updateFeriadoSchema, upsertAjusteSchema,
  consumirSchema, processarSchema, marcarPagoSchema,
} from './types';

// authenticate + requirePermission('bancoHoras') são aplicados na montagem em app.ts
const router = Router();

router.get('/feriados', controller.listFeriados);
router.post('/feriados', validate(createFeriadoSchema), controller.createFeriado);
router.patch('/feriados/:id', validate(updateFeriadoSchema), controller.updateFeriado);
router.delete('/feriados/:id', controller.removeFeriado);

router.get('/ajustes', controller.listAjustes);
router.post('/ajustes', validate(upsertAjusteSchema), controller.upsertAjuste);

router.get('/dia', controller.calcularDia);
router.post('/processar', validate(processarSchema), controller.processar);

router.post('/consumir', validate(consumirSchema), controller.consumir);

router.get('/painel', controller.painel);
router.get('/lotes/:userId', controller.lotesPorUsuario);

router.get('/extras', controller.listExtras);
router.patch('/extras/:id', validate(marcarPagoSchema), controller.marcarExtraPago);

export default router;
