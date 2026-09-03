/**
 * Envio de emails via Resend pra fluxo de medição.
 * Variáveis de ambiente:
 *   RESEND_API_KEY      — chave da API Resend (obrigatório)
 *   RESEND_FROM         — remetente (default "BÈR Medição <medicao@ber-engenharia.com.br>")
 *   NOTIFICATION_EMAILS — destinatários BÈR separados por vírgula (alertas internos)
 *   APP_PUBLIC_URL      — base do frontend (default "https://ber-app.vercel.app")
 *
 * Se RESEND_API_KEY não estiver definido, envio é silenciosamente ignorado.
 */

interface SendEmailOptions {
  to: string[];
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || to.length === 0) return;

  const from = process.env.RESEND_FROM ?? 'BÈR Medição <medicao@ber-engenharia.com.br>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[email] Falha ao enviar:', res.status, body);
    }
  } catch (err) {
    console.error('[email] Erro ao enviar:', err);
  }
}

function publicUrl(): string {
  return process.env.APP_PUBLIC_URL ?? 'https://ber-app.vercel.app';
}

function notificationEmails(): string[] {
  const env = process.env.NOTIFICATION_EMAILS ?? '';
  return env.split(',').map(e => e.trim()).filter(Boolean);
}

// ─── Templates ─────────────────────────────────────────────────────────────

export async function sendMagicLink({
  to, nome, obraNome, token,
}: {
  to: string; nome: string; obraNome: string; token: string;
}) {
  const link = `${publicUrl()}/cliente/medicao/${token}`;
  await sendEmail({
    to: [to],
    subject: `BÈR Medição — Acesso à obra ${obraNome}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; color: #111;">
        <h2 style="margin-bottom:8px;">Olá, ${nome}!</h2>
        <p>Você recebeu acesso ao portal de medições da BÈR Engenharia pra acompanhar a obra <strong>${obraNome}</strong>.</p>
        <p>Quando uma medição estiver pronta, você poderá conferir os valores e aprovar ou contestar direto pelo portal.</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
            Abrir portal →
          </a>
        </p>
        <p style="color:#666; font-size:12px;">Esse link é pessoal — guarde com você.</p>
      </div>`,
  });
}

export async function sendMedicaoEnviada({
  to, nome, obraNome, medicaoLabel, token,
}: {
  to: string; nome: string; obraNome: string; medicaoLabel: string; token: string;
}) {
  const link = `${publicUrl()}/cliente/medicao/${token}`;
  await sendEmail({
    to: [to],
    subject: `BÈR — ${medicaoLabel} pronta pra sua aprovação (${obraNome})`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; color: #111;">
        <h2 style="margin-bottom:8px;">Olá, ${nome}!</h2>
        <p>A <strong>${medicaoLabel}</strong> da obra <strong>${obraNome}</strong> está pronta pra sua aprovação.</p>
        <p>Por favor, confira os valores e aprove ou conteste pelo portal:</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600;">
            Conferir medição →
          </a>
        </p>
        <p style="color:#666; font-size:12px;">Em caso de dúvidas, fale com a equipe BÈR.</p>
      </div>`,
  });
}

export async function notifyBerCanteiroAprovada({
  obraNome, medicaoLabel, medicaoUrl,
}: {
  obraNome: string; medicaoLabel: string; medicaoUrl: string;
}) {
  const dest = notificationEmails();
  if (dest.length === 0) return;
  await sendEmail({
    to: dest,
    subject: `[BÈR] ${medicaoLabel} APROVADA pelo cliente — ${obraNome}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; color: #111;">
        <h2 style="margin-bottom:8px;">✅ Medição aprovada</h2>
        <p>O cliente aprovou a <strong>${medicaoLabel}</strong> da obra <strong>${obraNome}</strong>.</p>
        <p style="margin: 24px 0;">
          <a href="${medicaoUrl}" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">
            Abrir no app →
          </a>
        </p>
      </div>`,
  });
}

export async function notifyBerCanteiroContestada({
  obraNome, medicaoLabel, medicaoUrl, comentario,
}: {
  obraNome: string; medicaoLabel: string; medicaoUrl: string; comentario: string;
}) {
  const dest = notificationEmails();
  if (dest.length === 0) return;
  await sendEmail({
    to: dest,
    subject: `[BÈR] ${medicaoLabel} CONTESTADA pelo cliente — ${obraNome}`,
    html: `
      <div style="font-family: sans-serif; max-width: 520px; color: #111;">
        <h2 style="margin-bottom:8px; color:#b45309;">⚠️ Medição contestada</h2>
        <p>O cliente contestou a <strong>${medicaoLabel}</strong> da obra <strong>${obraNome}</strong>.</p>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px;margin:16px 0;">
          <p style="margin:0;font-size:13px;color:#78350f;"><strong>Motivo:</strong> ${comentario}</p>
        </div>
        <p style="margin: 24px 0;">
          <a href="${medicaoUrl}" style="display:inline-block;background:#111;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;">
            Ver contestação →
          </a>
        </p>
      </div>`,
  });
}
