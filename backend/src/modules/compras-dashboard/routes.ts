import { Router } from 'express';
import * as controller from './controller';

const router = Router();

// authenticate + permission('admin') já aplicados na montagem em app.ts
router.get('/summary', controller.getSummary);

export default router;
