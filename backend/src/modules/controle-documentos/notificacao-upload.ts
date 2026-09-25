/**
 * Aviso por e-mail quando entra arquivo novo no Controle de Documentos
 * (Bruno 25/09/26): equipe INTERNA da obra recebe 1 e-mail por evento —
 * upload individual (revisão com arquivo) ou lote inteiro (bulk-upload).
 * Externos/clientes nunca recebem. Fire-and-forget: falha de e-mail
 * NUNCA derruba o upload (só loga).
 */

import { prisma } from '../../config/database';

export interface DocNotificado {
  codigo: string;
  revisao: string;
  disciplina?: string | null;
  titulo?: string | null;
  arquivoNome?: string | null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function notificarUploadDocumentos(obraId: string, docs: DocNotificado[], autorUserId: string) {
  try {
    if (docs.length === 0) return;
    const [{ emailsEquipeInternaDaObra, htmlAvisoInterno }, obra, autor] = await Promise.all([
      import('../../services/email-equipe'),
      prisma.obra.findUnique({ where: { id: obraId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: autorUserId }, select: { name: true } }),
    ]);
    if (!obra) return;
    const to = await emailsEquipeInternaDaObra(obraId);
    if (to.length === 0) return;

    const linhas = docs.slice(0, 40).map(d => `
      <li style="color:#2D2D2D;font-size:13px;line-height:1.6;margin-bottom:4px;">
        <strong>${esc(d.codigo)}</strong> · ${esc(d.revisao)}
        ${d.disciplina ? ` · ${esc(d.disciplina)}` : ''}
        ${d.titulo ? `<br/><span style="color:#5C5E54;font-size:12px;">${esc(d.titulo)}</span>` : ''}
      </li>`).join('');
    const mais = docs.length > 40 ? `<p style="color:#5C5E54;font-size:12px;">… e mais ${docs.length - 40} arquivo(s).</p>` : '';

    const appUrl = process.env.APP_PUBLIC_URL ?? 'https://ber-app.vercel.app';
    const plural = docs.length > 1;
    const corpo = `
      <p style="color:#5C5E54;font-size:13px;margin:0 0 12px;">
        ${plural ? `${docs.length} arquivos entraram` : 'Um arquivo novo entrou'} no Controle de Documentos da obra
        <strong>${esc(obra.name)}</strong>${autor?.name ? `, por ${esc(autor.name)}` : ''}:
      </p>
      <ul style="margin:0 0 14px;padding-left:18px;">${linhas}</ul>${mais}
      <p style="margin:14px 0 0;"><a href="${appUrl}/obras/${obraId}/controle-documentos" style="color:#5E6B0F;font-weight:600;font-size:13px;">Abrir no BER App →</a></p>`;

    const { sendEmailObra } = await import('../../services/email-obras');
    await sendEmailObra({
      to,
      subject: `📁 ${plural ? `${docs.length} documentos novos` : `Documento novo: ${docs[0].codigo} ${docs[0].revisao}`} · ${obra.name}`,
      html: htmlAvisoInterno('📁 Documentos novos no controle', corpo, 'Aviso automático do BER App · Controle de Documentos · somente equipe interna'),
    });
  } catch (err) {
    console.error('[ControleDocumentos] aviso de upload falhou:', (err as Error).message);
  }
}
