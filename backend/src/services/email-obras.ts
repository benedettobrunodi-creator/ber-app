/**
 * Envio de e-mails ao CLIENTE da obra (diário + relatório semanal) via Resend.
 * Remetente configurável: RESEND_FROM_OBRAS
 *   (default proposto: "BÈR Engenharia <obras@ber-engenharia.com.br>")
 * Domínio ber-engenharia.com.br já verificado no Resend (validado 27/08/26).
 */

import { prisma } from '../config/database';

interface Attachment { filename: string; content: string } // base64

/**
 * Destinatários da obra: stakeholders marcados com "recebe e-mails" (com e-mail
 * válido); fallback = obras.cliente_email (texto livre com vírgulas).
 */
export async function destinatariosDaObra(obraId: string, tipo: 'diario' | 'relatorio' = 'relatorio'): Promise<string[]> {
  const [stk, obra] = await Promise.all([
    prisma.obraStakeholder.findMany({
      where: { obraId, email: { not: null }, ...(tipo === 'diario' ? { recebeDiario: true } : { recebeRelatorio: true }) },
      select: { email: true },
    }),
    prisma.obra.findUnique({ where: { id: obraId }, select: { clienteEmail: true } }),
  ]);
  const fromStk = parseEmails(stk.map((s2) => s2.email).filter(Boolean).join(','));
  if (fromStk.length) return fromStk;
  return parseEmails(obra?.clienteEmail);
}

/**
 * TODOS os e-mails de stakeholders cadastrados na obra, sem filtro de
 * recebe_diario/recebe_relatorio — usado em avisos pontuais (ex: aprovação
 * de amostra) que devem alcançar todo mundo, não só quem optou por
 * relatório/diário recorrente.
 */
export async function todosEmailsDaObra(obraId: string): Promise<string[]> {
  const stk = await prisma.obraStakeholder.findMany({
    where: { obraId, email: { not: null } },
    select: { email: true },
  });
  return parseEmails(stk.map((s2) => s2.email).filter(Boolean).join(','));
}

/** "a@x.com, b@y.com" → ["a@x.com","b@y.com"] (validados) */
export function parseEmails(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

export async function sendEmailObra({ to, subject, html, attachments }: {
  to: string[];
  subject: string;
  html: string;
  attachments?: Attachment[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY não configurada no servidor');
  const from = process.env.RESEND_FROM_OBRAS ?? 'BÈR Engenharia <obras@ber-engenharia.com.br>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, ...(attachments?.length ? { attachments } : {}) }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Falha no envio do e-mail (${res.status}): ${body.slice(0, 200)}`);
  }
}

const header = `
  <div style="background:#1E2432;padding:24px 28px;border-radius:12px 12px 0 0;">
    <p style="color:#fff;font-size:16px;font-weight:700;letter-spacing:3px;margin:0;">BÈR ENGENHARIA</p>
    <p style="color:#8A93A3;font-size:10px;letter-spacing:2px;margin:4px 0 0;">CUIDADO EM CADA OBRA</p>
  </div>`;
const footer = `
  <p style="color:#868686;font-size:11px;text-align:center;margin-top:16px;">
    BÈR Engenharia · Este e-mail foi enviado automaticamente pelo sistema de gestão de obras.
  </p>`;

export function diarioClienteHtml({ obraNome, dataFmt, link, observacoes }: {
  obraNome: string; dataFmt: string; link: string; observacoes?: string | null;
}): string {
  return `
  <div style="font-family:'Montserrat',Arial,sans-serif;max-width:560px;margin:0 auto;background:#F7F7F5;padding:24px;">
    ${header}
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;">
      <h2 style="color:#2D2D2D;font-size:17px;margin:0 0 6px;">Atualização diária da obra</h2>
      <p style="color:#5A7A7A;font-size:13px;font-weight:600;margin:0 0 16px;">${obraNome} · ${dataFmt}</p>
      ${observacoes ? `<p style="color:#2D2D2D;font-size:14px;line-height:1.6;margin:0 0 16px;">${observacoes}</p>` : ''}
      <p style="color:#2D2D2D;font-size:14px;line-height:1.6;margin:0 0 20px;">
        O diário de obra de hoje está disponível, com o avanço do dia, as atividades executadas e o registro fotográfico.
      </p>
      <a href="${link}" style="display:inline-block;background:#2D2D2D;color:#fff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;">Ver atualização do dia</a>
    </div>
    ${footer}
  </div>`;
}

const AMOSTRA_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  aprovado: { label: 'APROVADO', color: '#0ca30c' },
  reprovado: { label: 'REPROVADO', color: '#d03b3b' },
  pendente: { label: 'PENDENTE', color: '#c98500' },
};

export function amostraAprovacaoHtml({ obraNome, item, marca, especificacao, ambiente, status, dataFmt, responsavelNome, observacoes, fotos }: {
  obraNome: string; item: string; marca?: string | null; especificacao?: string | null;
  ambiente?: string | null; status: string; dataFmt?: string | null;
  responsavelNome?: string | null; observacoes?: string | null; fotos?: string[];
}): string {
  const st = AMOSTRA_STATUS_LABEL[status] ?? { label: status.toUpperCase(), color: '#5A7A7A' };
  const linha = (label: string, valor?: string | null) =>
    valor ? `<tr><td style="padding:4px 12px 4px 0;color:#868686;font-size:12px;white-space:nowrap;">${label}</td><td style="padding:4px 0;color:#2D2D2D;font-size:13px;">${valor}</td></tr>` : '';
  const fotosHtml = fotos?.length
    ? `<div style="margin-top:16px;">${fotos.map((f) => `<img src="${f}" style="width:100%;max-width:504px;border-radius:8px;margin-bottom:8px;display:block;">`).join('')}</div>`
    : '';
  return `
  <div style="font-family:'Montserrat',Arial,sans-serif;max-width:560px;margin:0 auto;background:#F7F7F5;padding:24px;">
    ${header}
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;">
      <h2 style="color:#2D2D2D;font-size:17px;margin:0 0 6px;">Amostra ${st.label}</h2>
      <p style="color:#5A7A7A;font-size:13px;font-weight:600;margin:0 0 4px;">${obraNome}</p>
      <span style="display:inline-block;background:${st.color};color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;margin-bottom:16px;">${st.label}</span>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        ${linha('Item', item)}
        ${linha('Marca', marca)}
        ${linha('Ambiente', ambiente)}
        ${linha('Especificação', especificacao)}
        ${linha('Data', dataFmt)}
        ${linha('Responsável', responsavelNome)}
        ${linha('Observações', observacoes)}
      </table>
      ${fotosHtml}
    </div>
    ${footer}
  </div>`;
}

export function relatorioClienteHtml({ obraNome, numero, periodo }: {
  obraNome: string; numero: number; periodo: string;
}): string {
  return `
  <div style="font-family:'Montserrat',Arial,sans-serif;max-width:560px;margin:0 auto;background:#F7F7F5;padding:24px;">
    ${header}
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;">
      <h2 style="color:#2D2D2D;font-size:17px;margin:0 0 6px;">Relatório Semanal nº ${String(numero).padStart(3, '0')}</h2>
      <p style="color:#5A7A7A;font-size:13px;font-weight:600;margin:0 0 16px;">${obraNome} · ${periodo}</p>
      <p style="color:#2D2D2D;font-size:14px;line-height:1.6;margin:0;">
        Segue em anexo o relatório semanal da obra, com o avanço físico, a curva S,
        os marcos do período e o registro fotográfico.
      </p>
    </div>
    ${footer}
  </div>`;
}
