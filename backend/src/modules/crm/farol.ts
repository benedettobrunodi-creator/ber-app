// Farol Comercial (08/10/26 — pedido Bruno: "a tela inicial deveria ser
// sempre comercial! Como pensarmos em algo que todo dia me desse uma mensagem
// do que eu precisaria fazer para atingir nossa meta, run rate" + "só pra
// mim td"). 100% determinístico — número aqui NUNCA passa por IA.
// Entregas: (a) e-mail diário 7h30 BRT só pros SÓCIOS ativos (hoje = Bruno),
// (b) GET /v1/crm/farol pro banner no topo do CRM (também só sócio).
import { prisma } from '../../config/database';
import { getVendasVsMeta } from './service';

const MS_DIA = 86_400_000;
const MES_MEDIO_DIAS = 30.4375; // 365.25/12 — meses fracionários estáveis
const ETAPAS_QUENTES = ['proposta_enviada', 'negociacao'] as const;

export interface FarolComercial {
  ano: number;
  metaAno: number;
  realizadoAno: number;
  pctMeta: number; // 0-100
  falta: number;
  mesesDecorridos: number;
  mesesRestantes: number;
  runRateAtual: number; // R$/mês até aqui
  runRateNecessario: number; // R$/mês daqui pra frente
  multiplicador: number | null; // necessário ÷ atual
  funilQuente: { etapa: string; valor: number; count: number }[];
  valorFunilQuente: number;
  pctFunilNecessario: number | null; // % do funil quente que fecharia o gap
  paradas: { id: string; titulo: string; empresa: string | null; etapa: string; valor: number; diasParado: number }[];
}

function agoraSp(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

export async function calcularFarol(): Promise<FarolComercial> {
  const sp = agoraSp();
  const ano = sp.getFullYear();

  // Meta e realizado: MESMA régua da tela Relatórios (getVendasVsMeta) — uma
  // fonte só de verdade, sem duas contas diferentes pro mesmo número.
  const vendas = await getVendasVsMeta(ano);
  const metaAno = vendas.reduce((s, r) => s + r.meta, 0);
  const realizadoAno = vendas[vendas.length - 1]?.realizadoAcum ?? 0;

  const inicioAno = new Date(ano, 0, 1);
  const fimAno = new Date(ano + 1, 0, 1);
  const mesesDecorridos = Math.max((sp.getTime() - inicioAno.getTime()) / MS_DIA / MES_MEDIO_DIAS, 0.1);
  const mesesRestantes = Math.max((fimAno.getTime() - sp.getTime()) / MS_DIA / MES_MEDIO_DIAS, 0);

  const falta = Math.max(metaAno - realizadoAno, 0);
  const runRateAtual = realizadoAno / mesesDecorridos;
  const runRateNecessario = mesesRestantes > 0.1 ? falta / mesesRestantes : falta;
  const multiplicador = runRateAtual > 0 ? runRateNecessario / runRateAtual : null;

  // Funil quente: proposta enviada + negociação (o que dá pra fechar ainda)
  const quentes = await prisma.crmOportunidade.findMany({
    where: { etapa: { in: [...ETAPAS_QUENTES] } },
    select: {
      id: true, titulo: true, etapa: true, valor: true, updatedAt: true,
      empresa: { select: { razaoSocial: true } },
    },
  });
  const funilQuente = ETAPAS_QUENTES.map((e) => {
    const das = quentes.filter((q) => q.etapa === e);
    return { etapa: e, valor: das.reduce((s, q) => s + Number(q.valor ?? 0), 0), count: das.length };
  });
  const valorFunilQuente = funilQuente.reduce((s, f) => s + f.valor, 0);
  const pctFunilNecessario = valorFunilQuente > 0 ? Math.round((falta / valorFunilQuente) * 100) : null;

  // "O que fazer hoje": as oportunidades quentes mais PARADAS (última
  // atividade registrada; sem atividade, vale o updatedAt da oportunidade).
  const ults = quentes.length
    ? await prisma.crmAtividade.groupBy({
        by: ['oportunidadeId'],
        _max: { dataHora: true },
        where: { oportunidadeId: { in: quentes.map((q) => q.id) } },
      })
    : [];
  const ultPorOp = new Map(ults.map((u) => [u.oportunidadeId, u._max.dataHora]));
  const agora = Date.now();
  const paradas = quentes
    .map((q) => {
      const ref = ultPorOp.get(q.id) ?? q.updatedAt;
      return {
        id: q.id,
        titulo: q.titulo,
        empresa: q.empresa?.razaoSocial ?? null,
        etapa: q.etapa,
        valor: Number(q.valor ?? 0),
        diasParado: Math.max(Math.floor((agora - new Date(ref).getTime()) / MS_DIA), 0),
      };
    })
    .sort((a, b) => b.diasParado - a.diasParado || b.valor - a.valor)
    .slice(0, 3);

  return {
    ano, metaAno, realizadoAno,
    pctMeta: metaAno > 0 ? Math.round((realizadoAno / metaAno) * 100) : 0,
    falta, mesesDecorridos, mesesRestantes,
    runRateAtual, runRateNecessario, multiplicador,
    funilQuente, valorFunilQuente, pctFunilNecessario, paradas,
  };
}

// ─── E-mail diário (7h30 BRT, todo dia, só sócios) ──────────────────────────

const fmtM = (v: number): string => {
  const nf = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  if (v >= 1_000_000) return `R$ ${nf(v / 1_000_000)} M`;
  if (v >= 1_000) return `R$ ${nf(v / 1_000, 0)} mil`;
  return `R$ ${nf(v, 0)}`;
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function enviarFarolComercial(): Promise<void> {
  const socios = await prisma.user.findMany({
    where: { role: 'socio', isActive: true },
    select: { email: true },
  });
  if (socios.length === 0) return;

  const f = await calcularFarol();
  if (f.metaAno <= 0) return; // sem meta cadastrada no ano, não tem farol

  const appUrl = process.env.APP_PUBLIC_URL ?? 'https://ber-app.vercel.app';
  const dataFmt = agoraSp().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const ETAPA_LABEL: Record<string, string> = { proposta_enviada: 'proposta enviada', negociacao: 'negociação' };

  const linhasParadas = f.paradas.map((p) =>
    `<li style="margin:4px 0;color:#2D2D2D;font-size:13px;">
      <strong>${esc(p.titulo)}</strong>${p.empresa ? ` · ${esc(p.empresa)}` : ''} — ${fmtM(p.valor)},
      ${esc(ETAPA_LABEL[p.etapa] ?? p.etapa)}, <strong style="color:#B42318;">${p.diasParado} dia${p.diasParado === 1 ? '' : 's'} sem movimento</strong>
    </li>`).join('');

  const funilTxt = f.funilQuente
    .filter((x) => x.count > 0)
    .map((x) => `${fmtM(x.valor)} em ${ETAPA_LABEL[x.etapa] ?? x.etapa} (${x.count})`)
    .join(' · ') || 'nada em proposta enviada ou negociação';

  const corpo = `
    <p style="font-size:14px;color:#2D2D2D;margin:0 0 10px;">
      Meta ${f.ano}: <strong>${fmtM(f.metaAno)}</strong> · Ganho até agora: <strong>${fmtM(f.realizadoAno)}</strong> (${f.pctMeta}%)
    </p>
    <p style="font-size:14px;color:#2D2D2D;margin:0 0 10px;">
      Falta <strong style="color:#B42318;">${fmtM(f.falta)}</strong> com <strong>${f.mesesRestantes.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} meses</strong> de ano pela frente.
    </p>
    <p style="font-size:14px;color:#2D2D2D;margin:0 0 10px;">
      Ritmo necessário daqui pra frente: <strong>${fmtM(f.runRateNecessario)}/mês</strong>.
      Ritmo atual do ano: <strong>${fmtM(f.runRateAtual)}/mês</strong>${f.multiplicador ? ` — precisa de <strong>${f.multiplicador.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x</strong>` : ''}.
    </p>
    <p style="font-size:13px;color:#5C5E54;margin:0 0 14px;">
      No funil quente: ${funilTxt}${f.pctFunilNecessario != null ? ` — fechar ~<strong>${f.pctFunilNecessario}%</strong> disso bate a meta` : ''}.
    </p>
    ${f.paradas.length ? `<p style="font-size:13px;color:#2D2D2D;margin:0 0 4px;"><strong>Hoje, destravar primeiro:</strong></p><ul style="margin:0 0 14px;padding-left:18px;">${linhasParadas}</ul>` : ''}
    <p style="margin:0;"><a href="${appUrl}/crm" style="color:#5E6B0F;font-weight:600;font-size:13px;">Abrir o CRM →</a></p>`;

  const { htmlAvisoInterno } = await import('../../services/email-equipe');
  const { sendEmailObra } = await import('../../services/email-obras');
  await sendEmailObra({
    to: socios.map((s) => s.email),
    subject: `🎯 Farol Comercial ${dataFmt} — falta ${fmtM(f.falta)} pra meta`,
    html: htmlAvisoInterno('🎯 Farol Comercial', corpo, 'Aviso automático do BER App · CRM · somente sócios'),
  });
}
