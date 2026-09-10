import { prisma } from '../../config/database';
import { getPainel } from './service';

/**
 * Resumo do semáforo de medição no ciclo (Bruno 10/09/26): todo dia 25 às 7h,
 * e-mail com liberados × bloqueados por obra em andamento — o financeiro
 * consulta antes de lançar a % dos fornecedores no app de medição.
 * (Financeiro entra na lista quando o Bruno passar o e-mail.)
 */

const DESTINATARIOS = [
  'bruno@ber-engenharia.com.br',
  'emerson.machado@ber-engenharia.com.br',
];

const OBRA_STATUS_ATIVOS = ['em_andamento', 'planejamento'];
const OBRAS_EXCLUIDAS_ALERTA = ['Higienópolis'];

const CHIP: Record<string, string> = {
  liberado: '<span style="color:#1a7f37;font-weight:700">🟢 LIBERADO</span>',
  liberado_excecao: '<span style="color:#1a7f37;font-weight:700">🟢 liberado (exceção)</span>',
  bloqueado: '<span style="color:#B42318;font-weight:700">🔴 BLOQUEADO</span>',
  bloqueado_manual: '<span style="color:#B42318;font-weight:700">🔴 bloqueado (manual)</span>',
};

export async function resumoLiberacaoMedicao(opts?: { send?: boolean }) {
  const send = opts?.send !== false;
  const obras = await prisma.obra.findMany({
    where: { status: { in: OBRA_STATUS_ATIVOS } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const ativas = obras.filter((o) => !OBRAS_EXCLUIDAS_ALERTA.some((n) => o.name.includes(n)));

  const blocos: string[] = [];
  let totalLinhas = 0;
  for (const o of ativas) {
    const painel = await getPainel(o.id);
    if (painel.linhas.length === 0) continue;
    totalLinhas += painel.linhas.length;
    const liberados = painel.linhas.filter((l) => l.status.startsWith('liberado')).length;
    const bloqueados = painel.linhas.length - liberados;
    const linhasHtml = painel.linhas
      .map((l) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #E4E6DA;font-size:13px;color:#1E1E22">${l.pacote}${l.fornecedor ? ` · <b>${l.fornecedor}</b>` : ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #E4E6DA;font-size:13px;white-space:nowrap">${CHIP[l.status]}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #E4E6DA;font-size:12px;color:#5C5E54">${l.motivos.join('<br>') || (l.override ? `${l.override.justificativa} — ${l.override.por ?? ''}` : '—')}</td>
      </tr>`)
      .join('');
    blocos.push(`
      <h3 style="color:#5E6B0F;margin:20px 0 6px;font-size:15px">${o.name} — ${liberados} liberado(s) · ${bloqueados} bloqueado(s)</h3>
      <table style="border-collapse:collapse;width:100%">${linhasHtml}</table>`);
  }

  if (totalLinhas === 0) return { enviado: false, obras: 0 };

  const html = `<div style="font-family:Montserrat,Arial,sans-serif;max-width:720px;margin:0 auto">
    <div style="background:#5E6B0F;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0">
      <p style="margin:0;font-size:16px;font-weight:700">Liberação de Medição — resumo do ciclo</p>
      <p style="margin:2px 0 0;font-size:12px;opacity:.85">Consultar antes de lançar a % dos fornecedores no app de medição</p>
    </div>
    <div style="border:1px solid #E4E6DA;border-top:0;padding:4px 18px 18px;border-radius:0 0 8px 8px">
      ${blocos.join('')}
      <p style="color:#8B8D82;font-size:11px;text-align:center;margin:20px 0 0">Alerta automático do BER App · Qualidade → Liberação de Medição</p>
    </div>
  </div>`;

  if (send) {
    const { sendEmailObra } = await import('../../services/email-obras');
    await sendEmailObra({
      to: DESTINATARIOS,
      subject: `📏 Liberação de Medição — resumo do ciclo (${ativas.length} obras) · BÈR`,
      html,
    });
  }
  return { enviado: send, obras: blocos.length };
}
