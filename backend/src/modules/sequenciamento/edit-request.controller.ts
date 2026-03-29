import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { sendSuccess, sendCreated } from '../../utils/response';
import { AppError } from '../../utils/errors';

// Telegram notification helper (best-effort)
async function notifyTelegram(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID || '6216144100'; // Bruno
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
  } catch {}
}

/** POST /v1/obras/:obraId/sequenciamento/etapas/:etapaId/edit-request */
export async function createEditRequest(req: Request, res: Response) {
  const { etapaId } = req.params;
  const { motivo } = req.body;
  const userId = req.user!.userId;

  const etapa = await prisma.obraEtapa.findUnique({
    where: { id: etapaId },
    include: { obra: { select: { id: true, name: true } } },
  });
  if (!etapa) throw new AppError(404, 'NOT_FOUND', 'Etapa não encontrada');
  if (!['concluida', 'aprovada'].includes(etapa.status)) {
    throw new AppError(400, 'VALIDATION', 'Etapa precisa estar concluída ou aprovada para solicitar edição');
  }

  // Check no pending request
  const existing = await prisma.etapaEditRequest.findFirst({
    where: { etapaId, status: 'pending' },
  });
  if (existing) throw new AppError(409, 'CONFLICT', 'Já existe uma solicitação pendente para esta etapa');

  const requester = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  const req_ = await prisma.etapaEditRequest.create({
    data: { etapaId, requestedBy: userId, motivo: motivo || null },
    include: { requester: { select: { id: true, name: true } }, etapa: { select: { name: true } } },
  });

  // Notify superiors via Telegram (best-effort)
  await notifyTelegram(
    `🔓 <b>Solicitação de Edição</b>\n` +
    `Etapa: <b>${etapa.name}</b>\n` +
    `Obra: ${(etapa.obra as any)?.name ?? ''}\n` +
    `Solicitado por: ${requester?.name ?? userId}\n` +
    `Motivo: ${motivo || '(não informado)'}\n` +
    `\nAcesse o app para aprovar ou rejeitar.`
  );

  sendCreated(res, req_);
}

/** GET /v1/obras/:obraId/sequenciamento/etapas/:etapaId/edit-request */
export async function getEditRequests(req: Request, res: Response) {
  const requests = await prisma.etapaEditRequest.findMany({
    where: { etapaId: req.params.etapaId },
    include: {
      requester: { select: { id: true, name: true } },
      resolver: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  sendSuccess(res, requests);
}

/** PATCH /v1/sequenciamento/edit-requests/:id  — approve or reject */
export async function resolveEditRequest(req: Request, res: Response) {
  const { id } = req.params;
  const { action, rejectionReason } = req.body; // action: 'approve' | 'reject'
  const resolverId = req.user!.userId;

  if (!['approve', 'reject'].includes(action)) {
    throw new AppError(400, 'VALIDATION', 'action deve ser approve ou reject');
  }

  const editReq = await prisma.etapaEditRequest.findUnique({
    where: { id },
    include: { requester: { select: { id: true, name: true } }, etapa: { select: { name: true } } },
  });
  if (!editReq) throw new AppError(404, 'NOT_FOUND', 'Solicitação não encontrada');
  if (editReq.status !== 'pending') throw new AppError(409, 'CONFLICT', 'Solicitação já foi resolvida');

  const unlockedUntil = action === 'approve' ? new Date(Date.now() + 30 * 60 * 1000) : null;

  const updated = await prisma.etapaEditRequest.update({
    where: { id },
    data: {
      status: action === 'approve' ? 'approved' : 'rejected',
      resolvedBy: resolverId,
      resolvedAt: new Date(),
      unlockedUntil,
      rejectionReason: action === 'reject' ? (rejectionReason || null) : null,
    },
    include: {
      requester: { select: { id: true, name: true } },
      resolver: { select: { id: true, name: true } },
    },
  });

  const emoji = action === 'approve' ? '✅' : '❌';
  await notifyTelegram(
    `${emoji} <b>Solicitação ${action === 'approve' ? 'Aprovada' : 'Rejeitada'}</b>\n` +
    `Etapa: <b>${editReq.etapa.name}</b>\n` +
    `Para: ${editReq.requester.name}\n` +
    (action === 'approve' ? `Válido por: 30 minutos` : `Motivo: ${rejectionReason || '(não informado)'}`)
  );

  sendSuccess(res, updated);
}

/** GET /v1/obras/:obraId/sequenciamento/edit-requests/pending — list all pending for an obra */
export async function getPendingForObra(req: Request, res: Response) {
  const etapas = await prisma.obraEtapa.findMany({
    where: { obraId: req.params.obraId },
    select: { id: true },
  });
  const etapaIds = etapas.map(e => e.id);
  const requests = await prisma.etapaEditRequest.findMany({
    where: { etapaId: { in: etapaIds }, status: 'pending' },
    include: {
      requester: { select: { id: true, name: true } },
      etapa: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  sendSuccess(res, requests);
}
