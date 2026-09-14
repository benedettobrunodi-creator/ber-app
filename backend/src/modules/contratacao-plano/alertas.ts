import { prisma } from '../../config/database';

/**
 * Alerta diário de itens ATRASADOS no Cronograma de Contratações (todas as obras
 * ativas). Pedido do Bruno (09/09/26): sempre que houver item atrasado, e-mail
 * para Emerson, Gritti, Bruno e Chris — digest 1x/dia às 7h30, agrupado por obra,
 * repetido diariamente até o item ser resolvido. Dia sem atraso = nenhum e-mail.
 *
 * Regra de "atrasado" = a MESMA do painel (effectiveStatus do service):
 * dataLimite no passado e status != contratado.
 */

const DESTINATARIOS = [
  'emerson.machado@ber-engenharia.com.br',
  'lucas.rizzi@ber-engenharia.com.br', // incluído a pedido do Bruno (14/09/26)
  'francisco.gritti@ber-engenharia.com.br',
  'bruno@ber-engenharia.com.br',
  'christian.palermo@ber-engenharia.com.br',
];

const OBRA_STATUS_IGNORADOS = ['cancelada', 'concluida', 'encerrada'];
// obras fora dos alertas por decisão do Bruno (10/09/26)
const OBRAS_EXCLUIDAS_ALERTA = ['Higienópolis'];
const obraExcluida = (nome: string) => OBRAS_EXCLUIDAS_ALERTA.some((n) => nome.includes(n));

const fmtBR = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });

function diasAtraso(limite: Date): number {
  return Math.max(1, Math.floor((Date.now() - limite.getTime()) / 86_400_000));
}

const STATUS_LABEL: Record<string, string> = {
  a_contratar: 'A contratar',
  em_cotacao: 'Em cotação',
};

export async function checkContratacoesAtrasadas(opts?: { send?: boolean }) {
  const send = opts?.send !== false;

  const planos = await prisma.obraContratacaoPlano.findMany({
    where: {
      dataLimite: { not: null, lt: new Date() },
      status: { not: 'contratado' },
    },
    include: { obra: { select: { name: true, status: true } } },
    orderBy: [{ dataLimite: 'asc' }],
  });

  // itens SEM data preenchida em obras em planejamento/andamento (Bruno 10/09/26):
  // não dá pra cobrar prazo de quem nem tem prazo — o e-mail aponta o buraco
  const semData = await prisma.obraContratacaoPlano.findMany({
    where: {
      dataLimite: null,
      status: { not: 'contratado' },
      obra: { status: { in: ['planejamento', 'em_andamento'] } },
    },
    include: { obra: { select: { name: true, status: true } } },
    orderBy: [{ obraId: 'asc' }],
  });

  const abertos = planos.filter((p) => !OBRA_STATUS_IGNORADOS.includes(p.obra.status) && !obraExcluida(p.obra.name));
  const semDataFiltrado = semData.filter((p) => !obraExcluida(p.obra.name));
  if (abertos.length === 0 && semDataFiltrado.length === 0) return { enviado: false, itens: 0 };

  const porObra = new Map<string, typeof abertos>();
  for (const p of abertos) {
    const lista = porObra.get(p.obra.name) ?? [];
    lista.push(p);
    porObra.set(p.obra.name, lista);
  }

  const blocos = Array.from(porObra.entries())
    .map(
      ([obra, lista]) => `
    <p style="color:#5A7A7A;font-size:13px;font-weight:600;margin:16px 0 6px;">${obra}</p>
    <ul style="margin:0;padding-left:18px;">
      ${lista
        .map((p) => {
          const dias = diasAtraso(p.dataLimite!);
          return `
        <li style="color:#2D2D2D;font-size:13px;line-height:1.6;margin-bottom:4px;">
          <strong>${p.pacote}</strong> — ${STATUS_LABEL[p.status] ?? p.status}
          <span style="color:#d03b3b;font-size:11px;font-weight:600;"> · limite ${fmtBR(p.dataLimite!)} (${dias} ${dias === 1 ? 'dia' : 'dias'} de atraso)</span>
        </li>`;
        })
        .join('')}
    </ul>`
    )
    .join('');

  const html = `
  <div style="font-family:'Montserrat',Arial,sans-serif;max-width:560px;margin:0 auto;background:#F7F7F5;padding:24px;">
    <div style="background:#2D2D2D;padding:24px 28px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="color:#fff;font-size:22px;font-weight:900;letter-spacing:3px;margin:0;">BÈR</h1>
      <p style="color:#868686;font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin:4px 0 0;">Engenharia e Gerenciamento</p>
    </div>
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;">
      <h2 style="color:#2D2D2D;font-size:17px;margin:0 0 6px;">🔴 Contratações em atraso</h2>
      <p style="color:#5A7A7A;font-size:13px;margin:0;">${abertos.length} ${abertos.length === 1 ? 'item aberto' : 'itens abertos'} com prazo limite vencido, agrupados por obra. Este aviso se repete diariamente até o item ser contratado ou o prazo ajustado.</p>
      ${blocos}
      ${semDataFiltrado.length > 0 ? `
      <h2 style="color:#2D2D2D;font-size:15px;margin:24px 0 6px;">⚪ Itens sem data-limite preenchida</h2>
      <p style="color:#5A7A7A;font-size:12px;margin:0 0 6px;">Obras em planejamento/andamento com pacote de contratação SEM data definida — sem data, o item não entra na régua de atraso. Resumo por obra (até 10 exemplos cada; lista completa no painel da obra).</p>
      ${Array.from(
        semDataFiltrado.reduce((m, p) => { const l = m.get(p.obra.name) ?? []; l.push(p.pacote); m.set(p.obra.name, l); return m; }, new Map<string, string[]>()).entries()
      ).map(([obra, pacotes]) => `
        <p style="color:#5A7A7A;font-size:13px;font-weight:600;margin:10px 0 4px;">${obra} — ${pacotes.length} ${pacotes.length === 1 ? 'item sem data' : 'itens sem data'}</p>
        <ul style="margin:0;padding-left:18px;">${pacotes.slice(0, 10).map((pc) => `<li style="color:#2D2D2D;font-size:13px;line-height:1.6;">${pc}</li>`).join('')}${pacotes.length > 10 ? `<li style="color:#8B8D82;font-size:12px;">… e mais ${pacotes.length - 10} — ver no painel da obra</li>` : ''}</ul>`).join('')}
      ` : ''}
    </div>
    <p style="color:#8B8D82;font-size:11px;text-align:center;margin:16px 0 0;">Alerta automático do BER App · Cronograma de Contratações</p>
  </div>`;

  if (send) {
    const { sendEmailObra } = await import('../../services/email-obras');
    await sendEmailObra({
      to: DESTINATARIOS,
      subject: abertos.length > 0
        ? `🔴 ${abertos.length} ${abertos.length === 1 ? 'contratação atrasada' : 'contratações atrasadas'}${semDataFiltrado.length ? ` · ${semDataFiltrado.length} sem data` : ''} — Cronograma de Contratações · BÈR`
        : `⚪ ${semDataFiltrado.length} ${semDataFiltrado.length === 1 ? 'item sem data-limite' : 'itens sem data-limite'} — Cronograma de Contratações · BÈR`,
      html,
    });
  }

  return { enviado: send, itens: abertos.length, semData: semDataFiltrado.length, obras: porObra.size };
}
