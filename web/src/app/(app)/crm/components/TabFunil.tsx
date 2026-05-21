'use client';

import { useEffect, useState, type ReactNode } from 'react';
import api from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, AreaChart, Area, ComposedChart, Line,
} from 'recharts';
import { TrendingUp, Target, DollarSign, Pencil, Check, X, Layers } from 'lucide-react';
import { fmt, Oportunidade } from '../types';
import DrilldownModal from './DrilldownModal';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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

interface FunilData {
  qualificacao: { count: number; valor: number };
  propostas:    { count: number; valor: number };
  conversao:    { count: number; valor: number };
  perdido:      { count: number; valor: number };
}

interface MetaRow { ano: number; mes: number; valorMeta: number }
interface VendasMes { mes: number; meta: number; realizado: number; metaAcum: number; realizadoAcum: number }

const TERMINAL = ['ganho', 'perdido', 'declinado', 'cancelado'];

export default function TabFunil({ oportunidades }: { oportunidades: Oportunidade[] }) {
  const ano = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1; // 1-12

  const [funil, setFunil] = useState<FunilData | null>(null);
  const [vendas, setVendas] = useState<VendasMes[]>([]);
  const [drill, setDrill] = useState<{ title: string; ops: Oportunidade[] } | null>(null);
  const [metas, setMetas] = useState<MetaRow[]>([]);
  const [editMetas, setEditMetas] = useState(false);
  const [metasEdit, setMetasEdit] = useState<number[]>(Array(12).fill(0));
  const [funilConversao, setFunilConversao] = useState<{ etapa: string; count: number; valor: number }[]>([]);
  const [forecastH, setForecastH] = useState<{
    d30: { valor: number; ponderado: number; count: number };
    d60: { valor: number; ponderado: number; count: number };
    d90: { valor: number; ponderado: number; count: number };
  } | null>(null);
  const [pipelineAging, setPipelineAging] = useState<{
    id: string; titulo: string; valor: unknown; etapa: string; updatedAt: string;
    diasSemMovimento: number; empresa: { razaoSocial: string } | null;
    responsavel: { name: string } | null;
  }[]>([]);
  const [pipelineAtivo, setPipelineAtivo] = useState<Record<number, number>>({});

  useEffect(() => {
    Promise.all([
      api.get('/crm/stats/funil'),
      api.get(`/crm/stats/vendas-vs-meta/${ano}`),
      api.get(`/crm/metas/${ano}`),
      api.get(`/crm/stats/funil-conversao?ano=${ano}`),
      api.get('/crm/stats/forecast-horizonte'),
      api.get('/crm/stats/pipeline-aging'),
      api.get(`/crm/stats/pipeline-ativo-acumulado?ano=${ano}`),
    ]).then(([f, v, m, fc, fh, pa, paa]) => {
      setFunil(f.data);
      setVendas(v.data);
      setMetas(m.data);
      const vals = Array(12).fill(0);
      for (const row of m.data as MetaRow[]) vals[row.mes - 1] = Number(row.valorMeta);
      setMetasEdit(vals);
      setFunilConversao(fc.data);
      setForecastH(fh.data);
      setPipelineAging(pa.data);
      setPipelineAtivo(paa.data);
    });
  }, [ano]);

  const saveMetas = async () => {
    await api.put('/crm/metas', {
      ano,
      metas: metasEdit.map((v, i) => ({ mes: i + 1, valorMeta: v })).filter((m) => m.valorMeta > 0),
    });
    const [v2, paa2] = await Promise.all([
      api.get(`/crm/stats/vendas-vs-meta/${ano}`),
      api.get(`/crm/stats/pipeline-ativo-acumulado?ano=${ano}`),
    ]);
    setVendas(v2.data);
    setPipelineAtivo(paa2.data);
    setEditMetas(false);
  };

  // Dados derivados
  const totalRealizado = vendas.reduce((s, v) => s + Number(v.realizado), 0);
  const totalMeta = vendas.reduce((s, v) => s + Number(v.meta), 0);
  const metaRestante = Math.max(0, totalMeta - totalRealizado);

  const pipelineAtivoAtual = pipelineAtivo[mesAtual] ?? 0;
  const coverageRatio = metaRestante > 0 ? pipelineAtivoAtual / metaRestante : null;

  const taxaConversao = funil
    ? funil.conversao.count / Math.max(1, funil.qualificacao.count + funil.propostas.count + funil.conversao.count)
    : 0;

  const openDrill = (title: string, ops: Oportunidade[]) => setDrill({ title, ops });

  // Gráfico pipeline ativo acumulado + meta + realizado acumulado
  const pipelineVsMetaData = MESES.map((m, i) => {
    const mesIdx = i + 1;
    const vRow = vendas.find((v) => v.mes === mesIdx);
    const metaAcum = vRow ? Number(vRow.metaAcum) : 0;
    const realizadoAcum = vRow ? Number(vRow.realizadoAcum) : 0;
    return {
      mes: m,
      pipeline: pipelineAtivo[mesIdx] ?? 0,
      meta: metaAcum,
      realizado: realizadoAcum,
    };
  });

  // Funil de conversão por etapa (excluindo terminais para as barras)
  const funilAtivo = funilConversao.filter((f) => !TERMINAL.includes(f.etapa));
  const funilMax = Math.max(...funilAtivo.map((f) => f.count), 1);

  return (
    <div className="space-y-6">
      {drill && <DrilldownModal title={drill.title} oportunidades={drill.ops} onClose={() => setDrill(null)} />}

      {/* ── KPIs ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Target size={18} className="text-ber-teal" />}
          label="Pipeline Ativo"
          value={fmt(pipelineAtivoAtual)}
          sub={`${MESES[mesAtual - 1]} ${ano}`}
          onClick={() => openDrill('Em Pipeline', oportunidades.filter((o) => !TERMINAL.includes(o.etapa)))}
        />
        <KpiCard
          icon={<DollarSign size={18} className="text-ber-green" />}
          label="Ganho no Ano"
          value={fmt(totalRealizado)}
          sub={totalMeta > 0 ? `${Math.round((totalRealizado / totalMeta) * 100)}% da meta` : undefined}
          onClick={() => openDrill('Ganho no Ano', oportunidades.filter((o) => o.etapa === 'ganho'))}
        />
        <KpiCard
          icon={<TrendingUp size={18} className="text-ber-olive" />}
          label="Cobertura do Pipeline"
          value={coverageRatio !== null ? `${coverageRatio.toFixed(1)}x` : '--'}
          sub="pipeline ÷ meta restante"
          highlight={coverageRatio !== null ? (coverageRatio >= 3 ? 'green' : coverageRatio >= 1.5 ? 'yellow' : 'red') : undefined}
        />
        <KpiCard
          icon={<Layers size={18} className="text-purple-500" />}
          label="Conversão"
          value={`${Math.round(taxaConversao * 100)}%`}
          onClick={() => openDrill('Todas as Oportunidades', oportunidades)}
        />
      </div>

      {/* ── Pipeline Ativo + Meta + Realizado ────────────────────── */}
      <div className="bg-white border border-ber-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-ber-carbon">Pipeline Ativo vs Meta vs Realizado — {ano}</h3>
            <p className="text-xs text-ber-gray mt-0.5">Pipeline = valor em aberto acumulado ao fim de cada mês</p>
          </div>
          {!editMetas ? (
            <button onClick={() => setEditMetas(true)} className="flex items-center gap-1 text-xs text-ber-teal hover:underline">
              <Pencil size={12} /> Editar metas
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={saveMetas} className="flex items-center gap-1 text-xs text-ber-green font-semibold"><Check size={12} /> Salvar</button>
              <button onClick={() => setEditMetas(false)} className="flex items-center gap-1 text-xs text-ber-red"><X size={12} /> Cancelar</button>
            </div>
          )}
        </div>
        {editMetas ? (
          <div className="grid grid-cols-6 gap-2 mb-4">
            {metasEdit.map((v, i) => (
              <div key={i}>
                <p className="text-[10px] text-ber-gray mb-1">{MESES[i]}</p>
                <input
                  type="number"
                  className="w-full border border-ber-border rounded px-2 py-1 text-xs focus:outline-none focus:border-ber-teal"
                  value={v || ''}
                  onChange={(e) => setMetasEdit((prev) => { const n = [...prev]; n[i] = Number(e.target.value); return n; })}
                />
              </div>
            ))}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={pipelineVsMetaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmt(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="pipeline" name="Pipeline Ativo" fill="#5A7A7A" opacity={0.35} radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="meta" name="Meta Acum." stroke="#E8E8E4" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              <Line type="monotone" dataKey="realizado" name="Realizado Acum." stroke="#3D9E5F" strokeWidth={2.5} dot={{ fill: '#3D9E5F', r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
        {/* Linha de cobertura abaixo */}
        {!editMetas && coverageRatio !== null && (
          <div className="mt-3 flex items-center gap-2 text-xs text-ber-gray border-t border-ber-border pt-3">
            <span className={`font-bold ${coverageRatio >= 3 ? 'text-ber-green' : coverageRatio >= 1.5 ? 'text-yellow-600' : 'text-ber-red'}`}>
              {coverageRatio.toFixed(1)}x cobertura
            </span>
            <span>· Pipeline ativo ({fmt(pipelineAtivoAtual)}) ÷ meta restante ({fmt(metaRestante)})</span>
            <span className="ml-auto text-ber-gray/60">Benchmark: 3–5×</span>
          </div>
        )}
      </div>

      {/* ── Forecast 30 / 60 / 90 dias ──────────────────────────── */}
      {forecastH && (
        <div className="bg-white border border-ber-border rounded-xl p-5">
          <h3 className="font-bold text-ber-carbon mb-4">Forecast de Fechamento — Próximos 30 / 60 / 90 dias</h3>
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
        </div>
      )}

      {/* ── Funil por Etapa ──────────────────────────────────────── */}
      {funilAtivo.length > 0 && (
        <div className="bg-white border border-ber-border rounded-xl p-5">
          <h3 className="font-bold text-ber-carbon mb-4">Funil de Conversão por Etapa — {ano}</h3>
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
          {/* Terminais */}
          {funilConversao.filter((f) => TERMINAL.includes(f.etapa)).some((f) => f.count > 0) && (
            <div className="mt-4 flex gap-4 border-t border-ber-border pt-4">
              {funilConversao.filter((f) => TERMINAL.includes(f.etapa) && f.count > 0).map((f) => (
                <div key={f.etapa} className="text-center">
                  <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ backgroundColor: ETAPA_COLORS[f.etapa] }} />
                  <span className="text-xs text-ber-gray">{ETAPA_LABELS[f.etapa]}: </span>
                  <span className="text-xs font-bold text-ber-carbon">{f.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Funil Macro (Qualificação → Propostas → Conversão) ───── */}
      {funil && (
        <div className="bg-white border border-ber-border rounded-xl p-5">
          <h3 className="font-bold text-ber-carbon mb-4">Funil Macro</h3>
          <div className="flex gap-3 mb-4">
            {[
              { name: 'Qualificação', count: funil.qualificacao.count, valor: funil.qualificacao.valor, etapas: ['lead', 'qualificacao'] },
              { name: 'Propostas',    count: funil.propostas.count,    valor: funil.propostas.valor,    etapas: ['proposta_producao', 'proposta_enviada', 'negociacao'] },
              { name: 'Conversão',    count: funil.conversao.count,    valor: funil.conversao.valor,    etapas: ['ganho'] },
            ].map((f, i) => {
              const cor = ['#5A7A7A', '#E6A23C', '#3D9E5F'][i];
              return (
                <div
                  key={f.name}
                  className="flex-1 text-center cursor-pointer group"
                  onClick={() => openDrill(f.name, oportunidades.filter((o) => f.etapas.includes(o.etapa)))}
                >
                  <div
                    className="rounded-xl mx-auto flex items-end justify-center transition-all group-hover:opacity-80"
                    style={{
                      backgroundColor: cor + '20',
                      borderBottom: `3px solid ${cor}`,
                      height: `${Math.max(40, 160 - i * 40)}px`,
                    }}
                  >
                    <span className="text-lg font-bold" style={{ color: cor }}>{f.count}</span>
                  </div>
                  <p className="text-xs font-semibold text-ber-carbon mt-2">{f.name}</p>
                  <p className="text-xs text-ber-gray">{fmt(f.valor)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Deals Frios ──────────────────────────────────────────── */}
      {pipelineAging.length > 0 && (
        <div className="bg-white border border-ber-border rounded-xl p-5">
          <h3 className="font-bold text-ber-carbon mb-4">
            Deals Frios
            <span className="ml-2 text-xs font-normal text-ber-gray">({pipelineAging.length} sem movimentação há +30 dias)</span>
          </h3>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {pipelineAging.map((op) => {
              const calor = op.diasSemMovimento >= 90
                ? 'bg-red-100 text-red-700'
                : op.diasSemMovimento >= 60
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-yellow-100 text-yellow-700';
              return (
                <div key={op.id} className="flex items-center gap-3 py-2 px-3 bg-ber-surface rounded-lg hover:bg-ber-border/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-ber-carbon truncate">{op.titulo}</p>
                    <p className="text-[11px] text-ber-gray truncate">{op.empresa?.razaoSocial ?? '—'} · {op.responsavel?.name ?? '—'}</p>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: ETAPA_COLORS[op.etapa] + '22', color: ETAPA_COLORS[op.etapa] }}
                  >
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
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon, label, value, sub, onClick, highlight,
}: {
  icon: ReactNode; label: string; value: string; sub?: string; onClick?: () => void; highlight?: 'green' | 'yellow' | 'red';
}) {
  const hlColor = highlight === 'green' ? 'text-ber-green' : highlight === 'yellow' ? 'text-yellow-600' : highlight === 'red' ? 'text-ber-red' : 'text-ber-carbon';
  return (
    <div
      className={`bg-white border border-ber-border rounded-xl p-4 ${onClick ? 'cursor-pointer hover:border-ber-teal transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">{icon}<p className="text-xs text-ber-gray uppercase tracking-wide">{label}</p></div>
      <p className={`text-xl font-bold ${hlColor}`}>{value}</p>
      {sub && <p className="text-xs text-ber-gray mt-0.5">{sub}</p>}
    </div>
  );
}
