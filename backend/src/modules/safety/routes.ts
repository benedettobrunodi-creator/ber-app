import { Router } from 'express';
import * as controller from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  createAPRSchema, updateAPRSchema, approveAPRSchema,
  createEPISchema, updateEPISchema,
  createIncidentSchema, updateIncidentSchema,
  createTrainingSchema,
} from './types';

// ─── APR routes (obra-scoped: /obras/:id/apr) ──
const aprObraRouter = Router({ mergeParams: true });
aprObraRouter.use(authenticate);
aprObraRouter.get('/', controller.listAPRs);
aprObraRouter.post('/', requireRole('campo'), validate(createAPRSchema), controller.createAPR);

const aprRouter = Router();
aprRouter.use(authenticate);
aprRouter.get('/:id', controller.getAPR);
aprRouter.put('/:id', requireRole('gestor'), validate(updateAPRSchema), controller.updateAPR);
aprRouter.patch('/:id/approve', requireRole('coordenacao'), validate(approveAPRSchema), controller.approveAPR);
aprRouter.delete('/:id', requireRole('coordenacao'), controller.deleteAPR);

// ─── EPI routes (obra-scoped: /obras/:id/epi) ──
const epiObraRouter = Router({ mergeParams: true });
epiObraRouter.use(authenticate);
epiObraRouter.get('/', controller.listEPIs);
epiObraRouter.post('/', requireRole('gestor'), validate(createEPISchema), controller.createEPI);

const epiRouter = Router();
epiRouter.use(authenticate);
epiRouter.get('/expiring', requireRole('gestor'), controller.getExpiringEPIs);
epiRouter.put('/:id', requireRole('gestor'), validate(updateEPISchema), controller.updateEPI);
epiRouter.delete('/:id', requireRole('coordenacao'), controller.deleteEPI);

// ─── Incident routes (obra-scoped: /obras/:id/incidents) ──
const incidentObraRouter = Router({ mergeParams: true });
incidentObraRouter.use(authenticate);
incidentObraRouter.get('/', controller.listIncidents);
incidentObraRouter.post('/', requireRole('campo'), validate(createIncidentSchema), controller.createIncident);

const incidentRouter = Router();
incidentRouter.use(authenticate);
incidentRouter.get('/:id', controller.getIncident);
incidentRouter.put('/:id', requireRole('gestor'), validate(updateIncidentSchema), controller.updateIncident);
incidentRouter.delete('/:id', requireRole('coordenacao'), controller.deleteIncident);

// ─── Training routes (global) ──
const trainingRouter = Router();
trainingRouter.use(authenticate);
trainingRouter.get('/', controller.listTrainings);
trainingRouter.get('/expiring', requireRole('gestor'), controller.getExpiringTrainings);
trainingRouter.post('/', requireRole('gestor'), validate(createTrainingSchema), controller.createTraining);
trainingRouter.delete('/:id', requireRole('coordenacao'), controller.deleteTraining);

// ─── Export route ──
const segurancaRouter = Router();
segurancaRouter.use(authenticate);
segurancaRouter.get('/export', requireRole('gestor'), controller.exportExcel);

export {
  aprObraRouter,
  aprRouter,
  epiObraRouter,
  epiRouter,
  incidentObraRouter,
  incidentRouter,
  trainingRouter,
  segurancaRouter,
};
