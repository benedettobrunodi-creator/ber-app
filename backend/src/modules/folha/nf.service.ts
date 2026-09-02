/**
 * NFs dos colaboradores PJ (bloco 4 — políticas Bruno 27/08/2026):
 * - Só PJ emite (users.is_pj, default true — Carol desmarca os CLT).
 * - Upload libera SOMENTE com a competência fechada (FolhaFechamento status=fechado).
 * - Colaborador digita o valor da nota; Carol (financeiro) valida e marca como paga.
 * - Fluxo: enviada → validada → paga (+ rejeitada com motivo → colaborador reenvia).
 */
import { prisma } from '../../config/database';
import { AppError } from '../../utils/errors';
import { uploadToR2 } from '../../services/storage';

function compDate(competencia: string): Date {
  if (!/^\d{4}-\d{2}$/.test(competencia)) throw AppError.badRequest('Competência inválida (use YYYY-MM)');
  return new Date(`${competencia}-01T00:00:00.000Z`);
}

async function fechamentoFechado(competencia: string) {
  const f = await prisma.folhaFechamento.findUnique({
    where: { competencia: compDate(competencia) },
    select: { id: true, status: true, fechadoEm: true },
  });
  return f?.status === 'fechado' ? f : null;
}

/** Horas congeladas do colaborador na competência (linhas do fechamento). */
async function horasFechadas(fechamentoId: string, userId: string) {
  const linhas = await prisma.folhaFechamentoLinha.findMany({ where: { fechamentoId, userId } });
  return {
    minutosNormais: linhas.reduce((s, l) => s + Math.max(0, l.minutos), 0),
    minutosExtras: linhas.reduce((s, l) => s + l.minutosExtras, 0),
    minutosDesconto: linhas.reduce((s, l) => s + Math.max(0, -l.minutos), 0),
  };
}

/** Visão do colaborador: competência liberada? minhas horas, minha NF. */
export async function minhaNf(userId: string, competencia: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isPj: true } });
  if (!user) throw AppError.notFound('Usuário');
  const fechamento = await fechamentoFechado(competencia);
  const nf = await prisma.colaboradorNF.findUnique({
    where: { userId_competencia: { userId, competencia: compDate(competencia) } },
  });
  return {
    competencia,
    isPj: user.isPj,
    liberada: !!fechamento,
    horas: fechamento ? await horasFechadas(fechamento.id, userId) : null,
    nf,
  };
}

export async function enviarNf(
  userId: string,
  competencia: string,
  input: { numero: string; valorCentavos: number; observacoes?: string },
  file: { buffer: Buffer; originalname: string; mimetype: string },
) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isPj: true, name: true } });
  if (!user) throw AppError.notFound('Usuário');
  if (!user.isPj) throw AppError.badRequest('Seu cadastro não está marcado como PJ — fale com o financeiro.');
  const fechamento = await fechamentoFechado(competencia);
  if (!fechamento) throw AppError.badRequest('A competência ainda não foi fechada pelo financeiro. Aguarde o fechamento do mês para enviar a NF.');
  if (!input.numero?.trim()) throw AppError.badRequest('Informe o número da NF');
  if (!Number.isInteger(input.valorCentavos) || input.valorCentavos <= 0) throw AppError.badRequest('Valor da NF inválido');

  const existente = await prisma.colaboradorNF.findUnique({
    where: { userId_competencia: { userId, competencia: compDate(competencia) } },
  });
  if (existente && ['validada', 'paga'].includes(existente.status)) {
    throw AppError.badRequest(`NF desta competência já está ${existente.status} — fale com o financeiro para alterar.`);
  }

  const arquivoUrl = await uploadToR2(file.buffer, file.originalname, file.mimetype);
  const data = {
    numero: input.numero.trim(),
    valorCentavos: input.valorCentavos,
    arquivoUrl,
    observacoes: input.observacoes?.trim() || null,
    status: 'enviada',
    motivoRejeicao: null,
    validadaPorId: null,
    validadaEm: null,
    pagaEm: null,
  };
  const nf = await prisma.colaboradorNF.upsert({
    where: { userId_competencia: { userId, competencia: compDate(competencia) } },
    create: { userId, competencia: compDate(competencia), ...data },
    update: data,
  });

  // Aviso ao Bruno (pedido 02/09/26) — fire-and-forget: falha de notificação
  // nunca pode derrubar o envio da NF.
  notificarNfRecebida(user.name, competencia, data.numero, data.valorCentavos, !!existente).catch((e) =>
    console.error('[nf] falha ao notificar NF recebida:', (e as Error).message),
  );

  return nf;
}

// ─── Aviso de NF recebida (Telegram + e-mail pro Bruno) ───────────────────
const NF_AVISO_EMAIL = process.env.NF_AVISO_EMAIL ?? 'bruno@ber-engenharia.com.br';

async function notificarNfRecebida(
  nomeColaborador: string,
  competencia: string,
  numero: string,
  valorCentavos: number,
  reenvio: boolean,
) {
  const [y, m] = competencia.split('-');
  const mesLabel = `${m}/${y}`;
  const valor = (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const titulo = reenvio ? 'NF reenviada' : 'NF recebida';
  const texto = `${titulo}: ${nomeColaborador} — competência ${mesLabel}\nNF ${numero} · ${valor}\nValidação: app BÈR → Gestão de Folha → Fechamento (painel de NFs)`;

  // Telegram (instantâneo) — só se as envs estiverem configuradas
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_NOTIFY_CHAT_ID;
  if (botToken && chatId) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `📄 ${texto}` }),
      });
      if (!res.ok) throw new Error(`Telegram HTTP ${res.status}`);
    } catch (e) {
      console.error('[nf] aviso Telegram falhou:', (e as Error).message);
    }
  }

  // E-mail (registro/fallback)
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const from = process.env.RESEND_FROM_FINANCEIRO ?? 'BÈR Engenharia <financeiro@ber-engenharia.com.br>';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#2D2D2D">
      <div style="background:#1E2432;color:#fff;padding:18px 24px;border-radius:8px 8px 0 0">
        <strong style="letter-spacing:2px">BÈR ENGENHARIA</strong>
      </div>
      <div style="border:1px solid #E8E8E4;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <p><strong>${titulo}</strong></p>
        <p><strong>${nomeColaborador}</strong> enviou a NF da competência <strong>${mesLabel}</strong>.</p>
        <table style="border-collapse:collapse;width:100%;margin:12px 0">
          <tr><td style="padding:6px 10px;border:1px solid #E8E8E4">Número</td><td style="padding:6px 10px;border:1px solid #E8E8E4;text-align:right"><strong>${numero}</strong></td></tr>
          <tr><td style="padding:6px 10px;border:1px solid #E8E8E4">Valor</td><td style="padding:6px 10px;border:1px solid #E8E8E4;text-align:right"><strong>${valor}</strong></td></tr>
        </table>
        <p style="color:#868686;font-size:12px;margin-top:20px">Valide no app BÈR → Gestão de Folha → Fechamento. E-mail automático do sistema BÈR.</p>
      </div>
    </div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [NF_AVISO_EMAIL], subject: `BÈR — ${titulo}: ${nomeColaborador} (${mesLabel})`, html }),
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${await res.text()}`);
}

/** Painel da Carol: todas as NFs da competência + quem ainda não enviou. */
export async function painelNfs(competencia: string) {
  const fechamento = await fechamentoFechado(competencia);
  const nfs = await prisma.colaboradorNF.findMany({
    where: { competencia: compDate(competencia) },
    include: {
      user: { select: { id: true, name: true, email: true } },
      validadaPor: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  let faltantes: { userId: string; nome: string; email: string }[] = [];
  if (fechamento) {
    // TODOS os PJ ativos (02/09/26) — não só quem tem linha no fechamento:
    // colaborador de escritório não bate ponto em obra mas também emite NF.
    const comNf = new Set(nfs.map((n) => n.userId));
    const users = await prisma.user.findMany({
      where: { isPj: true, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
    faltantes = users.filter((u) => !comNf.has(u.id)).map((u) => ({ userId: u.id, nome: u.name, email: u.email }));
  }
  return { competencia, fechada: !!fechamento, nfs, faltantes };
}

export async function mudarStatusNf(id: string, acao: 'validar' | 'pagar' | 'rejeitar', validadorId: string, motivo?: string) {
  const nf = await prisma.colaboradorNF.findUnique({ where: { id } });
  if (!nf) throw AppError.notFound('NF');

  if (acao === 'validar') {
    if (nf.status !== 'enviada') throw AppError.badRequest(`NF está ${nf.status} — só NF enviada pode ser validada`);
    return prisma.colaboradorNF.update({
      where: { id },
      data: { status: 'validada', validadaPorId: validadorId, validadaEm: new Date(), motivoRejeicao: null },
    });
  }
  if (acao === 'pagar') {
    if (nf.status !== 'validada') throw AppError.badRequest(`NF está ${nf.status} — valide antes de marcar como paga`);
    return prisma.colaboradorNF.update({ where: { id }, data: { status: 'paga', pagaEm: new Date() } });
  }
  // rejeitar
  if (nf.status === 'paga') throw AppError.badRequest('NF já paga não pode ser rejeitada');
  if (!motivo?.trim()) throw AppError.badRequest('Informe o motivo da rejeição');
  return prisma.colaboradorNF.update({
    where: { id },
    data: { status: 'rejeitada', motivoRejeicao: motivo.trim(), validadaPorId: validadorId, validadaEm: new Date() },
  });
}

// ─── E-mail de liberação (disparado no fechamento do mês) ─────────────────
const h = (min: number) => (min / 60).toFixed(1).replace('.', ',');

export async function notificarPjsFechamento(competencia: string): Promise<{ enviados: number; erros: string[] }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { enviados: 0, erros: ['RESEND_API_KEY ausente'] };
  const from = process.env.RESEND_FROM_FINANCEIRO ?? 'BÈR Engenharia <financeiro@ber-engenharia.com.br>';

  const fechamento = await fechamentoFechado(competencia);
  if (!fechamento) return { enviados: 0, erros: ['competência não fechada'] };

  // TODOS os PJ ativos com e-mail (02/09/26) — escritório incluso, mesmo sem
  // linha no fechamento (quem não bate ponto em obra também emite NF).
  const users = await prisma.user.findMany({
    where: { isPj: true, isActive: true, email: { not: '' } },
    select: { id: true, name: true, email: true },
  });

  const [y, m] = competencia.split('-');
  const mesLabel = `${m}/${y}`;
  let enviados = 0;
  const erros: string[] = [];
  for (const u of users) {
    try {
      const horas = await horasFechadas(fechamento.id, u.id);
      const temHoras = horas.minutosNormais + horas.minutosExtras + horas.minutosDesconto > 0;
      const blocoHoras = temHoras
        ? `<p>Resumo das suas horas:</p>
            <table style="border-collapse:collapse;width:100%;margin:12px 0">
              <tr><td style="padding:6px 10px;border:1px solid #E8E8E4">Horas normais</td><td style="padding:6px 10px;border:1px solid #E8E8E4;text-align:right"><strong>${h(horas.minutosNormais)}h</strong></td></tr>
              ${horas.minutosExtras > 0 ? `<tr><td style="padding:6px 10px;border:1px solid #E8E8E4">Extras a pagar (já valorizadas)</td><td style="padding:6px 10px;border:1px solid #E8E8E4;text-align:right"><strong>${h(horas.minutosExtras)}h</strong></td></tr>` : ''}
              ${horas.minutosDesconto > 0 ? `<tr><td style="padding:6px 10px;border:1px solid #E8E8E4">Desconto (faltas sem saldo)</td><td style="padding:6px 10px;border:1px solid #E8E8E4;text-align:right"><strong>-${h(horas.minutosDesconto)}h</strong></td></tr>` : ''}
            </table>`
        : '';
      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#2D2D2D">
          <div style="background:#1E2432;color:#fff;padding:18px 24px;border-radius:8px 8px 0 0">
            <strong style="letter-spacing:2px">BÈR ENGENHARIA</strong>
          </div>
          <div style="border:1px solid #E8E8E4;border-top:none;padding:24px;border-radius:0 0 8px 8px">
            <p>Olá, <strong>${u.name.split(' ')[0]}</strong>!</p>
            <p>A competência <strong>${mesLabel}</strong> foi fechada.</p>
            ${blocoHoras}
            <p>Já pode <strong>emitir sua NF</strong> no valor combinado e enviar pelo app BÈR, na aba <strong>Minhas NFs</strong> (número da nota + valor + arquivo).</p>
            <p style="color:#868686;font-size:12px;margin-top:20px">Dúvidas sobre o valor, fale com o financeiro. E-mail automático do sistema BÈR.</p>
          </div>
        </div>`;
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [u.email], subject: `BÈR — competência ${mesLabel} fechada: pode enviar sua NF`, html }),
      });
      if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${await res.text()}`);
      enviados++;
    } catch (e) {
      erros.push(`${u.email}: ${(e as Error).message}`);
    }
  }
  return { enviados, erros };
}
