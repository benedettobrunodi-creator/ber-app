'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, AreaChart, Area,
} from 'recharts';
import { TrendingUp, Target, DollarSign, Pencil, Check, X, ChevronRight } from 'lucide-react';
import { fmt, fmtDate, Oportunidade } from '../types';
import { ETAPA_MAP } from '../types';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const ETAPA_MACRO_MAP: Record<string, string[]> = {
  qualificacao: ['lead', 'qualificacao'],
  propostas: ['proposta_producao', 'proposta_enviada', 'negociacao'],
  conversao: ['ganho'],
};

function MetaInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      className="w-full border border-ber-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-ber-teal text-right"
      value={editing ? raw : (value ? BRL.format(value) : '')}
      placeholder="R$ 0,00"
      onFocus={() => { setRaw(value ? String(value) : ''); setEditing(true); setTimeout(() => ref.current?.select(), 0); }}
      onBlur={() => { onChange(Number(raw.replace(/\D/g, '')) || 0); setEditing(false); }}
      onChange={(e) => setRaw(e.target.value.replace(/[^0-9]/g, ''))}
    />
  );
}

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

interface VendasMes { mes: number; meta: number; realizado: number; metaAcum: number; realizadoAcum: number }

interface DrilldownState {
  label: string;
  items: Oportunidade[];
  cor?: string;
}

function DrilldownPanel({ state, onClose }: { state: DrilldownState; onClose: () => void }) {
  const total = state.items.reduce((s, o) => s + Number(o.valor ?? 0), 0);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ber-border">
          <div>
            <h3 className="font-bold text-ber-carbon">{state.label}</h3>
            <p className="text-xs text-ber-gray mt-0.5">
              {state.items.length} oportunidade{state.items.length !== 1 ? 's' : ''} · {fmt(total)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-ber-surface rounded-lg">
            <X size={16} className="text-ber-gray" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-ber-border">
          {state.items.length === 0 && (
            <div className="flex items-center justify-center h-32 text-ber-gray text-sm">Nenhuma oportunidade</div>
          )}
          {state.items.map((op) => {
            const etapa = ETAPA_MAP[op.etapa as keyof typeof ETAPA_MAP];
            return (
              <div key={op.id} className="px-5 py-3 hover:bg-ber-surface/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ber-carbon truncate">{op.titulo}</p>
                    {op.empresa && (
                      <p className="text-xs text-ber-gray truncate">{op.empresa.razaoSocial}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {etapa && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: etapa.color + '20', color: etapa.color }}
                        >
                          {etapa.label}
                        </span>
                      )}
                      {op.dataFechamentoPrevisto && (
                        <span className="text-[10px] text-ber-gray">{fmtDate(op.dataFechamentoPrevisto)}</span>
                      )}
                      {op.responsavel && (
                        <span className="text-[10px] text-ber-gray">{op.responsavel.name.split(' ')[0]}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-ber-carbon">{op.valor != null ? fmt(op.valor) : '--'}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TabFunil({ oportunidades }: { oportunidades: Oportunidade[] }) {
  const ano = new Date().getFullYear();
  const [funil, setFunil] = useState<FunilData | null>(null);
  const [forecast, setForecast] = useState<Record<number, ForecastMes>>({});
  const [vendas, setVendas] = useState<VendasMes[]>([]);
  const [editMetas, setEditMetas] = useState(false);
  const [metasEdit, setMetasEdit] = useState<number[]>(Array(12).fill(0));
  const [metaAnualInput, setMetaAnualInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/crm/stats/funil'),
      api.get(`/crm/stats/forecast/${ano}`),
      api.get(`/crm/stats/vendas-vs-meta/${ano}`),
      api.get(`/crm/metas/${ano}`),
    ]).then(([f, fc, v, m]) => {
      setFunil(f.data);
      setForecast(fc.data);
      setVendas(v.data);
      const vals = Array(12).fill(0);
      for (const row of m.data as MetaRow[]) vals[row.mes - 1] = Number(row.valorMeta);
      setMetasEdit(vals);
      if (vals.every((x) => x === 0)) setEditMetas(true);
    });
  }, [ano]);

  const distribuirAnual = () => {
    const total = Number(metaAnualInput.replace(/\D/g, ''));
    if (!total) return;
    const porMes = Math.round(total / 12);
    const novo = Array(12).fill(porMes);
    novo[11] = total - porMes * 11;
    setMetasEdit(novo);
  };

  const handleMetaChange = (i: number, value: number) => {
    setMetasEdit((prev) => {
      const anoTotal = prev.reduce((s, v) => s + v, 0);
      const novo = [...prev];
      novo[i] = value;
      const restanteMeses = 11 - i;
      if (restanteMeses > 0 && anoTotal > 0) {
        const somaAte = novo.slice(0, i + 1).reduce((s, v) => s + v, 0);
        const disponivelResto = anoTotal - somaAte;
        const porMes = Math.round(disponivelResto / restanteMeses);
        for (let j = i + 1; j < 12; j++) {
          novo[j] = j === 11
            ? Math.max(0, disponivelResto - porMes * (restanteMeses - 1))
            : Math.max(0, porMes);
        }
      }
      return novo;
    });
  };

  const totalMetasEdit = metasEdit.reduce((s, v) => s + v, 0);

  const saveMetas = async () => {
    setSaving(true);
    try {
      await api.put('/crm/metas', {
        ano,
        metas: metasEdit.map((v, i) => ({ mes: i + 1, valorMeta: v })).filter((m) => m.valorMeta > 0),
      });
      const res = await api.get(`/crm/stats/vendas-vs-meta/${ano}`);
      setVendas(res.data);
      setEditMetas(false);
    } finally {
      setSaving(false);
    }
  };

  const openDrilldown = (label: string, filter: (o: Oportunidade) => boolean, cor?: string) => {
    const items = oportunidades
      .filter(filter)
      .sort((a, b) => Number(b.valor ?? 0) - Number(a.valor ?? 0));
    setDrilldown({ label, items, cor });
  };

  const funilData = funil
    ? [
        { name: 'Qualificação', macro: 'qualificacao', count: funil.qualificacao.count, valor: funil.qualificacao.valor, color: '#5A7A7A' },
        { name: 'Propostas',    macro: 'propostas',    count: funil.propostas.count,    valor: funil.propostas.valor,    color: '#E6A23C' },
        { name: 'Conversão',    macro: 'conversao',    count: funil.conversao.count,    valor: funil.conversao.valor,    color: '#3D9E5F' },
      ]
    : [];

  const forecastData = MESES.map((m, i) => ({
    mes: m,
    esperado: forecast[i + 1]?.esperado ?? 0,
    ponderado: forecast[i + 1]?.ponderado ?? 0,
  }));

  const vendasData = vendas.map((v) => ({
    mes: MESES[v.mes - 1],
    meta: Number(v.metaAcum),
    realizado: Number(v.realizadoAcum),
  }));

  const totalRealizado = vendas.reduce((s, v) => s + Number(v.realizado), 0);
  const totalMeta = vendas.reduce((s, v) => s + Number(v.meta), 0);
  const taxaConversao = funil
    ? funil.conversao.count / Math.max(1, funil.qualificacao.count + funil.propostas.count + funil.conversao.count)
    : 0;

  return (
    <div className="space-y-6">
      {drilldown && <DrilldownPanel state={drilldown} onClose={() => setDrilldown(null)} />}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Target size={18} className="text-ber-teal" />}
          label="Em Pipeline"
          value={fmt(funil ? funil.qualificacao.valor + funil.propostas.valor : 0)}
          onClick={() => openDrilldown('Em Pipeline', (o) => !['ganho', 'perdido'].includes(o.etapa))}
        />
        <KpiCard
          icon={<DollarSign size={18} className="text-ber-green" />}
          label="Ganho no Ano"
          value={fmt(totalRealizado)}
          onClick={() => openDrilldown('Ganho no Ano', (o) => o.etapa === 'ganho')}
        />
        <KpiCard
          icon={<TrendingUp size={18} className="text-ber-olive" />}
          label="vs Meta"
          value={totalMeta > 0 ? `${Math.round((totalRealizado / totalMeta) * 100)}%` : '--'}
          sub={`de ${fmt(totalMeta)}`}
          onClick={() => openDrilldown('Ganhos vs Meta', (o) => o.etapa === 'ganho')}
        />
        <KpiCard
          icon={<Target size={18} className="text-purple-500" />}
          label="Conversão"
          value={`${Math.round(taxaConversao * 100)}%`}
          onClick={() => openDrilldown('Oportunidades Ganhas', (o) => o.etapa === 'ganho')}
        />
      </div>

      {/* Funil Macro */}
      <div className="bg-white border border-ber-border rounded-xl p-5">
        <h3 className="font-bold text-ber-carbon mb-4">Funil de Conversão</h3>
        <div className="flex gap-3 mb-4">
          {funilData.map((f, i) => (
            <button
              key={f.name}
              className="flex-1 text-center group cursor-pointer"
              onClick={() => openDrilldown(
                f.name,
                (o) => (ETAPA_MACRO_MAP[f.macro] ?? []).includes(o.etapa),
                f.color,
              )}
            >
              <div
                className="rounded-xl mx-auto flex items-end justify-center transition-all group-hover:opacity-80"
                style={{
                  backgroundColor: f.color + '20',
                  borderBottom: `3px solid ${f.color}`,
                  height: `${Math.max(40, 160 - i * 40)}px`,
                }}
              >
                <span className="text-lg font-bold" style={{ color: f.color }}>{f.count}</span>
              </div>
              <p className="text-xs font-semibold text-ber-carbon mt-2 flex items-center justify-center gap-1">
                {f.name}
                <ChevronRight size={10} className="text-ber-gray opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
              <p className="text-xs text-ber-gray">{fmt(f.valor)}</p>
            </button>
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
          {!editMetas && (
            <button onClick={() => setEditMetas(true)} className="flex items-center gap-1 text-xs text-ber-teal hover:underline">
              <Pencil size={12} /> Editar metas
            </button>
          )}
        </div>

        {editMetas && (
          <div className="mb-5 space-y-4">
            <div className="flex items-end gap-2 p-3 bg-ber-surface rounded-xl">
              <div className="flex-1">
                <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Meta anual {ano}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:border-ber-teal"
                  placeholder="Ex: 12000000"
                  value={metaAnualInput}
                  onChange={(e) => setMetaAnualInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && distribuirAnual()}
                />
              </div>
              <button
                onClick={distribuirAnual}
                className="px-3 py-2 bg-ber-teal text-white text-xs font-semibold rounded-lg hover:bg-ber-teal/80 whitespace-nowrap"
              >
                Distribuir igualmente
              </button>
            </div>

            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {metasEdit.map((v, i) => (
                <div key={i}>
                  <p className="text-[10px] font-semibold text-ber-gray mb-1">{MESES[i]}</p>
                  <MetaInput value={v} onChange={(n) => handleMetaChange(i, n)} />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-ber-gray">
                Total mensal: <span className="font-bold text-ber-carbon">{fmt(totalMetasEdit)}</span>
              </p>
              <div className="flex gap-2">
                <button onClick={() => setEditMetas(false)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-ber-gray border border-ber-border rounded-lg hover:bg-ber-surface">
                  <X size={12} /> Cancelar
                </button>
                <button onClick={saveMetas} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-ber-teal rounded-lg font-semibold hover:bg-ber-teal/80 disabled:opacity-50">
                  <Check size={12} /> {saving ? 'Salvando...' : 'Salvar metas'}
                </button>
              </div>
            </div>
          </div>
        )}

        {!editMetas && (
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

function KpiCard({
  icon, label, value, sub, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-ber-border rounded-xl p-4 text-left w-full hover:border-ber-teal/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-xs text-ber-gray uppercase tracking-wide">{label}</p>
        {onClick && <ChevronRight size={10} className="ml-auto text-ber-gray opacity-0 group-hover:opacity-100 transition-opacity" />}
      </div>
      <p className="text-xl font-bold text-ber-carbon">{value}</p>
      {sub && <p className="text-xs text-ber-gray mt-0.5">{sub}</p>}
    </button>
  );
}
