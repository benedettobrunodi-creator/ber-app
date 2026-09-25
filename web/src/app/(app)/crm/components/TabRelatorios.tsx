'use client';

/**
 * Relatórios do CRM — roteiro da REUNIÃO COMERCIAL (Bruno 25/09/26).
 * 5 blocos na ordem da conversa + anexo:
 *   1 Captação (o que entrou) · 2 Saúde do funil · 3 Time · 4 Fontes ·
 *   5 Qualidade (win rate, segmentos, ticket, perdas) · Anexo Orçamentistas.
 * Regra da casa: bater o olho e entender a mensagem; sempre com gráfico.
 */

import { useEffect, useState, type ReactNode } from 'react';
import api from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, ComposedChart, Line, LabelList,
} from 'recharts';
import { fmt, Oportunidade } from '../types';
import DrilldownModal from './DrilldownModal';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const ORIGEM_COLORS: Record<string, string> = {
  gerenciadora: '#5A7A7A',
  marketing:    '#B5B820',
  outbound:     '#3B82F6',
  networking:   '#8B5CF6',
  broker:       '#E6A23C',
  arquitetura:  '#EC4899',
  recorrente:   '#3D9E5F',
  change_order: '#0EA5E9',
  sem_origem:   '#868686',
};

const ORIGEM_LABELS: Record<string, string> = {
  gerenciadora: 'Gerenciadora',
  marketing:    'Marketing',
  outbound:     'Outbound',
  networking:   'Networking',
  broker:       'Broker',
  arquitetura:  'Arquitetura',
  recorrente:   'Recorrente',
  change_order: 'Change Order',
  sem_origem:   'Sem origem',
};

const ETAPA_LABELS: Record<string, string> = {
  lead: 'Lead',
  qualificacao: 'Qualificação',
  proposta_producao: 'Proposta em produção',
  proposta_enviada: 'Proposta enviada',
  negociacao: 'Negociação',
};
const ETAPAS_ABERTAS = ['lead', 'qualificacao', 'proposta_producao', 'proposta_enviada', 'negociacao'];
const ETAPAS_FECHADAS = ['ganho', 'perdido', 'declinado', 'cancelado'];

const SEGMENTO_COLORS = ['#5A7A7A', '#3B82F6', '#8B5CF6', '#E6A23C', '#EC4899', '#3D9E5F', '#868686'];
const MOTIVO_COLORS   = ['#EF4444', '#F97316', '#F59E0B', '#8B5CF6', '#3B82F6', '#6B7280', '#94A3B8'];

// Tooltip customizado para o gráfico de motivos de perda
function MotivoTooltip({
  active, payload, opsAno = [],
}: {
  active?: boolean;
  payload?: Array<{ payload: { motivo: string; count: number; valor: number } }>;
  opsAno?: Oportunidade[];
}) {
  if (!active || !payload?.length) return null;
  const { motivo, count, valor } = payload[0].payload;
  const projetos = opsAno.filter(
    (o) => ['perdido', 'declinado', 'cancelado'].includes(o.etapa) && o.motivoPerda === motivo,
  );
  return (
    <div className="bg-white border border-ber-border rounded-lg p-3 shadow-lg max-w-[240px]">
      <p className="text-xs font-bold text-ber-carbon mb-1">{motivo}</p>
      <p className="text-xs text-ber-gray mb-2">{count} deal{count !== 1 ? 's' : ''} · {fmt(valor)}</p>
      {projetos.length > 0 && (
        <div className="space-y-0.5">
          {projetos.map((p) => (
            <p key={p.id} className="text-[11px] text-ber-carbon truncate">· {p.titulo}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// Tooltip do gráfico "Valor de entrada por mês, por origem" — ordenado por
// valor decrescente (Bruno 25/09/26: "primeiro os mais altos, e dps diminuindo").
function OrigemMesTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const ordenado = payload
    .filter((item) => item.name !== '_total')
    .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
  return (
    <div className="bg-white border border-ber-border rounded-lg p-3 shadow-lg">
      <p className="text-xs font-bold text-ber-carbon mb-1.5">{label}</p>
      <div className="space-y-1">
        {ordenado.map((item) => (
          <p key={item.name} className="text-xs" style={{ color: item.color }}>
            {item.name} : {fmt(Number(item.value ?? 0))}
          </p>
        ))}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="bg-white border border-ber-border rounded-xl p-5">
      <div className="flex items-baseline gap-3 mb-4">
        <h3 className="font-bold text-ber-carbon">{title}</h3>
        {subtitle && <span className="text-sm text-ber-gray">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

/** Título de bloco — a pergunta que a reunião responde naquele momento. */
function Bloco({ num, titulo, pergunta }: { num: number; titulo: string; pergunta: string }) {
  return (
    <div className="pt-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ber-gray">{num} · {titulo}</p>
      <p className="text-xs text-ber-gray/70">{pergunta}</p>
    </div>
  );
}

export default function TabRelatorios({ oportunidades }: { oportunidades: Oportunidade[] }) {
  const ano = new Date().getFullYear();
  const [drill, setDrill] = useState<{ title: string; ops: Oportunidade[] } | null>(null);
  const [hoveredMotivo, setHoveredMotivo] = useState<string | null>(null);

  const [pipelineStats, setPipelineStats] = useState<{
    porOrigem: Record<string, { count: number; valor: number }>;
  } | null>(null);
  const [pipeMes, setPipeMes] = useState<Record<number, Record<string, number>>>({});
  const [ticketMedio, setTicketMedio] = useState<{ geral: number; porOrigem: Record<string, number> } | null>(null);
  const [winRate, setWinRate] = useState<{ ganho: number; perdido: number; declinado: number; cancelado: number; total: number; rate: number } | null>(null);
  const [motivosPerda, setMotivosPerda] = useState<{ motivo: string; count: number; valor: number }[]>([]);
  const [perfResponsavel, setPerfResponsavel] = useState<{
    name: string; ganho: number; perdido: number; total: number; winRate: number; ticketMedio: number; valorGanho: number;
  }[]>([]);
  const [cicloVendas, setCicloVendas] = useState<{
    geral: number;
    porOrigem: { origem: string; diasMedio: number; count: number }[];
    porResponsavel: { name: string; diasMedio: number; count: number }[];
  } | null>(null);
  const [winRateSegmento, setWinRateSegmento] = useState<{
    segmento: string; ganho: number; perdido: number; total: number; winRate: number; valorGanho: number; ticketMedio: number;
  }[]>([]);
  const [recorrencia, setRecorrencia] = useState<{
    total: number; recorrentes: number; novos: number; taxa: number;
    topRecorrentes: { id: string; razaoSocial: string; projetos: number; valorTotal: number }[];
  } | null>(null);
  const [cohort, setCohort] = useState<Record<number, {
    total: number; ganho: number; perdido: number; emAberto: number; valorGanho: number;
  }>>({});
  const [funilEtapas, setFunilEtapas] = useState<{ etapa: string; count: number; valor: number }[]>([]);

  // Produtividade dos orçamentistas (base: esteira de orçamentos)
  const [prodAno, setProdAno] = useState(ano);
  const [prodMes, setProdMes] = useState(0); // 0 = ano todo
  const [prodEnviados, setProdEnviados] = useState(false);
  const [produtividade, setProdutividade] = useState<{
    responsavelId: string | null; nome: string; novos: number; revisoes: number; changeOrders: number; total: number;
  }[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/crm/stats/pipeline'),
      api.get(`/crm/stats/pipeline-mes-a-mes/${ano}`),
      api.get(`/crm/stats/ticket-medio?ano=${ano}`),
      api.get(`/crm/stats/win-rate?ano=${ano}`),
    ]).then(([ps, pm, tm, wr]) => {
      setPipelineStats(ps.data);
      setPipeMes(pm.data);
      setTicketMedio(tm.data);
      setWinRate(wr.data);
    });

    api.get(`/crm/stats/motivos-perda?ano=${ano}`).then((r) => setMotivosPerda(r.data)).catch(() => {});
    api.get(`/crm/stats/performance-responsavel?ano=${ano}`).then((r) => setPerfResponsavel(r.data)).catch(() => {});
    api.get(`/crm/stats/ciclo-vendas?ano=${ano}`).then((r) => setCicloVendas(r.data)).catch(() => {});
    api.get(`/crm/stats/win-rate-segmento?ano=${ano}`).then((r) => setWinRateSegmento(r.data)).catch(() => {});
    api.get('/crm/stats/recorrencia-clientes').then((r) => setRecorrencia(r.data)).catch(() => {});
    api.get(`/crm/stats/cohort?ano=${ano}`).then((r) => setCohort(r.data)).catch(() => {});
    api.get('/crm/stats/funil-conversao').then((r) => setFunilEtapas(r.data)).catch(() => {});
  }, [ano]);

  useEffect(() => {
    const qs = new URLSearchParams({ ano: String(prodAno), enviados: String(prodEnviados) });
    if (prodMes) qs.set('mes', String(prodMes));
    api.get(`/orcamentos/produtividade?${qs.toString()}`).then((r) => setProdutividade(r.data.data)).catch(() => {});
  }, [prodAno, prodMes, prodEnviados]);

  const opsAno = oportunidades.filter((o) => {
    const ref = o.dataGanho ?? o.dataFechamentoPrevisto ?? o.updatedAt;
    return new Date(ref).getFullYear() === ano;
  });

  const openDrill = (title: string, ops: Oportunidade[]) => setDrill({ title, ops });

  // ── BLOCO 1: Captação ──────────────────────────────────────────
  const criadosAno = Object.values(cohort).reduce((s, c) => s + c.total, 0);
  const cohortData = MESES.map((m, i) => {
    const c = cohort[i + 1];
    if (!c) return { mes: m, ganho: 0, perdido: 0, emAberto: 0 };
    return { mes: m, ganho: c.ganho, perdido: c.perdido, emAberto: c.emAberto };
  });

  const allOrigens = Array.from(new Set(Object.values(pipeMes).flatMap((m) => Object.keys(m))));
  const pipeMesData = MESES.map((m, i) => {
    const row: Record<string, number | string> = { mes: m };
    let total = 0;
    for (const o of allOrigens) {
      const v = pipeMes[i + 1]?.[o] ?? 0;
      row[o] = v;
      total += v;
    }
    row._total = total;
    return row;
  });
  const valorEntradasAno = pipeMesData.reduce((s, r) => s + Number(r._total ?? 0), 0);

  // ── BLOCO 2: Saúde do funil ────────────────────────────────────
  const funilAbertas = ETAPAS_ABERTAS.map((etapa) => {
    const f = funilEtapas.find((x) => x.etapa === etapa);
    return { etapa, label: ETAPA_LABELS[etapa], count: f?.count ?? 0, valor: f?.valor ?? 0 };
  });
  const totalAbertas = funilAbertas.reduce((s, f) => s + f.count, 0);

  // ── BLOCO 3: Time — demanda em aberto por pessoa (da lista viva) ─
  const demandaMap: Record<string, { count: number; valor: number }> = {};
  for (const op of oportunidades) {
    if (ETAPAS_FECHADAS.includes(op.etapa)) continue;
    const nome = op.responsavel?.name ?? 'Sem responsável';
    demandaMap[nome] ??= { count: 0, valor: 0 };
    demandaMap[nome].count++;
    demandaMap[nome].valor += Number(op.valor ?? 0);
  }
  const timeData = perfResponsavel.map((r) => ({
    ...r,
    abertoCount: demandaMap[r.name]?.count ?? 0,
    abertoValor: demandaMap[r.name]?.valor ?? 0,
  }));
  // Quem só tem demanda (ainda sem ganho/perda no ano) também aparece
  for (const [nome, d] of Object.entries(demandaMap)) {
    if (nome === 'Sem responsável') continue;
    if (!timeData.find((t) => t.name === nome)) {
      timeData.push({ name: nome, ganho: 0, perdido: 0, total: 0, winRate: 0, ticketMedio: 0, valorGanho: 0, abertoCount: d.count, abertoValor: d.valor });
    }
  }
  timeData.sort((a, b) => b.valorGanho - a.valorGanho || b.abertoValor - a.abertoValor);
  const timeChartData = timeData.map((t) => ({ name: t.name, Ganho: t.valorGanho, 'Em aberto': t.abertoValor }));

  // ── BLOCO 4: Fontes — visão unificada ──────────────────────────
  const origemGanhosMap: Record<string, { count: number; valor: number }> = {};
  for (const op of opsAno) {
    if (op.etapa !== 'ganho' || !op.origem) continue;
    origemGanhosMap[op.origem] ??= { count: 0, valor: 0 };
    origemGanhosMap[op.origem].count++;
    origemGanhosMap[op.origem].valor += Number(op.valor ?? 0);
  }
  const fontes = pipelineStats
    ? Object.entries(pipelineStats.porOrigem)
        .filter(([k]) => k !== 'sem_origem')
        .map(([k, v]) => ({
          origem: k,
          name: ORIGEM_LABELS[k] ?? k,
          color: ORIGEM_COLORS[k] ?? '#868686',
          count: v.count,
          valor: v.valor,
          ganhoCount: origemGanhosMap[k]?.count ?? 0,
          ganhoValor: origemGanhosMap[k]?.valor ?? 0,
        }))
        .sort((a, b) => b.ganhoValor - a.ganhoValor || b.valor - a.valor)
    : [];
  const fontesTotal = fontes.reduce((acc, f) => ({ count: acc.count + f.count, valor: acc.valor + f.valor, ganhoCount: acc.ganhoCount + f.ganhoCount, ganhoValor: acc.ganhoValor + f.ganhoValor }), { count: 0, valor: 0, ganhoCount: 0, ganhoValor: 0 });

  // ── BLOCO 5: Qualidade ─────────────────────────────────────────
  const ticketData = ticketMedio
    ? Object.entries(ticketMedio.porOrigem)
        .map(([k, v]) => ({ name: ORIGEM_LABELS[k] ?? k, valor: v, color: ORIGEM_COLORS[k] ?? '#868686' }))
        .sort((a, b) => b.valor - a.valor)
    : [];
  const segmentoGanhos = winRateSegmento.filter((s) => s.ganho > 0).sort((a, b) => b.valorGanho - a.valorGanho);

  return (
    <div className="space-y-5">
      {drill && <DrilldownModal title={drill.title} oportunidades={drill.ops} onClose={() => setDrill(null)} />}

      {/* ════ BLOCO 1 — CAPTAÇÃO ════ */}
      <Bloco num={1} titulo="Captação" pergunta="Estamos alimentando o funil?" />

      <Section title="Entradas no ano" subtitle={String(ano)}>
        <div className="flex flex-wrap items-center gap-6 mb-4">
          <div>
            <p className="text-3xl font-bold text-ber-teal">{criadosAno}</p>
            <p className="text-xs text-ber-gray">negócios criados em {ano}</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-ber-carbon">{fmt(valorEntradasAno)}</p>
            <p className="text-xs text-ber-gray">em valor de entrada</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="text-[11px] font-semibold text-ber-gray uppercase tracking-wide mb-2">Criados por mês — e o que virou cada safra</p>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={cohortData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="ganho" name="Ganho" stackId="a" fill="#3D9E5F" />
                <Bar dataKey="perdido" name="Perdido/Declinado" stackId="a" fill="#EF4444" />
                <Bar dataKey="emAberto" name="Em Aberto" stackId="a" fill="#94A3B8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-ber-gray uppercase tracking-wide mb-2">Valor de entrada por mês, por origem</p>
            <ResponsiveContainer width="100%" height={210}>
              <ComposedChart data={pipeMesData} margin={{ top: 24, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip content={<OrigemMesTooltip />} />
                {allOrigens.map((o) => (
                  <Bar key={o} dataKey={o} name={ORIGEM_LABELS[o] ?? o} stackId="a" fill={ORIGEM_COLORS[o] ?? '#868686'} />
                ))}
                <Line dataKey="_total" stroke="transparent" dot={false} activeDot={false} isAnimationActive={false} legendType="none">
                  <LabelList
                    dataKey="_total" position="top" offset={8}
                    formatter={(value) => {
                      const v = Number(value);
                      if (!v) return '';
                      const nf = (n: number, digits = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
                      if (v >= 1_000_000) return `R$${nf(v / 1_000_000)} M`;
                      if (v >= 1_000) return `R$${nf(v / 1_000)} k`;
                      return `R$${nf(v, 0)}`;
                    }}
                    style={{ fontSize: 10, fill: '#2A2A2A', fontWeight: 700 }}
                  />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      {/* ════ BLOCO 2 — SAÚDE DO FUNIL ════ */}
      <Bloco num={2} titulo="Saúde do funil" pergunta="Onde estão os negócios abertos e quanto tempo levam?" />

      {funilAbertas.some((f) => f.count > 0) && (
        <Section title="Funil por etapa" subtitle={`${totalAbertas} negócios em aberto hoje`}>
          <ResponsiveContainer width="100%" height={Math.max(180, funilAbertas.length * 42)}>
            <BarChart layout="vertical" data={funilAbertas} margin={{ left: 10, right: 60 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E8E8E4" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, name, item) => [`${v} negócios · ${fmt(Number(item?.payload?.valor ?? 0))}`, 'Em aberto']} />
              <Bar dataKey="count" fill="#5A7A7A" radius={[0, 4, 4, 0]} onClick={(d) => {
                const etapa = funilAbertas.find((f) => f.label === (d as unknown as { label: string }).label)?.etapa;
                if (etapa) openDrill(`Etapa: ${ETAPA_LABELS[etapa]}`, oportunidades.filter((o) => o.etapa === etapa));
              }}>
                <LabelList dataKey="valor" position="right" formatter={(v) => Number(v) > 0 ? fmt(Number(v)) : ''} style={{ fontSize: 10, fill: '#5C5E54', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-ber-gray mt-1">Barra = quantidade · rótulo = valor em aberto na etapa. Clique pra ver a lista.</p>
        </Section>
      )}

      {cicloVendas && cicloVendas.porOrigem.length > 0 && (
        <Section title="Ciclo Médio de Vendas" subtitle={`${cicloVendas.geral} dias em média — ${ano}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold text-ber-gray mb-2 uppercase tracking-wide">Por Origem</p>
              <div className="space-y-2">
                {cicloVendas.porOrigem.map((o) => (
                  <div key={o.origem} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ORIGEM_COLORS[o.origem] ?? '#868686' }} />
                    <span className="text-xs text-ber-carbon flex-1">{ORIGEM_LABELS[o.origem] ?? o.origem}</span>
                    <span className="text-xs font-bold text-ber-carbon">{o.diasMedio}d</span>
                    <span className="text-xs text-ber-gray">({o.count})</span>
                  </div>
                ))}
              </div>
            </div>
            {cicloVendas.porResponsavel.length > 0 && (
              <div>
                <p className="text-xs font-bold text-ber-gray mb-2 uppercase tracking-wide">Por Responsável</p>
                <div className="space-y-2">
                  {cicloVendas.porResponsavel.map((r) => (
                    <div key={r.name} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-ber-teal shrink-0" />
                      <span className="text-xs text-ber-carbon flex-1">{r.name}</span>
                      <span className="text-xs font-bold text-ber-carbon">{r.diasMedio}d</span>
                      <span className="text-xs text-ber-gray">({r.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ════ BLOCO 3 — TIME ════ */}
      <Bloco num={3} titulo="Time comercial" pergunta="Como cada um está — e quem está com quanta demanda na mão?" />

      {timeData.length > 0 && (
        <Section title="Por pessoa" subtitle={String(ano)}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <ResponsiveContainer width="100%" height={Math.max(160, timeChartData.length * 52)}>
              <BarChart layout="vertical" data={timeChartData} margin={{ left: 10, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E8E8E4" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Ganho" fill="#3D9E5F" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Em aberto" fill="#94A3B8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-ber-border">
                    <th className="text-left py-2 pr-3 text-ber-gray font-semibold">Pessoa</th>
                    <th className="text-right py-2 px-2 text-ber-gray font-semibold">Ganho</th>
                    <th className="text-center py-2 px-2 text-ber-gray font-semibold">Win Rate</th>
                    <th className="text-right py-2 px-2 text-ber-gray font-semibold">Em aberto</th>
                    <th className="text-center py-2 pl-2 text-ber-gray font-semibold">Negócios abertos</th>
                  </tr>
                </thead>
                <tbody>
                  {timeData.map((r) => (
                    <tr key={r.name} className="border-b border-ber-border/40 hover:bg-ber-surface transition-colors cursor-pointer"
                      onClick={() => openDrill(`Em aberto — ${r.name}`, oportunidades.filter((o) => !ETAPAS_FECHADAS.includes(o.etapa) && o.responsavel?.name === r.name))}>
                      <td className="py-2.5 pr-3 font-semibold text-ber-carbon">{r.name}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-ber-green">{r.valorGanho > 0 ? fmt(r.valorGanho) : '—'}</td>
                      <td className="py-2.5 px-2 text-center text-ber-carbon font-bold">{r.total > 0 ? `${Math.round(r.winRate * 100)}%` : '—'}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-ber-carbon">{r.abertoValor > 0 ? fmt(r.abertoValor) : '—'}</td>
                      <td className="py-2.5 pl-2 text-center text-ber-gray">{r.abertoCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-ber-gray mt-2">“Em aberto” = pipeline vivo na mão da pessoa agora (demanda). Clique na linha pra ver a lista.</p>
            </div>
          </div>
        </Section>
      )}

      {/* ════ BLOCO 4 — FONTES ════ */}
      <Bloco num={4} titulo="Fontes de negócio" pergunta="De onde vem negócio — e de onde vem negócio BOM?" />

      {fontes.length > 0 && (
        <Section title="Volume por fonte" subtitle={String(ano)}>
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-ber-gray uppercase tracking-wide mb-1 text-center">Tudo que entrou (R$)</p>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={fontes} dataKey="valor" cx="50%" cy="50%" outerRadius={82} innerRadius={46}>
                    {fontes.map((o, i) => <Cell key={i} fill={o.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-ber-gray uppercase tracking-wide mb-1 text-center">O que foi GANHO (R$)</p>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={fontes.filter((f) => f.ganhoValor > 0)} dataKey="ganhoValor" cx="50%" cy="50%" outerRadius={82} innerRadius={46}>
                    {fontes.filter((f) => f.ganhoValor > 0).map((o, i) => <Cell key={i} fill={o.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center pt-1">
              <div className="space-y-1.5">
                {fontes.map((o) => (
                  <div key={o.origem} className="flex items-center gap-2 cursor-pointer hover:bg-ber-surface rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                    onClick={() => openDrill(`Origem: ${o.name}`, oportunidades.filter((op) => op.origem === o.origem))}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
                    <span className="text-sm text-ber-carbon font-medium flex-1 truncate">{o.name}</span>
                    <span className="text-xs text-ber-gray w-20 text-right" title="tudo que entrou">{fmt(o.valor)}</span>
                    <span className="text-xs font-bold text-ber-green w-20 text-right" title="ganho">{o.ganhoValor > 0 ? fmt(o.ganhoValor) : '—'}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 px-2 mt-1 pt-2 border-t border-ber-border">
                  <span className="w-2.5 h-2.5 shrink-0" />
                  <span className="text-xs font-bold text-ber-gray flex-1">Total</span>
                  <span className="text-xs font-bold text-ber-carbon w-20 text-right">{fmt(fontesTotal.valor)}</span>
                  <span className="text-xs font-bold text-ber-green w-20 text-right">{fmt(fontesTotal.ganhoValor)}</span>
                </div>
                <p className="text-[10px] text-ber-gray/70 text-right">cinza = entrou · verde = ganho</p>
              </div>
            </div>
          </div>
        </Section>
      )}

      {recorrencia && recorrencia.total > 0 && (
        <Section title="Recorrência de Clientes">
          <div className="flex items-center gap-6 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-ber-teal">{Math.round(recorrencia.taxa * 100)}%</p>
              <p className="text-xs text-ber-gray mt-1">Taxa de Recorrência</p>
            </div>
            <div className="grid grid-cols-3 gap-3 flex-1">
              <div className="text-center bg-ber-surface rounded-xl p-3">
                <p className="text-xl font-bold text-ber-carbon">{recorrencia.total}</p>
                <p className="text-xs text-ber-gray">Clientes c/ projeto</p>
              </div>
              <div className="text-center bg-ber-surface rounded-xl p-3">
                <p className="text-xl font-bold text-ber-teal">{recorrencia.recorrentes}</p>
                <p className="text-xs text-ber-gray">Recorrentes</p>
              </div>
              <div className="text-center bg-ber-surface rounded-xl p-3">
                <p className="text-xl font-bold text-ber-gray">{recorrencia.novos}</p>
                <p className="text-xs text-ber-gray">Únicos</p>
              </div>
            </div>
          </div>
          {recorrencia.topRecorrentes.length > 0 && (
            <div>
              <p className="text-xs font-bold text-ber-gray uppercase tracking-wide mb-2">Top Clientes Recorrentes</p>
              <div className="space-y-1.5">
                {recorrencia.topRecorrentes.map((e, i) => (
                  <div key={e.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-ber-surface transition-colors">
                    <span className="text-xs font-bold text-ber-gray w-4">{i + 1}</span>
                    <span className="text-xs font-semibold text-ber-carbon flex-1">{e.razaoSocial}</span>
                    <span className="text-xs text-ber-gray">{e.projetos} projetos</span>
                    <span className="text-xs font-bold text-ber-carbon">{fmt(e.valorTotal)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ════ BLOCO 5 — QUALIDADE ════ */}
      <Bloco num={5} titulo="Qualidade da venda" pergunta="Onde ganhamos, a quanto — e por que perdemos?" />

      {winRate && (
        <Section title="Win Rate" subtitle={String(ano)}>
          <div className="flex items-center gap-6">
            <div className="text-center shrink-0">
              <p className="text-4xl font-bold text-ber-green">{Math.round(winRate.rate * 100)}%</p>
              <p className="text-xs text-ber-gray mt-1">Taxa de Conversão</p>
            </div>
            <div className="flex-1 grid grid-cols-4 gap-2">
              <div className="text-center bg-ber-surface rounded-xl p-3 cursor-pointer hover:ring-1 hover:ring-ber-green transition-all"
                onClick={() => openDrill(`Ganhos ${ano}`, opsAno.filter((o) => o.etapa === 'ganho'))}>
                <p className="text-2xl font-bold text-ber-green">{winRate.ganho}</p>
                <p className="text-[11px] text-ber-gray">Ganhos</p>
              </div>
              <div className="text-center bg-ber-surface rounded-xl p-3 cursor-pointer hover:ring-1 hover:ring-ber-red transition-all"
                onClick={() => openDrill(`Perdidos ${ano}`, opsAno.filter((o) => o.etapa === 'perdido'))}>
                <p className="text-2xl font-bold text-ber-red">{winRate.perdido}</p>
                <p className="text-[11px] text-ber-gray">Perdidos</p>
              </div>
              <div className="text-center bg-ber-surface/60 rounded-xl p-3 opacity-50 cursor-pointer hover:opacity-70 transition-all"
                onClick={() => openDrill(`Declinados ${ano}`, opsAno.filter((o) => o.etapa === 'declinado'))}
                title="Declinados não entram no cálculo do win rate">
                <p className="text-2xl font-bold text-orange-400">{winRate.declinado}</p>
                <p className="text-[11px] text-ber-gray">Declinados</p>
              </div>
              <div className="text-center bg-ber-surface/60 rounded-xl p-3 opacity-50 cursor-pointer hover:opacity-70 transition-all"
                onClick={() => openDrill(`Cancelados ${ano}`, opsAno.filter((o) => o.etapa === 'cancelado'))}
                title="Cancelados não entram no cálculo do win rate">
                <p className="text-2xl font-bold text-ber-gray">{winRate.cancelado}</p>
                <p className="text-[11px] text-ber-gray">Cancelados</p>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-ber-gray/60 mt-3">
            Fórmula: ganhos ÷ (ganhos + perdidos) = {winRate.ganho} ÷ {winRate.total} = {winRate.total > 0 ? Math.round(winRate.rate * 100) : 0}%.
            Declinados (recusa antes da disputa) e cancelados (inviabilizado externamente) ficam fora.
          </p>
        </Section>
      )}

      {winRateSegmento.length > 0 && (
        <Section title="Segmentos" subtitle={`${ano} — quem ganha e a quanto`}>
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {segmentoGanhos.length > 0 && (
              <div className="w-full lg:w-56 shrink-0">
                <p className="text-[11px] font-bold text-ber-gray uppercase tracking-wide mb-1 text-center">Ganhos por Volume (R$)</p>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie data={segmentoGanhos} dataKey="valorGanho" nameKey="segmento" cx="50%" cy="50%" outerRadius={82} innerRadius={46}>
                      {segmentoGanhos.map((_, i) => <Cell key={i} fill={SEGMENTO_COLORS[i % SEGMENTO_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex-1 min-w-0 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-ber-border">
                    <th className="text-left py-2 pr-4 text-ber-gray font-semibold">Segmento</th>
                    <th className="text-center py-2 px-2 text-ber-gray font-semibold">Ganhos</th>
                    <th className="text-center py-2 px-2 text-ber-gray font-semibold">Perdidos</th>
                    <th className="text-center py-2 px-2 text-ber-gray font-semibold">Win Rate</th>
                    <th className="text-right py-2 pl-2 text-ber-gray font-semibold">Valor Ganho</th>
                    <th className="text-right py-2 pl-2 text-ber-gray font-semibold">Ticket Médio</th>
                  </tr>
                </thead>
                <tbody>
                  {winRateSegmento.map((s, i) => (
                    <tr key={s.segmento}
                      className="border-b border-ber-border/40 hover:bg-ber-surface transition-colors cursor-pointer"
                      onClick={() => openDrill(`Segmento: ${s.segmento}`, opsAno.filter((o) => o.empresa?.segmento === s.segmento))}>
                      <td className="py-2.5 pr-4 font-semibold text-ber-carbon">
                        <span className="w-2 h-2 rounded-full inline-block mr-2" style={{ backgroundColor: SEGMENTO_COLORS[i % SEGMENTO_COLORS.length] }} />
                        {s.segmento}
                      </td>
                      <td className="py-2.5 px-2 text-center text-ber-green font-bold">{s.ganho}</td>
                      <td className="py-2.5 px-2 text-center text-ber-red">{s.perdido}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-ber-surface rounded-full h-1.5">
                            <div className="h-full rounded-full bg-ber-green" style={{ width: `${Math.round(s.winRate * 100)}%` }} />
                          </div>
                          <span className="text-ber-carbon font-bold w-8 text-right">{Math.round(s.winRate * 100)}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 pl-2 text-right font-bold text-ber-carbon">{fmt(s.valorGanho)}</td>
                      <td className="py-2.5 pl-2 text-right text-ber-gray">{s.ticketMedio > 0 ? fmt(s.ticketMedio) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>
      )}

      {ticketMedio && (
        <Section title="Ticket Médio">
          <div className="flex items-center gap-4 mb-4">
            <span className="text-2xl font-bold text-ber-teal">{fmt(ticketMedio.geral)}</span>
            <span className="text-xs text-ber-gray">geral {ano}</span>
          </div>
          {ticketData.length > 0 && (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ticketData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                  {ticketData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>
      )}

      {motivosPerda.length > 0 && (
        <Section title="Motivos de Perda" subtitle={String(ano)}>
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={motivosPerda} dataKey="count" nameKey="motivo" cx="50%" cy="50%" outerRadius={85} innerRadius={45}>
                  {motivosPerda.map((_, i) => <Cell key={i} fill={MOTIVO_COLORS[i % MOTIVO_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<MotivoTooltip opsAno={opsAno} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {motivosPerda.map((m, i) => {
                const projetos = opsAno.filter(
                  (o) => ['perdido', 'declinado', 'cancelado'].includes(o.etapa) && o.motivoPerda === m.motivo,
                );
                return (
                  <div key={m.motivo}
                    className="relative flex items-center gap-2 cursor-pointer hover:bg-ber-surface rounded-lg px-2 py-1 -mx-2 transition-colors"
                    onClick={() => openDrill(`Perdidos: ${m.motivo}`, projetos)}
                    onMouseEnter={() => setHoveredMotivo(m.motivo)}
                    onMouseLeave={() => setHoveredMotivo(null)}>
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: MOTIVO_COLORS[i % MOTIVO_COLORS.length] }} />
                    <span className="text-sm text-ber-carbon flex-1">{m.motivo}</span>
                    <span className="text-sm font-bold text-ber-carbon">{m.count}</span>
                    <span className="text-xs text-ber-gray w-24 text-right">{fmt(m.valor)}</span>
                    {hoveredMotivo === m.motivo && projetos.length > 0 && (
                      <div className="absolute left-0 bottom-full mb-1 z-50 bg-white border border-ber-border rounded-lg shadow-lg p-3 w-72 pointer-events-none">
                        <p className="text-[10px] font-bold text-ber-gray uppercase tracking-wide mb-1.5">Projetos perdidos</p>
                        {projetos.map((p) => (
                          <p key={p.id} className="text-xs text-ber-carbon py-0.5 border-b border-ber-border/30 last:border-0 truncate">
                            {p.titulo}
                            {p.empresa && <span className="text-ber-gray ml-1.5">· {p.empresa.razaoSocial}</span>}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {/* ════ ANEXO — ORÇAMENTISTAS ════ */}
      <Bloco num={6} titulo="Anexo — Orçamentos" pergunta="Capacidade da esteira de propostas" />

      <Section title="Produtividade dos Orçamentistas" subtitle="Novos + Revisões + Change Orders — por orçamentista">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select value={prodAno} onChange={(e) => setProdAno(Number(e.target.value))}
            className="rounded-lg border border-ber-border px-2 py-1.5 text-sm focus:border-ber-teal focus:outline-none">
            {[ano, ano - 1, ano - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={prodMes} onChange={(e) => setProdMes(Number(e.target.value))}
            className="rounded-lg border border-ber-border px-2 py-1.5 text-sm focus:border-ber-teal focus:outline-none">
            <option value={0}>Ano todo</option>
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-ber-gray cursor-pointer">
            <input type="checkbox" checked={prodEnviados} onChange={(e) => setProdEnviados(e.target.checked)} className="h-4 w-4 accent-ber-teal" />
            Só enviados
          </label>
          <span className="text-xs text-ber-gray/60">Período pela data de entrega</span>
        </div>
        {produtividade.length === 0 ? (
          <p className="py-8 text-center text-sm text-ber-gray">Sem orçamentos no período.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={Math.max(200, produtividade.length * 44)}>
              <BarChart layout="vertical" data={produtividade} margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="novos" stackId="a" name="Novos" fill="#5A7A7A" />
                <Bar dataKey="revisoes" stackId="a" name="Revisões" fill="#B5B820" />
                <Bar dataKey="changeOrders" stackId="a" name="Change Orders" fill="#0EA5E9">
                  <LabelList dataKey="total" position="right" style={{ fontSize: 11, fontWeight: 700, fill: '#2D2D2D' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ber-gray border-b border-ber-border">
                    <th className="py-2">Orçamentista</th>
                    <th className="py-2 text-center">Novos</th>
                    <th className="py-2 text-center">Revisões</th>
                    <th className="py-2 text-center">Change Orders</th>
                    <th className="py-2 text-center font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {produtividade.map((r) => (
                    <tr key={r.responsavelId ?? r.nome} className="border-b border-ber-border/50">
                      <td className="py-2 font-medium text-ber-carbon">{r.nome}</td>
                      <td className="py-2 text-center tabular-nums">{r.novos}</td>
                      <td className="py-2 text-center tabular-nums">{r.revisoes}</td>
                      <td className="py-2 text-center tabular-nums">{r.changeOrders}</td>
                      <td className="py-2 text-center tabular-nums font-bold text-ber-carbon">{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
