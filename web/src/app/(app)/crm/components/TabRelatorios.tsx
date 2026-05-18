'use client';

import { useEffect, useState } from 'react';
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

export default function TabRelatorios({ oportunidades }: { oportunidades: Oportunidade[] }) {
  const ano = new Date().getFullYear();
  const [drill, setDrill] = useState<{ title: string; ops: Oportunidade[] } | null>(null);
  const [pipelineStats, setPipelineStats] = useState<{
    porOrigem: Record<string, { count: number; valor: number }>;
  } | null>(null);
  const [pipeMes, setPipeMes] = useState<Record<number, Record<string, number>>>({});
  const [ticketMedio, setTicketMedio] = useState<{ geral: number; porOrigem: Record<string, number> } | null>(null);
  const [winRate, setWinRate] = useState<{ ganho: number; perdido: number; total: number; rate: number } | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/crm/stats/pipeline'),
      api.get(`/crm/stats/pipeline-mes-a-mes/${ano}`),
      api.get('/crm/stats/ticket-medio'),
      api.get('/crm/stats/win-rate'),
    ]).then(([ps, pm, tm, wr]) => {
      setPipelineStats(ps.data);
      setPipeMes(pm.data);
      setTicketMedio(tm.data);
      setWinRate(wr.data);
    });
  }, [ano]);

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

  const openDrill = (title: string, ops: Oportunidade[]) => setDrill({ title, ops });

  return (
    <div className="space-y-6">
      {drill && <DrilldownModal title={drill.title} oportunidades={drill.ops} onClose={() => setDrill(null)} />}

      {/* Win Rate */}
      {winRate && (
        <div className="bg-white border border-ber-border rounded-xl p-5">
          <h3 className="font-bold text-ber-carbon mb-4">Win Rate</h3>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-ber-green">{Math.round(winRate.rate * 100)}%</p>
              <p className="text-xs text-ber-gray mt-1">Taxa de Conversão</p>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-3">
              <div
                className="text-center bg-ber-surface rounded-xl p-3 cursor-pointer hover:ring-1 hover:ring-ber-green transition-all"
                onClick={() => openDrill('Ganhos', oportunidades.filter((o) => o.etapa === 'ganho'))}
              >
                <p className="text-2xl font-bold text-ber-green">{winRate.ganho}</p>
                <p className="text-xs text-ber-gray">Ganhos</p>
              </div>
              <div
                className="text-center bg-ber-surface rounded-xl p-3 cursor-pointer hover:ring-1 hover:ring-ber-red transition-all"
                onClick={() => openDrill('Perdidos / Declinados / Cancelados', oportunidades.filter((o) => ['perdido', 'declinado', 'cancelado'].includes(o.etapa)))}
              >
                <p className="text-2xl font-bold text-ber-red">{winRate.perdido}</p>
                <p className="text-xs text-ber-gray">Perdidos</p>
              </div>
              <div
                className="text-center bg-ber-surface rounded-xl p-3 cursor-pointer hover:ring-1 hover:ring-ber-border transition-all"
                onClick={() => openDrill('Ganhos + Perdidos', oportunidades.filter((o) => ['ganho', 'perdido', 'declinado', 'cancelado'].includes(o.etapa)))}
              >
                <p className="text-2xl font-bold text-ber-carbon">{winRate.total}</p>
                <p className="text-xs text-ber-gray">Total</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Origem dos Leads */}
      <div className="bg-white border border-ber-border rounded-xl p-5">
        <h3 className="font-bold text-ber-carbon mb-4">Origem dos Leads</h3>
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
      </div>

      {/* Pipeline mês a mês */}
      <div className="bg-white border border-ber-border rounded-xl p-5">
        <h3 className="font-bold text-ber-carbon mb-4">Pipeline Mês a Mês — {ano}</h3>
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
      </div>

      {/* Ticket Médio */}
      {ticketMedio && (
        <div className="bg-white border border-ber-border rounded-xl p-5">
          <div className="flex items-center gap-4 mb-4">
            <h3 className="font-bold text-ber-carbon">Ticket Médio</h3>
            <span className="text-2xl font-bold text-ber-teal">{fmt(ticketMedio.geral)}</span>
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
        </div>
      )}
    </div>
  );
}
