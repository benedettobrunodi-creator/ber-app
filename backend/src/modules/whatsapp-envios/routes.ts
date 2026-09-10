import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { authenticate } from '../../middleware/auth';
import { AppError } from '../../utils/errors';

// Fila de envio de relatórios por WhatsApp (piloto interno, Bruno 10/09/26).
// O ber-app enfileira; o worker do Mac mini (launchd com.bruno.whatsapp-envios)
// consome e dispara via gateway OpenClaw (número da Clara).

const w = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

// Piloto 1ª semana: círculo interno fixo + residentes da obra (stakeholders)
const DESTINATARIOS_FIXOS = [
  { nome: 'Bruno Di Benedetto', telefone: '5511999478989' },
  { nome: 'Christian Palermo', telefone: '5511937744490' },
  { nome: 'Francisco Gritti', telefone: '5511981328771' },
];

function normalizarTelefone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) return `55${digits}`; // DDD + 9 dígitos
  if (digits.length === 13 && digits.startsWith('55')) return digits;
  if (digits.length === 12 && digits.startsWith('55')) return digits; // fixo com DDI
  if (digits.length === 10) return `55${digits}`; // fixo sem DDI
  return null;
}

// Router montado em /v1/obras/:obraId/relatorios-whatsapp
export const obraWhatsappRouter = Router({ mergeParams: true });
obraWhatsappRouter.use(authenticate);

/** Enfileira o envio de um relatório pros destinatários do piloto. */
obraWhatsappRouter.post('/:relatorioId', w(async (req, res) => {
  const { obraId, relatorioId } = req.params as { obraId: string; relatorioId: string };
  const relatorio = await prisma.relatorioSemanal.findFirst({
    where: { id: relatorioId, obraId },
  });
  if (!relatorio) throw AppError.notFound('Relatório');
  const obra = await prisma.obra.findUnique({ where: { id: obraId }, select: { name: true } });
  if (!obra) throw AppError.notFound('Obra');

  // residentes/engenheiros da obra com telefone (cadastro de stakeholders)
  const stakeholders = await prisma.obraStakeholder.findMany({ where: { obraId } });
  const residentes = stakeholders
    .filter((s) => {
      const papel = `${s.cargo ?? ''} ${s.funcao ?? ''}`.toLowerCase();
      return /resident|engenheir/.test(papel) && s.telefone;
    })
    .map((s) => ({ nome: s.nome, telefone: normalizarTelefone(s.telefone!) }))
    .filter((s): s is { nome: string; telefone: string } => !!s.telefone);

  // dedupe por telefone (fixos têm prioridade de nome)
  const porTelefone = new Map<string, { nome: string; telefone: string }>();
  for (const d of [...DESTINATARIOS_FIXOS, ...residentes]) {
    if (!porTelefone.has(d.telefone)) porTelefone.set(d.telefone, d);
  }
  const destinatarios = [...porTelefone.values()];

  const legenda = `📋 Relatório Semanal nº ${relatorio.numero} — ${obra.name}. Enviado automaticamente pelo BER App.`;
  const arquivoPath = `/v1/obras/${obraId}/relatorios/${relatorioId}/pdf`;

  // não duplica envio pendente pro mesmo relatório+telefone
  const pendentes = await prisma.whatsappEnvio.findMany({
    where: { relatorioId, status: 'pendente' },
    select: { telefone: true },
  });
  const jaNaFila = new Set(pendentes.map((p) => p.telefone));

  const criados = await prisma.$transaction(
    destinatarios
      .filter((d) => !jaNaFila.has(d.telefone))
      .map((d) =>
        prisma.whatsappEnvio.create({
          data: {
            obraId,
            relatorioId,
            destinatario: d.nome,
            telefone: d.telefone,
            legenda,
            arquivoPath,
          },
        }),
      ),
  );
  res.json({ data: { criados: criados.length, destinatarios: destinatarios.map((d) => d.nome) } });
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
