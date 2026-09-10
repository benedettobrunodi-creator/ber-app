import { prisma } from '../../config/database';

/**
 * Alerta de vencimento de apólices de Seguro (Controle de Documentos).
 * Pedido do Bruno (10/09/26): 7 dias antes do fim da vigência, e-mail diário
 * para PMO, Engenharia, Compras e Bruno até alguém registrar a decisão no app
 * (haverá extensão → grava nova vigência e o ciclo recomeça · não haverá →
 * alerta para). Apólice já vencida sem decisão continua cobrando todo dia.
 */

const DESTINATARIOS = [
  'emerson.machado@ber-engenharia.com.br',
  'francisco.gritti@ber-engenharia.com.br',
  'bruno@ber-engenharia.com.br',
  'christian.palermo@ber-engenharia.com.br',
];

const OBRA_STATUS_IGNORADOS = ['cancelada', 'concluida', 'encerrada'];

const fmtBR = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });

export async function checkSegurosVencendo(opts?: { send?: boolean }) {
  const send = opts?.send !== false;
  const limite = new Date(Date.now() + 7 * 86_400_000);

  const docs = await prisma.projetoDocumento.findMany({
    where: {
      disciplina: 'Seguro',
      obsoleto: false,
      vigenciaFim: { not: null, lte: limite },
      seguroDecisao: null,
    },
    include: { obra: { select: { name: true, status: true } } },
    orderBy: [{ vigenciaFim: 'asc' }],
  });

  const abertos = docs.filter((d) => !OBRA_STATUS_IGNORADOS.includes(d.obra.status));
  if (abertos.length === 0) return { enviado: false, itens: 0 };

  const linhas = abertos
    .map((d) => {
      const dias = Math.ceil((d.vigenciaFim!.getTime() - Date.now()) / 86_400_000);
      const situacao =
        dias < 0
          ? `<span style="color:#d03b3b;font-weight:700;">VENCIDA há ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'dia' : 'dias'}</span>`
          : dias === 0
            ? '<span style="color:#d03b3b;font-weight:700;">vence HOJE</span>'
            : `<span style="color:#c77b00;font-weight:600;">vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}</span>`;
      return `
        <li style="color:#2D2D2D;font-size:13px;line-height:1.6;margin-bottom:4px;">
          <strong>${d.codigo}</strong>${d.titulo ? ` — ${d.titulo}` : ''} · ${d.obra.name}
          <span style="font-size:11px;"> · vigência até ${fmtBR(d.vigenciaFim!)} · ${situacao}</span>
        </li>`;
    })
    .join('');

  const html = `
  <div style="font-family:'Montserrat',Arial,sans-serif;max-width:560px;margin:0 auto;background:#F7F7F5;padding:24px;">
    <div style="background:#2D2D2D;padding:24px 28px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="color:#fff;font-size:22px;font-weight:900;letter-spacing:3px;margin:0;">BÈR</h1>
      <p style="color:#868686;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin:4px 0 0;">Engenharia e Gerenciamento</p>
    </div>
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;">
      <h2 style="color:#2D2D2D;font-size:17px;margin:0 0 6px;">🛡️ Seguro vencendo — decisão pendente</h2>
      <p style="color:#5A7A7A;font-size:13px;margin:0 0 12px;">${abertos.length} ${abertos.length === 1 ? 'apólice precisa' : 'apólices precisam'} de decisão sobre extensão. Este aviso se repete diariamente até a decisão ser registrada no BER App (Controle de Documentos → aba Seguro → card da apólice).</p>
      <ul style="margin:0;padding-left:18px;">${linhas}</ul>
    </div>
    <p style="color:#8B8D82;font-size:11px;text-align:center;margin:16px 0 0;">Alerta automático do BER App · Controle de Documentos · Seguros</p>
  </div>`;

  if (send) {
    const { sendEmailObra } = await import('../../services/email-obras');
    await sendEmailObra({
      to: DESTINATARIOS,
      subject: `🛡️ ${abertos.length} ${abertos.length === 1 ? 'apólice de seguro vencendo' : 'apólices de seguro vencendo'} — decisão pendente · BÈR`,
      html,
    });
  }

  return { enviado: send, itens: abertos.length };
}
