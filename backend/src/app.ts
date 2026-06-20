import express from 'express';
import 'express-async-errors'; // patches Express 4 to forward async errors to next(err) automatically
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
import diarioRouter, { obraDiarioRouter } from './modules/diario/routes';
import cronogramaRouter from './modules/cronograma/routes';
import relatorioRouter from './modules/relatorio-semanal/routes';
import crmRoutes from './modules/crm/routes';
import comprasDashboardRoutes from './modules/compras-dashboard/routes';
import multer from 'multer';
import { authenticate } from './middleware/auth';
import { requirePermission } from './middleware/permission';

// Shorthand: authenticate + permission check as middleware array
const perm = (key: string) => [authenticate as any, requirePermission(key) as any];

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

// Static files (uploads) — serve from configured dir and /tmp/uploads fallback
app.use('/uploads', express.static(uploadsDir));
app.use('/uploads', express.static('/tmp/uploads'));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), v: 2 });
});

// API Routes (v1)
app.use('/v1/auth', authRoutes);
app.use('/v1/users', userRoutes);                                                        // /me open; admin check inside
app.use('/v1/notifications', notificationRoutes);                                        // always accessible
app.use('/v1/announcements', announcementRoutes);                                        // always accessible
app.use('/v1/comunicados', announcementRoutes);                                          // always accessible
app.use('/v1/chat', chatRoutes);                                                         // always accessible

// — Módulo: obras —
app.use('/v1/obras', ...perm('obras'), obraRoutes);
app.use('/v1/obras/:obraId/tasks', ...perm('obras'), obraTaskRoutes);
app.use('/v1/tasks', ...perm('obras'), taskRoutes);
app.use('/v1/obras/:obraId/photos', ...perm('obras'), obraPhotoRoutes);
app.use('/v1/photos', ...perm('obras'), photoRoutes);
app.use('/v1/obras/:id', ...perm('obras'), obraComunicadoRouter);
app.use('/v1/canteiro-templates', ...perm('obras'), canteiroTemplateRouter);
app.use('/v1/obras/:id/canteiro', ...perm('obras'), obraCanteiroRouter);
app.use('/v1/canteiro', ...perm('obras'), canteiroRoutes);
app.use('/v1/sequenciamento-templates', ...perm('obras'), seqTemplateRouter);
app.use('/v1/obras/:id/sequenciamento', ...perm('obras'), obraSeqRouter);
app.use('/v1/obras/:id/etapas', ...perm('obras'), obraEtapaRouter);
app.use('/v1/obras/:obraId/edit-requests', ...perm('obras'), editReqRouter);
app.use('/v1/sequenciamento/edit-requests', ...perm('obras'), globalEditReqRouter);
app.use('/v1/obras/:id/touchpoints', ...perm('obras'), obraTouchpointRouter);
app.use('/v1/touchpoints', ...perm('obras'), touchpointRoutes);
app.use('/v1/obras/:id/punch-lists', ...perm('obras'), obraPunchListRouter);
app.use('/v1/punch-lists', ...perm('obras'), punchListRouter);
app.use('/v1/punch-list-items', ...perm('obras'), punchListItemRouter);

// — Módulo: checklists —
app.use('/v1/checklist-templates', ...perm('checklists'), checklistTemplateRoutes);
app.use('/v1/obras/:id/checklists', ...perm('checklists'), obraChecklistRouter);
app.use('/v1/checklists', ...perm('checklists'), checklistRoutes);

// — Módulo: segurança —
app.use('/v1/obras/:id/apr', ...perm('seguranca'), aprObraRouter);
app.use('/v1/apr', ...perm('seguranca'), aprRouter);
app.use('/v1/obras/:id/epi', ...perm('seguranca'), epiObraRouter);
app.use('/v1/epi', ...perm('seguranca'), epiRouter);
app.use('/v1/obras/:id/incidents', ...perm('seguranca'), incidentObraRouter);
app.use('/v1/incidents', ...perm('seguranca'), incidentRouter);
app.use('/v1/trainings', ...perm('seguranca'), trainingRouter);
app.use('/v1/seguranca', ...perm('seguranca'), segurancaRouter);

// — Módulo: normas —
app.use('/v1/normas', ...perm('normas'), normasRouter);

// — Módulo: instruções —
app.use('/v1/instrucoes-tecnicas', ...perm('instrucoes'), instrucoesRouter);

// — Módulo: recebimentos —
app.use('/v1/obras/:id/recebimentos', ...perm('recebimentos'), obraRecebimentoRouter);
app.use('/v1/recebimentos', ...perm('recebimentos'), recebimentoRouter);

// — Módulo: ponto —
app.use('/v1/time-entries', ...perm('ponto'), timeEntryRoutes);

// — Módulo: dashboard —
app.use('/v1/dashboard', ...perm('dashboard'), dashboardRoutes);

// — Módulo: compras-dashboard (visão consolidada cross-obras) —
app.use('/v1/compras-dashboard', ...perm('comprasDashboard'), comprasDashboardRoutes);

// — Módulo: orçamentos / CRM —
app.use('/v1/proposals', ...perm('orcamentos'), proposalRoutes);
app.use('/v1/meetings', ...perm('orcamentos'), meetingRoutes);
app.use('/v1/orcamentos', ...perm('orcamentos'), orcamentosRoutes);
app.use('/v1/crm', ...perm('orcamentos'), crmRoutes);

// — Módulo: organograma —
import organogramaRouter from './modules/organograma/routes';
app.use('/v1/organograma', ...perm('organograma'), organogramaRouter);

// — Módulo: attachments (polimórfico, usado por Gestão 360) —
import attachmentsRouter from './modules/attachments/routes';
app.use('/v1/attachments', authenticate, attachmentsRouter);

// — Módulo: aditivos (Gestão 360) —
import { obraAditivosRouter, aditivosRouter } from './modules/aditivos/routes';
app.use('/v1/obras/:obraId/aditivos', ...perm('aditivos'), obraAditivosRouter);
app.use('/v1/aditivos', ...perm('aditivos'), aditivosRouter);

// — Módulo: contratações + ordens de compra (Gestão 360) —
import { obraContratacoesRouter, contratacoesRouter } from './modules/contratacoes/routes';
import { obraOcsRouter, ocsRouter } from './modules/ordens-compra/routes';
app.use('/v1/obras/:obraId/contratacoes', ...perm('contratacoes'), obraContratacoesRouter);
app.use('/v1/contratacoes', ...perm('contratacoes'), contratacoesRouter);
app.use('/v1/obras/:obraId/ordens-compra', ...perm('contratacoes'), obraOcsRouter);
app.use('/v1/ordens-compra', ...perm('contratacoes'), ocsRouter);

// — Módulo: atas (Gestão 360) —
import { obraAtasRouter, atasRouter } from './modules/atas/routes';
app.use('/v1/obras/:obraId/atas', ...perm('atas'), obraAtasRouter);
app.use('/v1/atas', ...perm('atas'), atasRouter);

// — Módulo: documentos (Gestão 360) —
import { obraDocumentosRouter, documentosRouter } from './modules/documentos/routes';
app.use('/v1/obras/:obraId/documentos', ...perm('documentos'), obraDocumentosRouter);
app.use('/v1/documentos', ...perm('documentos'), documentosRouter);

// — Módulo: stakeholders (Gestão 360) —
import { obraStakeholdersRouter, stakeholdersRouter } from './modules/stakeholders/routes';
app.use('/v1/obras/:obraId/stakeholders', ...perm('stakeholders'), obraStakeholdersRouter);
app.use('/v1/stakeholders', ...perm('stakeholders'), stakeholdersRouter);

// — Módulo: kickoff (Gestão 360 · 1:1 por obra) —
import { obraKickoffRouter } from './modules/kickoff/routes';
app.use('/v1/obras/:obraId/kickoff', ...perm('kickoff'), obraKickoffRouter);

// — Módulo: RACI (Gestão 360) —
import { obraRaciRouter, raciRouter } from './modules/raci/routes';
app.use('/v1/obras/:obraId/raci', ...perm('raci'), obraRaciRouter);
app.use('/v1/raci', ...perm('raci'), raciRouter);

// — Módulo: cronograma de contratações (Gestão 360) —
import { obraPlanoRouter, planoRouter } from './modules/contratacao-plano/routes';
app.use('/v1/obras/:obraId/contratacao-plano', ...perm('contratacaoPlano'), obraPlanoRouter);
app.use('/v1/contratacao-plano', ...perm('contratacaoPlano'), planoRouter);

// — Módulo: histograma de MO (Gestão 360) —
import { obraHistogramaRouter } from './modules/histograma/routes';
app.use('/v1/obras/:obraId/histograma', ...perm('histograma'), obraHistogramaRouter);

// — Módulo: alocações (usa perm configuracoes) —
app.use('/v1/alocacoes', ...perm('configuracoes'), alocacoesRoutes);

// — Admin —
app.use('/v1/roles', ...perm('admin'), rolesRoutes);

// Remaining (sem restrição de módulo ou handled internamente)
app.use('/v1/recursos-externos', recursosExternosRoutes);
app.use('/v1/clickup', clickupRoutes);
app.use('/v1/api-keys', apiKeysRoutes);

// FVS (sub-obras — requer perm obras)
import { obraFvsRouter, fvsRouter } from './modules/fvs/routes';
import { listTemplates } from './modules/fvs/controller';
app.use('/v1/obras/:id', ...perm('obras'), obraFvsRouter);
app.use('/v1/obra-fvs', ...perm('obras'), fvsRouter);
app.get('/v1/fvs-templates', ...perm('obras'), listTemplates as any);

// Módulo de Fotos (sub-obras — requer perm obras)
import * as fotosCtrl from './modules/fotos/controller';
const fotosUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});
const wf = (fn: any) => (req: any, res: any, next: any) => fn(req, res).catch(next);
const op = perm('obras');
app.get('/v1/obras/:id/plantas',                     ...op, wf(fotosCtrl.listPlantas));
app.post('/v1/obras/:id/plantas',                    ...op, fotosUpload.single('file'), wf(fotosCtrl.createPlanta));
app.delete('/v1/obras/:id/plantas/:plantaId',        ...op, wf(fotosCtrl.deletePlanta));
app.get('/v1/obras/:id/ambientes',                   ...op, wf(fotosCtrl.listAmbientes));
app.post('/v1/obras/:id/ambientes',                  ...op, wf(fotosCtrl.createAmbiente));
app.patch('/v1/obras/:id/ambientes/:ambienteId',     ...op, wf(fotosCtrl.updateAmbiente));
app.delete('/v1/obras/:id/ambientes/:ambienteId',    ...op, wf(fotosCtrl.deleteAmbiente));
app.get('/v1/obras/:id/fotos/referencia',            ...op, wf(fotosCtrl.getFotoReferencia));
app.get('/v1/obras/:id/fotos',                       ...op, wf(fotosCtrl.listFotos));
app.post('/v1/obras/:id/fotos',                      ...op, fotosUpload.single('file'), wf(fotosCtrl.createFoto));
app.post('/v1/obras/:id/fotos/batch',                ...op, wf(fotosCtrl.createFotosBatch));
app.delete('/v1/obras/:id/fotos/:fotoId',            ...op, wf(fotosCtrl.deleteFoto));

// BÈR Checklists (requer perm checklists)
import * as berClCtrl from './modules/ber-checklists/controller';
import { clRouter } from './modules/ber-checklists/routes';
const cp = perm('checklists');
app.get('/v1/obras/:id/ber-checklists',  ...cp, (req: any, res: any, next: any) => berClCtrl.listByObra(req, res).catch(next));
app.post('/v1/obras/:id/ber-checklists', ...cp, (req: any, res: any, next: any) => berClCtrl.createChecklist(req, res).catch(next));
app.use('/v1/obra-ber-checklists', ...cp, clRouter);
app.get('/v1/ber-checklist-templates',   ...cp, (req: any, res: any, next: any) => berClCtrl.listTemplates(req, res).catch(next));

// ── MEDIÇÃO DE CONTRATO (requer perm obras) ──────────────────────────────────
import * as medCtrl from './modules/medicoes/controller';
import medicaoRouter from './modules/medicoes/routes';
import comprasRoutes from './modules/compras/routes';
app.get('/v1/obras/:id/medicoes',            ...op, (req: any, res: any, next: any) => medCtrl.listMedicoes(req, res, next).catch(next));
app.post('/v1/obras/:id/medicoes',           ...op, (req: any, res: any, next: any) => medCtrl.createMedicao(req, res, next).catch(next));
app.get('/v1/obras/:id/medicao-itens',       ...op, (req: any, res: any, next: any) => medCtrl.listItens(req, res, next).catch(next));
app.post('/v1/obras/:id/medicao-itens/bulk', ...op, (req: any, res: any, next: any) => medCtrl.bulkItens(req, res, next).catch(next));
app.patch('/v1/medicao-itens/:itemId',       ...op, (req: any, res: any, next: any) => medCtrl.updateItem(req, res, next).catch(next));
app.use('/v1/medicoes', ...op, medicaoRouter);
app.use('/v1/obras', ...perm('obras'), comprasRoutes);
// — Módulo: diário de obra —
app.use('/v1/obras/:id/diario', ...perm('diario'), obraDiarioRouter);
app.use('/v1/diario', ...perm('diario'), diarioRouter);

// — Sub-rotas de obras (cronograma/relatórios) —
app.use('/v1/obras/:id/cronograma', ...perm('obras'), cronogramaRouter);
app.use('/v1/obras/:id/relatorios', ...perm('obras'), relatorioRouter);

// Generic file upload — uses R2 when configured, falls back to disk
import { uploadToR2, isR2Configured } from './services/storage';

const genericUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

app.post('/v1/uploads', authenticate, (req, res, next) => {
  genericUpload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: { code: 'FILE_TOO_LARGE', message: 'Arquivo muito grande. Máximo 20 MB.' } });
      }
      return next(err);
    }
    next();
  });
}, async (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ error: { code: 'NO_FILE', message: 'Nenhum arquivo enviado ou tipo não suportado' } });
  }
  try {
    let url: string;
    if (isR2Configured()) {
      url = await uploadToR2(req.file.buffer, req.file.originalname, req.file.mimetype);
    } else {
      const ext = path.extname(req.file.originalname) || '.jpg';
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      // Try configured uploadDir first, fall back to /tmp/uploads (always writable in Docker)
      const dirs = [path.resolve(env.uploadDir), '/tmp/uploads'];
      let saved = false;
      for (const dir of dirs) {
        try {
          await fs.promises.mkdir(dir, { recursive: true });
          await fs.promises.writeFile(path.join(dir, filename), req.file.buffer);
          saved = true;
          break;
        } catch { /* try next */ }
      }
      if (!saved) throw new Error('Não foi possível salvar o arquivo em disco');
      url = `${env.backendUrl}/uploads/${filename}`;
    }
    console.log('[UPLOAD OK]', url);
    res.status(201).json({ data: { url } });
  } catch (err: any) {
    console.error('[UPLOAD ERROR]', err?.message, err?.stack?.split('\n')[1]);
    res.status(500).json({ error: { code: 'UPLOAD_FAILED', message: err?.message ?? 'Erro no upload do arquivo' } });
  }
});

// ── PDF Proxy — permite que o frontend leia PDFs externos (ex: Google Drive) sem CORS ──
// Suporta URLs do Drive: /file/d/{ID}/view, /file/d/{ID}/preview e uc?id={ID}
function driveDownloadUrl(url: string): string {
  const viewMatch = url.match(/\/file\/d\/([^/]+)\//);
  if (viewMatch) return `https://drive.google.com/uc?export=download&id=${viewMatch[1]}`;
  const ucMatch = url.match(/[?&]id=([^&]+)/);
  if (ucMatch) return `https://drive.google.com/uc?export=download&id=${ucMatch[1]}`;
  return url;
}

app.get('/v1/proxy/pdf', authenticate, async (req, res) => {
  const raw = req.query.url as string;
  if (!raw) return res.status(400).json({ error: { message: 'url obrigatória' } });

  let targetUrl: string;
  try {
    targetUrl = new URL(raw).toString();
  } catch {
    return res.status(400).json({ error: { message: 'url inválida' } });
  }

  if (targetUrl.includes('drive.google.com') || targetUrl.includes('docs.google.com')) {
    targetUrl = driveDownloadUrl(targetUrl);
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 BER-App/1.0' },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: { message: `Upstream retornou ${upstream.status}` } });
    }

    const contentType = upstream.headers.get('content-type') ?? 'application/pdf';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    const buffer = Buffer.from(await upstream.arrayBuffer());
    return res.send(buffer);
  } catch (err: any) {
    console.error('[proxy/pdf] fetch error:', err?.message);
    return res.status(502).json({ error: { message: 'Erro ao buscar o arquivo remoto' } });
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
// Prevent unhandled async rejections (from Express 4 controllers without try/catch) from crashing the process
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled promise rejection (caught, not crashing):', reason);
});

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
