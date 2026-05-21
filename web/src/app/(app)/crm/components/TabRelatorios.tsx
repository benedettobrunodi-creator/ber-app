'use client';

import { useEffect, useState, type ReactNode } from 'react';
import api from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
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
  sem_origem:   'Sem origem',
};

const ETAPA_LABELS: Record<string, string> = {
  lead:               'Lead',
  qualificacao:       'Qualificação',
  proposta_producao:  'Prop. em Produção',
  proposta_enviada:   'Prop. Enviada',
  negociacao:         'Negociação',
  ganho:              'Ganho',
  perdido:            'Perdido',
  declinado:          'Declinado',
  cancelado:          'Cancelado',
};

const ETAPA_COLORS: Record<string, string> = {
  lead:               '#94A3B8',
  qualificacao:       '#60A5FA',
  proposta_producao:  '#A78BFA',
  proposta_enviada:   '#C084FC',
  negociacao:         '#F59E0B',
  ganho:              '#3D9E5F',
  perdido:            '#EF4444',
  declinado:          '#F97316',
  cancelado:          '#6B7280',
};

const SEGMENTO_COLORS = ['#5A7A7A', '#3B82F6', '#8B5CF6', '#E6A23C', '#EC4899', '#3D9E5F', '#868686'];

const MOTIVO_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#8B5CF6', '#3B82F6', '#6B7280', '#94A3B8'];

// ── Seção reutilizável ────────────────────────────────────────────────────────
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

// ── Componente principal ───────────────────────────────────────────────────────
export default function TabRelatorios({ oportunidades }: { oportunidades: Oportunidade[] }) {
  const ano = new Date().getFullYear();
  const [drill, setDrill] = useState<{ title: string; ops: Oportunidade[] } | null>(null);

  // Estado de cada bloco de dados
  const [pipelineStats, setPipelineStats] = useState<{
    porOrigem: Record<string, { count: number; valor: number }>;
  } | null>(null);
  const [pipeMes, setPipeMes] = useState<Record<number, Record<string, number>>>({});
  const [ticketMedio, setTicketMedio] = useState<{ geral: number; porOrigem: Record<string, number> } | null>(null);
  const [winRate, setWinRate] = useState<{ ganho: number; perdido: number; total: number; rate: number } | null>(null);
  const [funilConversao, setFunilConversao] = useState<{ etapa: string; count: number; valor: number }[]>([]);
  const [motivosPerda, setMotivosPerda] = useState<{ motivo: string; count: number; valor: number }[]>([]);
  const [perfResponsavel, setPerfResponsavel] = useState<{
    name: string; ganho: number; perdido: number; total: number; winRate: number; ticketMedio: number; valorGanho: number;
  }[]>([]);
  const [forecastH, setForecastH] = useState<{
    d30: { valor: number; ponderado: number; count: number };
    d60: { valor: number; ponderado: number; count: number };
    d90: { valor: number; ponderado: number; count: number };
  } | null>(null);
  const [cicloVendas, setCicloVendas] = useState<{
    geral: number;
    porOrigem: { origem: string; diasMedio: number; count: number }[];
    porResponsavel: { name: string; diasMedio: number; count: number }[];
  } | null>(null);
  const [winRateSegmento, setWinRateSegmento] = useState<{
    segmento: string; ganho: number; perdido: number; total: number; winRate: number; valorGanho: number; ticketMedio: number;
  }[]>([]);
  const [pipelineAging, setPipelineAging] = useState<{
    id: string; titulo: string; valor: unknown; etapa: string; updatedAt: string;
    diasSemMovimento: number; empresa: { razaoSocial: string } | null;
    responsavel: { name: string } | null;
  }[]>([]);
  const [recorrencia, setRecorrencia] = useState<{
    total: number; recorrentes: number; novos: number; taxa: number;
    topRecorrentes: { id: string; razaoSocial: string; projetos: number; valorTotal: number }[];
  } | null>(null);
  const [cohort, setCohort] = useState<Record<number, {
    total: number; ganho: number; perdido: number; emAberto: number; valorGanho: number;
  }>>({});

  useEffect(() => {
    Promise.all([
      api.get('/crm/stats/pipeline'),
      api.get(`/crm/stats/pipeline-mes-a-mes/${ano}`),
      api.get(`/crm/stats/ticket-medio?ano=${ano}`),
      api.get(`/crm/stats/win-rate?ano=${ano}`),
      api.get(`/crm/stats/funil-conversao?ano=${ano}`),
      api.get(`/crm/stats/motivos-perda?ano=${ano}`),
      api.get(`/crm/stats/performance-responsavel?ano=${ano}`),
      api.get('/crm/stats/forecast-horizonte'),
      api.get(`/crm/stats/ciclo-vendas?ano=${ano}`),
      api.get(`/crm/stats/win-rate-segmento?ano=${ano}`),
      api.get('/crm/stats/pipeline-aging'),
      api.get('/crm/stats/recorrencia-clientes'),
      api.get(`/crm/stats/cohort?ano=${ano}`),
    ]).then(([ps, pm, tm, wr, fc, mp, pr, fh, cv, wrs, pa, rc, co]) => {
      setPipelineStats(ps.data);
      setPipeMes(pm.data);
      setTicketMedio(tm.data);
      setWinRate(wr.data);
      setFunilConversao(fc.data);
      setMotivosPerda(mp.data);
      setPerfResponsavel(pr.data);
      setForecastH(fh.data);
      setCicloVendas(cv.data);
      setWinRateSegmento(wrs.data);
      setPipelineAging(pa.data);
      setRecorrencia(rc.data);
      setCohort(co.data);
    });
  }, [ano]);

  const opsAno = oportunidades.filter((o) => {
    const ref = o.dataGanho ?? o.dataFechamentoPrevisto ?? o.updatedAt;
    return new Date(ref).getFullYear() === ano;
  });

  const openDrill = (title: string, ops: Oportunidade[]) => setDrill({ title, ops });

  // Origem — pie
  const origemData = pipelineStats
    ? Object.entries(pipelineStats.porOrigem)
        .map(([k, v]) => ({ name: ORIGEM_LABELS[k] ?? k, value: v.count, valor: v.valor, color: ORIGEM_COLORS[k] ?? '#868686' }))
        .sort((a, b) => b.value - a.value)
    : [];

  // Pipeline mês a mês — bar stacked
  const allOrigens = Array.from(new Set(Object.values(pipeMes).flatMap((m) => Object.keys(m))));
  const pipeMesData = MESES.map((m, i) => {
    const row: Record<string, number | string> = { mes: m };
    for (const o of allOrigens) row[o] = pipeMes[i + 1]?.[o] ?? 0;
    return row;
  });

  // Ticket médio por origem
  const ticketData = ticketMedio
    ? Object.entries(ticketMedio.porOrigem)
        .map(([k, v]) => ({ name: ORIGEM_LABELS[k] ?? k, valor: v, color: ORIGEM_COLORS[k] ?? '#868686' }))
        .sort((a, b) => b.valor - a.valor)
    : [];

  // Cohort data para bar chart
  const cohortData = MESES.map((m, i) => {
    const c = cohort[i + 1];
    if (!c) return { mes: m, ganho: 0, perdido: 0, emAberto: 0 };
    return { mes: m, ganho: c.ganho, perdido: c.perdido, emAberto: c.emAberto };
  });

  // Funil: só etapas ativas (excluindo terminais) em ordem
  const funilAtivo = funilConversao.filter((f) => !['ganho', 'perdido', 'declinado', 'cancelado'].includes(f.etapa));
  const funilMax = Math.max(...funilAtivo.map((f) => f.count), 1);

  return (
    <div className="space-y-6">
      {drill && <DrilldownModal title={drill.title} oportunidades={drill.ops} onClose={() => setDrill(null)} />}

      {/* ── Win Rate ─────────────────────────────────────────────── */}
      {winRate && (
        <Section title="Win Rate" subtitle={String(ano)}>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-ber-green">{Math.round(winRate.rate * 100)}%</p>
              <p className="text-xs text-ber-gray mt-1">Taxa de Conversão</p>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-3">
              <div
                className="text-center bg-ber-surface rounded-xl p-3 cursor-pointer hover:ring-1 hover:ring-ber-green transition-all"
                onClick={() => openDrill(`Ganhos ${ano}`, opsAno.filter((o) => o.etapa === 'ganho'))}
              >
                <p className="text-2xl font-bold text-ber-green">{winRate.ganho}</p>
                <p className="text-xs text-ber-gray">Ganhos</p>
              </div>
              <div
                className="text-center bg-ber-surface rounded-xl p-3 cursor-pointer hover:ring-1 hover:ring-ber-red transition-all"
                onClick={() => openDrill(`Perdidos ${ano}`, opsAno.filter((o) => ['perdido', 'declinado', 'cancelado'].includes(o.etapa)))}
              >
                <p className="text-2xl font-bold text-ber-red">{winRate.perdido}</p>
                <p className="text-xs text-ber-gray">Perdidos</p>
              </div>
              <div
                className="text-center bg-ber-surface rounded-xl p-3 cursor-pointer hover:ring-1 hover:ring-ber-border transition-all"
                onClick={() => openDrill(`Todos ${ano}`, opsAno.filter((o) => ['ganho', 'perdido', 'declinado', 'cancelado'].includes(o.etapa)))}
              >
                <p className="text-2xl font-bold text-ber-carbon">{winRate.total}</p>
                <p className="text-xs text-ber-gray">Total</p>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* ── Funil de Conversão ───────────────────────────────────── */}
      {funilAtivo.length > 0 && (
        <Section title="Funil de Conversão" subtitle={String(ano)}>
          <div className="space-y-2">
            {funilAtivo.map((f) => {
              const pct = Math.round((f.count / funilMax) * 100);
              return (
                <div
                  key={f.etapa}
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => openDrill(ETAPA_LABELS[f.etapa] ?? f.etapa, oportunidades.filter((o) => o.etapa === f.etapa))}
                >
                  <span className="text-xs text-ber-gray w-36 shrink-0">{ETAPA_LABELS[f.etapa] ?? f.etapa}</span>
                  <div className="flex-1 bg-ber-surface rounded-full h-6 overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center pl-2 transition-all group-hover:opacity-80"
                      style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: ETAPA_COLORS[f.etapa] ?? '#94A3B8' }}
                    >
                      {pct > 15 && <span className="text-[10px] font-bold text-white">{fmt(f.valor)}</span>}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-ber-carbon w-6 text-right">{f.count}</span>
                </div>
              );
            })}
          </div>
          {/* Totais ganho + perdido */}
          {funilConversao.length > 0 && (
            <div className="mt-4 flex gap-4 border-t border-ber-border pt-4">
              {funilConversao.filter((f) => ['ganho', 'perdido', 'declinado', 'cancelado'].includes(f.etapa)).map((f) => (
                <div key={f.etapa} className="text-center">
                  <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ backgroundColor: ETAPA_COLORS[f.etapa] }} />
                  <span className="text-xs text-ber-gray">{ETAPA_LABELS[f.etapa]}: </span>
                  <span className="text-xs font-bold text-ber-carbon">{f.count}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── Forecast 30 / 60 / 90 dias ──────────────────────────── */}
      {forecastH && (
        <Section title="Forecast de Fechamento" subtitle="Próximos 30 / 60 / 90 dias">
          <div className="grid grid-cols-3 gap-3">
            {([['30', forecastH.d30], ['60', forecastH.d60], ['90', forecastH.d90]] as [string, typeof forecastH.d30][]).map(([label, d]) => (
              <div key={label} className="bg-ber-surface rounded-xl p-4 text-center">
                <p className="text-xs font-bold text-ber-gray mb-2">Em {label} dias</p>
                <p className="text-xl font-bold text-ber-carbon">{fmt(d.valor)}</p>
                <p className="text-xs text-ber-teal mt-1">Ponderado: {fmt(d.ponderado)}</p>
                <p className="text-xs text-ber-gray mt-0.5">{d.count} deal{d.count !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-ber-gray/60 mt-3">Valor bruto vs valor ponderado pela probabilidade (alta 80% / média 50% / baixa 20%)</p>
        </Section>
      )}

      {/* ── Origem dos Leads ─────────────────────────────────────── */}
      <Section title="Origem dos Leads">
        <div className="flex flex-col md:flex-row gap-6 items-center">
          <ResponsiveContainer width={220} height={220}>
            <PieChart>
              <Pie data={origemData} dataKey="value" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                {origemData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v, _n, p) => [`${Number(v)} leads — ${fmt((p as { payload: { valor: number } }).payload.valor)}`, String(_n)]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {origemData.map((o) => (
              <div
                key={o.name}
                className="flex items-center gap-2 cursor-pointer hover:bg-ber-surface rounded-lg px-2 py-1 -mx-2 transition-colors"
                onClick={() => openDrill(`Origem: ${o.name}`, oportunidades.filter((op) => (op.origem ?? 'sem_origem') === Object.entries(ORIGEM_LABELS).find(([, v]) => v === o.name)?.[0]))}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
                <span className="text-sm text-ber-carbon flex-1">{o.name}</span>
                <span className="text-sm font-bold text-ber-carbon">{o.value}</span>
                <span className="text-xs text-ber-gray w-24 text-right">{fmt(o.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Motivos de Perda ─────────────────────────────────────── */}
      {motivosPerda.length > 0 && (
        <Section title="Motivos de Perda" subtitle={String(ano)}>
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={motivosPerda} dataKey="count" cx="50%" cy="50%" outerRadius={85} innerRadius={45}>
                  {motivosPerda.map((_, i) => <Cell key={i} fill={MOTIVO_COLORS[i % MOTIVO_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${v} ocorrências`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {motivosPerda.map((m, i) => (
                <div
                  key={m.motivo}
                  className="flex items-center gap-2 cursor-pointer hover:bg-ber-surface rounded-lg px-2 py-1 -mx-2 transition-colors"
                  onClick={() => openDrill(`Perdidos: ${m.motivo}`, opsAno.filter((o) => o.etapa === 'perdido' && o.motivoPerda === m.motivo))}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: MOTIVO_COLORS[i % MOTIVO_COLORS.length] }} />
                  <span className="text-sm text-ber-carbon flex-1">{m.motivo}</span>
                  <span className="text-sm font-bold text-ber-carbon">{m.count}</span>
                  <span className="text-xs text-ber-gray w-24 text-right">{fmt(m.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* ── Performance por Responsável ──────────────────────────── */}
      {perfResponsavel.length > 0 && (
        <Section title="Performance por Responsável" subtitle={String(ano)}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-ber-border">
                  <th className="text-left py-2 pr-4 text-ber-gray font-semibold">Responsável</th>
                  <th className="text-center py-2 px-2 text-ber-gray font-semibold">Ganhos</th>
                  <th className="text-center py-2 px-2 text-ber-gray font-semibold">Perdidos</th>
                  <th className="text-center py-2 px-2 text-ber-gray font-semibold">Win Rate</th>
                  <th className="text-right py-2 pl-2 text-ber-gray font-semibold">Valor Ganho</th>
                  <th className="text-right py-2 pl-2 text-ber-gray font-semibold">Ticket Médio</th>
                </tr>
              </thead>
              <tbody>
                {perfResponsavel.map((r) => (
                  <tr key={r.name} className="border-b border-ber-border/40 hover:bg-ber-surface transition-colors">
                    <td className="py-2.5 pr-4 font-semibold text-ber-carbon">{r.name}</td>
                    <td className="py-2.5 px-2 text-center text-ber-green font-bold">{r.ganho}</td>
                    <td className="py-2.5 px-2 text-center text-ber-red">{r.perdido}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-ber-surface rounded-full h-1.5">
                          <div
                            className="h-full rounded-full bg-ber-green"
                            style={{ width: `${Math.round(r.winRate * 100)}%` }}
                          />
                        </div>
                        <span className="text-ber-carbon font-bold w-8 text-right">{Math.round(r.winRate * 100)}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 pl-2 text-right font-bold text-ber-carbon">{fmt(r.valorGanho)}</td>
                    <td className="py-2.5 pl-2 text-right text-ber-gray">{r.ticketMedio > 0 ? fmt(r.ticketMedio) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── Pipeline Mês a Mês ───────────────────────────────────── */}
      <Section title="Pipeline Mês a Mês" subtitle={String(ano)}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={pipeMesData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmt(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {allOrigens.map((o) => (
              <Bar key={o} dataKey={o} name={ORIGEM_LABELS[o] ?? o} stackId="a" fill={ORIGEM_COLORS[o] ?? '#868686'} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Section>

      {/* ── Win Rate por Segmento ───────────────────────────────── */}
      {winRateSegmento.length > 0 && (
        <Section title="Win Rate por Segmento" subtitle={String(ano)}>
          <div className="overflow-x-auto">
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
                  <tr key={s.segmento} className="border-b border-ber-border/40 hover:bg-ber-surface transition-colors cursor-pointer"
                    onClick={() => openDrill(`Segmento: ${s.segmento}`, opsAno.filter((o) => o.empresa?.segmento === s.segmento))}
                  >
                    <td className="py-2.5 pr-4 font-semibold text-ber-carbon">
                      <span className="w-2 h-2 rounded-full inline-block mr-2" style={{ backgroundColor: SEGMENTO_COLORS[i % SEGMENTO_COLORS.length] }} />
                      {s.segmento}
                    </td>
                    <td className="py-2.5 px-2 text-center text-ber-green font-bold">{s.ganho}</td>
                    <td className="py-2.5 px-2 text-center text-ber-red">{s.perdido}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-ber-surface rounded-full h-1.5">
                          <div
                            className="h-full rounded-full bg-ber-green"
                            style={{ width: `${Math.round(s.winRate * 100)}%` }}
                          />
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
        </Section>
      )}

      {/* ── Ticket Médio ─────────────────────────────────────────── */}
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

      {/* ── Ciclo de Vendas ──────────────────────────────────────── */}
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

      {/* ── Pipeline Aging ───────────────────────────────────────── */}
      {pipelineAging.length > 0 && (
        <Section title="Deals Frios" subtitle={`${pipelineAging.length} sem movimentação há +30 dias`}>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {pipelineAging.map((op) => {
              const calor = op.diasSemMovimento >= 90 ? 'bg-red-100 text-red-700' : op.diasSemMovimento >= 60 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700';
              return (
                <div key={op.id} className="flex items-center gap-3 py-2 px-3 bg-ber-surface rounded-lg hover:bg-ber-border/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-ber-carbon truncate">{op.titulo}</p>
                    <p className="text-[11px] text-ber-gray truncate">{op.empresa?.razaoSocial ?? '—'} · {op.responsavel?.name ?? '—'}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: ETAPA_COLORS[op.etapa] + '22', color: ETAPA_COLORS[op.etapa] }}>
                    {ETAPA_LABELS[op.etapa] ?? op.etapa}
                  </span>
                  <span className="text-xs font-bold text-ber-carbon shrink-0">{fmt(Number(op.valor ?? 0))}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${calor}`}>
                    {op.diasSemMovimento}d
                  </span>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Recorrência de Clientes ──────────────────────────────── */}
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
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-ber-gray uppercase tracking-wide mb-2">Top Clientes Recorrentes</p>
              {recorrencia.topRecorrentes.map((e, i) => (
                <div key={e.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-ber-surface transition-colors">
                  <span className="text-xs font-bold text-ber-gray w-4">{i + 1}</span>
                  <span className="text-xs font-semibold text-ber-carbon flex-1">{e.razaoSocial}</span>
                  <span className="text-xs text-ber-gray">{e.projetos} projetos</span>
                  <span className="text-xs font-bold text-ber-carbon">{fmt(e.valorTotal)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── Cohort de Entrada ────────────────────────────────────── */}
      <Section title="Cohort de Entrada" subtitle={`Deals criados em ${ano} — desfecho atual`}>
        <ResponsiveContainer width="100%" height={200}>
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
      </Section>
    </div>
  );
}
