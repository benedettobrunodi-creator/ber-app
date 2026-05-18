'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, AreaChart, Area,
} from 'recharts';
import { TrendingUp, Target, DollarSign, Pencil, Check, X } from 'lucide-react';
import { fmt, Oportunidade } from '../types';
import DrilldownModal from './DrilldownModal';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface FunilData {
  qualificacao: { count: number; valor: number };
  propostas: { count: number; valor: number };
  conversao: { count: number; valor: number };
  perdido: { count: number; valor: number };
}

interface ForecastMes {
  esperado: number;
  ponderado: number;
}

interface MetaRow { ano: number; mes: number; valorMeta: number }

function calcRealizadoPorMes(oportunidades: Oportunidade[], ano: number): Record<number, number> {
  const por: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) por[m] = 0;
  for (const op of oportunidades) {
    if (op.etapa !== 'ganho' || !op.dataGanho) continue;
    const d = new Date(op.dataGanho);
    if (d.getFullYear() !== ano) continue;
    por[d.getMonth() + 1] += Number(op.valor ?? 0);
  }
  return por;
}

const TERMINAL = ['ganho', 'perdido', 'declinado', 'cancelado'];

export default function TabFunil({ oportunidades }: { oportunidades: Oportunidade[] }) {
  const ano = new Date().getFullYear();
  const [funil, setFunil] = useState<FunilData | null>(null);
  const [forecast, setForecast] = useState<Record<number, ForecastMes>>({});
  const [drill, setDrill] = useState<{ title: string; ops: Oportunidade[] } | null>(null);;
  const [metas, setMetas] = useState<MetaRow[]>([]);
  const [editMetas, setEditMetas] = useState(false);
  const [metasEdit, setMetasEdit] = useState<number[]>(Array(12).fill(0));

  useEffect(() => {
    Promise.all([
      api.get('/crm/stats/funil'),
      api.get(`/crm/stats/forecast/${ano}`),
      api.get(`/crm/metas/${ano}`),
    ]).then(([f, fc, m]) => {
      setFunil(f.data);
      setForecast(fc.data);
      setMetas(m.data);
      const vals = Array(12).fill(0);
      for (const row of m.data as MetaRow[]) vals[row.mes - 1] = Number(row.valorMeta);
      setMetasEdit(vals);
    });
  }, [ano]);

  const realizadoPorMes = calcRealizadoPorMes(oportunidades, ano);

  const saveMetas = async () => {
    await api.put('/crm/metas', {
      ano,
      metas: metasEdit.map((v, i) => ({ mes: i + 1, valorMeta: v })).filter((m) => m.valorMeta > 0),
    });
    setEditMetas(false);
  };

  const funilData = funil
    ? [
        { name: 'Qualificação', count: funil.qualificacao.count, valor: funil.qualificacao.valor },
        { name: 'Propostas',    count: funil.propostas.count,    valor: funil.propostas.valor },
        { name: 'Conversão',    count: funil.conversao.count,    valor: funil.conversao.valor },
      ]
    : [];

  const forecastData = MESES.map((m, i) => ({
    mes: m,
    esperado: forecast[i + 1]?.esperado ?? 0,
    ponderado: forecast[i + 1]?.ponderado ?? 0,
  }));

  let metaAcum = 0;
  let realizadoAcum = 0;
  const vendasData = MESES.map((mes, i) => {
    const m = i + 1;
    metaAcum += metasEdit[i] ?? 0;
    realizadoAcum += realizadoPorMes[m] ?? 0;
    return { mes, meta: metaAcum, realizado: realizadoAcum };
  });

  const totalRealizado = Object.values(realizadoPorMes).reduce((s, v) => s + v, 0);
  const totalMeta = metasEdit.reduce((s, v) => s + v, 0);
  const taxaConversao = funil
    ? funil.conversao.count / Math.max(1, funil.qualificacao.count + funil.propostas.count + funil.conversao.count)
    : 0;

  const openDrill = (title: string, ops: Oportunidade[]) => setDrill({ title, ops });

  return (
    <div className="space-y-6">
      {drill && <DrilldownModal title={drill.title} oportunidades={drill.ops} onClose={() => setDrill(null)} />}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Target size={18} className="text-ber-teal" />} label="Em Pipeline" value={fmt(funil ? funil.qualificacao.valor + funil.propostas.valor : 0)}
          onClick={() => openDrill('Em Pipeline', oportunidades.filter((o) => !TERMINAL.includes(o.etapa)))} />
        <KpiCard icon={<DollarSign size={18} className="text-ber-green" />} label="Ganho no Ano" value={fmt(totalRealizado)}
          onClick={() => openDrill('Ganho no Ano', oportunidades.filter((o) => o.etapa === 'ganho' && o.dataGanho && new Date(o.dataGanho).getFullYear() === ano))} />
        <KpiCard icon={<TrendingUp size={18} className="text-ber-olive" />} label="vs Meta" value={totalMeta > 0 ? `${Math.round((totalRealizado / totalMeta) * 100)}%` : '--'} sub={`de ${fmt(totalMeta)}`}
          onClick={() => openDrill('Ganho no Ano', oportunidades.filter((o) => o.etapa === 'ganho' && o.dataGanho && new Date(o.dataGanho).getFullYear() === ano))} />
        <KpiCard icon={<Target size={18} className="text-purple-500" />} label="Conversão" value={`${Math.round(taxaConversao * 100)}%`}
          onClick={() => openDrill('Todas as Oportunidades', oportunidades)} />
      </div>

      {/* Funil Macro */}
      <div className="bg-white border border-ber-border rounded-xl p-5">
        <h3 className="font-bold text-ber-carbon mb-4">Funil de Conversão</h3>
        <div className="flex gap-3 mb-4">
          {funilData.map((f, i) => {
            const bucketEtapas: Record<string, string[]> = {
              'Qualificação': ['lead', 'qualificacao'],
              'Propostas':    ['proposta_producao', 'proposta_enviada', 'negociacao'],
              'Conversão':    ['ganho'],
            };
            const etapas = bucketEtapas[f.name] ?? [];
            const cor = ['#5A7A7A', '#E6A23C', '#3D9E5F'][i];
            return (
            <div
              key={f.name}
              className="flex-1 text-center cursor-pointer group"
              onClick={() => openDrill(f.name, oportunidades.filter((o) => etapas.includes(o.etapa)))}
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
          ))}
        </div>
      </div>

      {/* Forecast */}
      <div className="bg-white border border-ber-border rounded-xl p-5">
        <h3 className="font-bold text-ber-carbon mb-4">Forecast {ano}</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={forecastData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmt(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="esperado" name="Esperado" fill="#5A7A7A" opacity={0.4} radius={[3, 3, 0, 0]} />
            <Bar dataKey="ponderado" name="Ponderado" fill="#5A7A7A" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Vendas vs Meta */}
      <div className="bg-white border border-ber-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-ber-carbon">Vendas vs Meta Acumulada {ano}</h3>
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
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={vendasData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => fmt(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="meta" name="Meta" stroke="#E8E8E4" fill="#E8E8E4" strokeWidth={2} strokeDasharray="5 5" />
              <Area type="monotone" dataKey="realizado" name="Realizado" stroke="#3D9E5F" fill="#3D9E5F20" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, onClick }: { icon: React.ReactNode; label: string; value: string; sub?: string; onClick?: () => void }) {
  return (
    <div
      className={`bg-white border border-ber-border rounded-xl p-4 ${onClick ? 'cursor-pointer hover:border-ber-teal transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">{icon}<p className="text-xs text-ber-gray uppercase tracking-wide">{label}</p></div>
      <p className="text-xl font-bold text-ber-carbon">{value}</p>
      {sub && <p className="text-xs text-ber-gray mt-0.5">{sub}</p>}
    </div>
  );
}
