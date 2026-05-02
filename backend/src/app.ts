import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';

import { env } from './config/env';
import { prisma } from './config/database';
import { errorHandler } from './middleware/errorHandler';
// bootstrap removido do startup — usuários iniciais gerenciados via prisma/seed-users.sql
// import { bootstrapUsers } from './seeds/bootstrap';

// Route imports
import authRoutes from './modules/auth/routes';
import userRoutes from './modules/users/routes';
import obraRoutes from './modules/obras/routes';
import trelloRoutes from './modules/obras/trello-routes';
import taskRoutes, { obraTaskRoutes } from './modules/tasks/routes';
import proposalRoutes from './modules/proposals/routes';
import meetingRoutes from './modules/meetings/routes';
import announcementRoutes, { obraComunicadoRouter } from './modules/announcements/routes';
import chatRoutes from './modules/chat/routes';
import photoRoutes, { obraPhotoRoutes } from './modules/photos/routes';
import timeEntryRoutes from './modules/time-entries/routes';
import notificationRoutes from './modules/notifications/routes';
import checklistRoutes, { templateRouter as checklistTemplateRoutes, obraChecklistRouter } from './modules/checklists/routes';
import canteiroRoutes, { canteiroTemplateRouter, obraCanteiroRouter } from './modules/canteiro/routes';
import {
  aprObraRouter, aprRouter,
  epiObraRouter, epiRouter,
  incidentObraRouter, incidentRouter,
  trainingRouter,
  segurancaRouter,
} from './modules/safety/routes';
import { seqTemplateRouter, obraSeqRouter, obraEtapaRouter, editReqRouter, globalEditReqRouter } from './modules/sequenciamento/routes';
import normasRouter from './modules/normas/routes';
import instrucoesRouter from './modules/instrucoes/routes';
import recebimentoRouter, { obraRecebimentoRouter } from './modules/recebimentos/routes';
import touchpointRoutes, { obraTouchpointRouter } from './modules/touchpoints/routes';
import { obraPunchListRouter, punchListRouter, punchListItemRouter } from './modules/punch-lists/routes';
import dashboardRoutes from './modules/dashboard/routes';
import rolesRoutes from './modules/roles/routes';
import alocacoesRoutes from './modules/alocacoes/routes';
import recursosExternosRoutes from './modules/recursos-externos/routes';
import orcamentosRoutes from './modules/orcamentos/routes';
import clickupRoutes from './modules/clickup/routes';
import apiKeysRoutes from './modules/api-keys/routes';
import multer from 'multer';
import { authenticate } from './middleware/auth';

// Scheduler
import { startScheduler } from './services/scheduler';

// Chat service for Socket.io
import * as chatService from './modules/chat/service';
import type { JwtPayload } from './middleware/auth';
import type { ServerToClientEvents, ClientToServerEvents } from './modules/chat/types';

// Ensure uploads directory exists
const uploadsDir = path.resolve(env.uploadDir);
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Express app
const app = express();
app.set('trust proxy', 1);
app.set('trust proxy', 1);
const server = http.createServer(app);

// Socket.io
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: env.corsOrigin,
    methods: ['GET', 'POST'],
  },
});

// Global middleware
app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Muitas requisições, tente novamente em 15 minutos' } },
});
app.use('/v1/auth', limiter);

// Static files (uploads)
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes (v1)
app.use('/v1/auth', authRoutes);
app.use('/v1/users', userRoutes);
app.use('/v1/obras', obraRoutes);
app.use('/v1/obras', trelloRoutes);
app.use('/v1/obras/:obraId/tasks', obraTaskRoutes);
app.use('/v1/tasks', taskRoutes);
app.use('/v1/proposals', proposalRoutes);
app.use('/v1/meetings', meetingRoutes);
app.use('/v1/announcements', announcementRoutes);
app.use('/v1/chat', chatRoutes);
app.use('/v1/obras/:obraId/photos', obraPhotoRoutes);
app.use('/v1/photos', photoRoutes);
app.use('/v1/time-entries', timeEntryRoutes);
app.use('/v1/notifications', notificationRoutes);
app.use('/v1/checklist-templates', checklistTemplateRoutes);
app.use('/v1/obras/:id/checklists', obraChecklistRouter);
app.use('/v1/checklists', checklistRoutes);
app.use('/v1/canteiro-templates', canteiroTemplateRouter);
app.use('/v1/obras/:id/canteiro', obraCanteiroRouter);
app.use('/v1/canteiro', canteiroRoutes);
app.use('/v1/obras/:id/apr', aprObraRouter);
app.use('/v1/apr', aprRouter);
app.use('/v1/obras/:id/epi', epiObraRouter);
app.use('/v1/epi', epiRouter);
app.use('/v1/obras/:id/incidents', incidentObraRouter);
app.use('/v1/incidents', incidentRouter);
app.use('/v1/trainings', trainingRouter);
app.use('/v1/seguranca', segurancaRouter);
app.use('/v1/sequenciamento-templates', seqTemplateRouter);
app.use('/v1/obras/:id/sequenciamento', obraSeqRouter);
app.use('/v1/obras/:id/etapas', obraEtapaRouter);
app.use('/v1/obras/:obraId/edit-requests', editReqRouter);
app.use('/v1/sequenciamento/edit-requests', globalEditReqRouter);
app.use('/v1/normas', normasRouter);
app.use('/v1/instrucoes-tecnicas', instrucoesRouter);
app.use('/v1/obras/:id/recebimentos', obraRecebimentoRouter);
app.use('/v1/recebimentos', recebimentoRouter);
app.use('/v1/obras/:id/touchpoints', obraTouchpointRouter);
app.use('/v1/touchpoints', touchpointRoutes);
app.use('/v1/obras/:id/punch-lists', obraPunchListRouter);
app.use('/v1/punch-lists', punchListRouter);
app.use('/v1/punch-list-items', punchListItemRouter);
app.use('/v1/dashboard', dashboardRoutes);
app.use('/v1/obras/:id', obraComunicadoRouter);
app.use('/v1/comunicados', announcementRoutes);

// FVS
import { obraFvsRouter, fvsRouter } from './modules/fvs/routes';
import { listTemplates } from './modules/fvs/controller';
app.use('/v1/obras/:id', obraFvsRouter);
app.use('/v1/obra-fvs', fvsRouter);
app.get('/v1/fvs-templates', authenticate as any, listTemplates);

// Módulo de Fotos
import * as fotosCtrl from './modules/fotos/controller';
const wf = (fn: any) => (req: any, res: any, next: any) => fn(req, res).catch(next);
app.get('/v1/obras/:id/plantas',                     authenticate as any, wf(fotosCtrl.listPlantas));
app.post('/v1/obras/:id/plantas',                    authenticate as any, wf(fotosCtrl.createPlanta));
app.delete('/v1/obras/:id/plantas/:plantaId',        authenticate as any, wf(fotosCtrl.deletePlanta));
app.get('/v1/obras/:id/ambientes',                   authenticate as any, wf(fotosCtrl.listAmbientes));
app.post('/v1/obras/:id/ambientes',                  authenticate as any, wf(fotosCtrl.createAmbiente));
app.patch('/v1/obras/:id/ambientes/:ambienteId',     authenticate as any, wf(fotosCtrl.updateAmbiente));
app.delete('/v1/obras/:id/ambientes/:ambienteId',    authenticate as any, wf(fotosCtrl.deleteAmbiente));
app.get('/v1/obras/:id/fotos/referencia',            authenticate as any, wf(fotosCtrl.getFotoReferencia));
app.get('/v1/obras/:id/fotos',                       authenticate as any, wf(fotosCtrl.listFotos));
app.post('/v1/obras/:id/fotos',                      authenticate as any, wf(fotosCtrl.createFoto));
app.post('/v1/obras/:id/fotos/batch',                authenticate as any, wf(fotosCtrl.createFotosBatch));
app.delete('/v1/obras/:id/fotos/:fotoId',            authenticate as any, wf(fotosCtrl.deleteFoto));

// BÈR Checklists — register with explicit paths to avoid catch-all conflict
import * as berClCtrl from './modules/ber-checklists/controller';
import { clRouter } from './modules/ber-checklists/routes';
app.get('/v1/obras/:id/ber-checklists', authenticate as any, (req: any, res: any) => berClCtrl.listByObra(req, res));
app.post('/v1/obras/:id/ber-checklists', authenticate as any, (req: any, res: any, next: any) => berClCtrl.createChecklist(req, res).catch(next));
app.use('/v1/obra-ber-checklists', clRouter);
app.get('/v1/ber-checklist-templates', authenticate as any, (req: any, res: any) => berClCtrl.listTemplates(req, res));

// ── MEDIÇÃO DE CONTRATO ──────────────────────────────────────────────────────
import * as medCtrl from './modules/medicoes/controller';
import medicaoRouter from './modules/medicoes/routes';
import comprasRoutes from './modules/compras/routes';
app.get('/v1/obras/:id/medicoes',            authenticate as any, (req: any, res: any, next: any) => medCtrl.listMedicoes(req, res, next).catch(next));
app.post('/v1/obras/:id/medicoes',           authenticate as any, (req: any, res: any, next: any) => medCtrl.createMedicao(req, res, next).catch(next));
app.get('/v1/obras/:id/medicao-itens',       authenticate as any, (req: any, res: any, next: any) => medCtrl.listItens(req, res, next).catch(next));
app.post('/v1/obras/:id/medicao-itens/bulk', authenticate as any, (req: any, res: any, next: any) => medCtrl.bulkItens(req, res, next).catch(next));
app.patch('/v1/medicao-itens/:itemId',       authenticate as any, (req: any, res: any, next: any) => medCtrl.updateItem(req, res, next).catch(next));
app.use('/v1/medicoes', medicaoRouter);
app.use('/v1/obras', comprasRoutes);
app.use('/v1/roles', rolesRoutes);
app.use('/v1/alocacoes', alocacoesRoutes);
app.use('/v1/recursos-externos', recursosExternosRoutes);
app.use('/v1/orcamentos', orcamentosRoutes);
app.use('/v1/clickup', clickupRoutes);
app.use('/v1/api-keys', apiKeysRoutes);

// Generic file upload — uses R2 when configured, falls back to disk
import { uploadToR2, isR2Configured } from './services/storage';

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});
const diskUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, env.uploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: env.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const genericUpload = isR2Configured() ? memoryUpload : diskUpload;

app.post('/v1/uploads', authenticate, genericUpload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: { code: 'NO_FILE', message: 'Nenhum arquivo enviado' } });
  }
  try {
    let url: string;
    if (isR2Configured() && req.file.buffer) {
      url = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype);
    } else {
      url = `${env.backendUrl}/uploads/${req.file.filename}`;
    }
    res.status(201).json({ data: { url } });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: { code: 'UPLOAD_FAILED', message: 'Erro no upload do arquivo' } });
  }
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada' } });
});

// Error handler (must be last)
app.use(errorHandler);

// Socket.io authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Token não fornecido'));
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
    socket.data.user = payload;
    next();
  } catch {
    next(new Error('Token inválido'));
  }
});

// Socket.io event handlers
io.on('connection', (socket) => {
  const user = socket.data.user as JwtPayload;
  console.log(`[Socket.io] User connected: ${user.userId}`);

  socket.on('join_room', async (roomId: string) => {
    const isMember = await chatService.isRoomMember(roomId, user.userId);
    if (!isMember) {
      socket.emit('error' as any, { message: 'Você não é membro desta sala' });
      return;
    }
    socket.join(roomId);
    socket.to(roomId).emit('user_joined', { userId: user.userId, roomId });
    console.log(`[Socket.io] ${user.userId} joined room ${roomId}`);
  });

  socket.on('leave_room', (roomId: string) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user_left', { userId: user.userId, roomId });
  });

  socket.on('message', async (data) => {
    try {
      const message = await chatService.sendMessage(data.roomId, user.userId, {
        body: data.body,
        attachmentUrl: data.attachmentUrl,
        attachmentType: data.attachmentType as any,
      });
      io.to(data.roomId).emit('new_message', message);
    } catch (err) {
      socket.emit('error' as any, { message: 'Erro ao enviar mensagem' });
    }
  });

  socket.on('typing', (data) => {
    socket.to(data.roomId).emit('typing', {
      userId: user.userId,
      roomId: data.roomId,
      userName: user.email,
    });
  });

  socket.on('read', async (data) => {
    try {
      await chatService.markAsRead(data.messageId, user.userId);
    } catch {
      // Silently ignore read errors
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] User disconnected: ${user.userId}`);
  });
});

// Start server
async function start() {
  try {
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL');

    server.listen(env.port, () => {
      console.log(`[Server] Running on port ${env.port} (${env.nodeEnv})`);
      console.log(`[Server] API base: http://localhost:${env.port}/v1`);
      startScheduler();
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down...');
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down...');
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});

start();

export { app, server, io };
