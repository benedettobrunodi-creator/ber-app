import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/auth';
import { AppError } from '../../utils/errors';

// Fila de envio de relatórios por WhatsApp (piloto interno, Bruno 10/09/26).
// O ber-app enfileira; o worker do Mac mini (launchd com.bruno.whatsapp-envios)
// consome e dispara via gateway OpenClaw (número da Clara).

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

// Router montado em /v1/obras/:obraId/relatorios-whatsapp
export const obraWhatsappRouter = Router({ mergeParams: true });
obraWhatsappRouter.use(authenticate);

/** Enfileira o envio de um relatório pros destinatários do piloto. */
obraWhatsappRouter.post('/:relatorioId', w(async (req, res) => {
  const { obraId, relatorioId } = req.params as { obraId: string; relatorioId: string };
  // mesma régua do envio automático (Bruno 14/09): stakeholders "Recebe relatório"
  // com telefone + sempre o Bruno
  const { enfileirarRelatorioWhatsapp } = await import('./service');
  const r = await enfileirarRelatorioWhatsapp(obraId, relatorioId);
  res.json({ data: r });
}));

/** Status dos envios de um relatório (pro painel do front). */
obraWhatsappRouter.get('/:relatorioId', w(async (req, res) => {
  const { relatorioId } = req.params as { relatorioId: string };
  const envios = await prisma.whatsappEnvio.findMany({
    where: { relatorioId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, destinatario: true, telefone: true, status: true, erro: true, enviadoEm: true, createdAt: true },
  });
  res.json({ data: envios });
}));

// Router global do worker — montado em /v1/whatsapp-envios
export const whatsappEnviosRouter = Router();
whatsappEnviosRouter.use(authenticate);

whatsappEnviosRouter.get('/pendentes', w(async (_req, res) => {
  const envios = await prisma.whatsappEnvio.findMany({
    where: { status: 'pendente', tentativas: { lt: 3 } },
    orderBy: { createdAt: 'asc' },
    take: 10,
  });
  res.json({ data: envios });
}));

whatsappEnviosRouter.patch('/:id', w(async (req, res) => {
  const { id } = req.params as { id: string };
  const { status, erro } = req.body as { status: 'enviado' | 'falha'; erro?: string };
  if (status !== 'enviado' && status !== 'falha') throw AppError.badRequest('status inválido');
  const envio = await prisma.whatsappEnvio.update({
    where: { id },
    data: {
      status,
      erro: erro ?? null,
      tentativas: { increment: 1 },
      ...(status === 'enviado' ? { enviadoEm: new Date() } : {}),
    },
  });
  res.json({ data: envio });
}));
