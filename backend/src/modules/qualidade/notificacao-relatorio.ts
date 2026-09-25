/**
 * Aviso por e-mail quando entra relatório de Qualidade novo (vistoria)
 * (Bruno 25/09/26): equipe INTERNA da obra recebe 1 e-mail com nota,
 * classificação e link. Externos/clientes nunca recebem.
 * Fire-and-forget: nunca trava o submit da vistoria.
 */

import { prisma } from '../../config/database';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function notificarRelatorioQualidade(
  obraId: string,
  vistoria: { id: string; notaFinal: number | { toString(): string }; classificacao: string; data: Date; vistoriador?: { name: string } | null },
) {
  try {
    const notaNum = Number(vistoria.notaFinal);
    const [{ emailsEquipeInternaDaObra, htmlAvisoInterno }, obra] = await Promise.all([
      import('../../services/email-equipe'),
      prisma.obra.findUnique({ where: { id: obraId }, select: { name: true } }),
    ]);
    if (!obra) return;
    const to = await emailsEquipeInternaDaObra(obraId);
    if (to.length === 0) return;

    const appUrl = process.env.APP_PUBLIC_URL ?? 'https://ber-app.vercel.app';
    const nota = notaNum.toFixed(2);
    const corNota = notaNum >= 9 ? '#5E6B0F' : notaNum >= 7 ? '#c77b00' : '#B42318';
    const dataBR = vistoria.data.toLocaleDateString('pt-BR', { timeZone: 'UTC' });

    const corpo = `
      <p style="color:#5C5E54;font-size:13px;margin:0 0 12px;">
        Relatório de qualidade novo na obra <strong>${esc(obra.name)}</strong>
        (${dataBR}${vistoria.vistoriador?.name ? `, por ${esc(vistoria.vistoriador.name)}` : ''}):
      </p>
      <p style="font-size:15px;color:#2D2D2D;margin:0 0 14px;">
        Nota <strong style="color:${corNota};font-size:20px;">${nota}</strong>
        · <span style="text-transform:capitalize;">${esc(vistoria.classificacao.replace(/_/g, ' '))}</span>
      </p>
      <p style="margin:0;"><a href="${appUrl}/obras/${obraId}/qualidade" style="color:#5E6B0F;font-weight:600;font-size:13px;">Ver relatório e pendências no BER App →</a></p>`;

    const { sendEmailObra } = await import('../../services/email-obras');
    await sendEmailObra({
      to,
      subject: `📋 Relatório de qualidade · ${obra.name} · nota ${nota}`,
      html: htmlAvisoInterno('📋 Relatório de qualidade publicado', corpo, 'Aviso automático do BER App · Qualidade · somente equipe interna'),
    });
  } catch (err) {
    console.error('[Qualidade] aviso de relatório falhou:', (err as Error).message);
  }
}
