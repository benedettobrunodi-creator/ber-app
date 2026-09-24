import { Router } from 'express';
import * as controller from './controller';
import { getGestao } from './gestao';

const router = Router();

// authenticate + permission('admin') já aplicados na montagem em app.ts
router.get('/summary', controller.getSummary);
// Painel de gestão pra CFO/CEO (24/09/26) — processo: contratações, medição, fornecedores.
router.get('/gestao', getGestao);

export default router;
