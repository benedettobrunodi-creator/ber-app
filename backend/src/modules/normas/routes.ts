import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';

const normasRouter = Router();
normasRouter.use(authenticate);

normasRouter.get('/search-external', controller.searchExternal);
normasRouter.get('/', controller.listNormas);
normasRouter.get('/:id', controller.getById);

export default normasRouter;
