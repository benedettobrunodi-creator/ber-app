'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, TrendingDown, TrendingUp, AlertTriangle, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

interface ObraIndicadores {
  totalVendaBruta: number;
  totalVenda: number;
  totalMeta: number;
  totalComprado: number;
  totalItens: number;
  itensComprados: number;
  itensPendentes: number;
  itensComCompradoLancado: number;
  okVenda: number;
  okSaving: number;
  okSavingPct: number;
  okSavingMeta: number;
  okSavingMetaPct: number;
  pendVenda: number;
  pendMeta: number;
  potencialSaving: number;
  projecaoSaving: number | null;
  projecaoPct: number | null;
  comissao: number;
  pctComissao: number;
}

interface ObraSummary {
  obraId: string;
  obraName: string;
  obraStatus: string;
  indicadores: ObraIndicadores;
}

interface TotaisConsolidados {
  totalVendaBruta: number;
  totalVenda: number;
  totalMeta: number;
  totalComprado: number;
  totalItens: number;
  itensComprados: number;
  itensPendentes: number;
  okSaving: number;
  okSavingPct: number;
  okSavingMeta: number;
  okSavingMetaPct: number;
  pendVenda: number;
  pendMeta: number;
  potencialSaving: number;
  projecaoSaving: number;
}

interface SummaryResponse {
  data: {
    obras: ObraSummary[];
    totais: TotaisConsolidados;
  };
}

const STATUSES = [
  { value: '', label: 'Todas' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'planejamento', label: 'Planejamento' },
  { value: 'pausada', label: 'Pausadas' },
  { value: 'concluida', label: 'Concluídas' },
];

const STATUS_LABEL: Record<string, string> = {
  em_andamento: 'Em andamento',
  planejamento: 'Planejamento',
  pausada: 'Pausada',
  concluida: 'Concluída',
};

const STATUS_BADGE: Record<string, string> = {
  em_andamento: 'bg-green-100 text-green-700',
  planejamento: 'bg-blue-100 text-blue-700',
  pausada: 'bg-amber-100 text-amber-700',
  concluida: 'bg-gray-200 text-gray-700',
};

const SORTS = [
  { value: 'name', label: 'Nome' },
  { value: 'savingPct', label: 'Saving %' },
  { value: 'compradoPct', label: '% Comprado' },
  { value: 'aComprar', label: 'A Comprar (R$)' },
] as const;
type SortKey = (typeof SORTS)[number]['value'];

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export default function ComprasGlobalPage() {
  const [data, setData] = useState<SummaryResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('savingPct');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    api.get<SummaryResponse>(`/compras-dashboard/summary${qs}`)
      .then(r => { if (!cancelled) { setData(r.data.data); setError(null); } })
      .catch(err => {
        if (cancelled) return;
        const msg = err?.response?.data?.error?.message || 'Erro ao carregar dashboard';
        setError(msg);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [status]);

  const sortedObras = useMemo(() => {
    if (!data) return [];
    const arr = [...data.obras];
    arr.sort((a, b) => {
      const ai = a.indicadores, bi = b.indicadores;
      switch (sortBy) {
        case 'name':
          return a.obraName.localeCompare(b.obraName, 'pt-BR');
        case 'savingPct':
          return bi.okSavingPct - ai.okSavingPct;
        case 'compradoPct': {
          const aPct = ai.totalItens > 0 ? ai.itensComprados / ai.totalItens : 0;
          const bPct = bi.totalItens > 0 ? bi.itensComprados / bi.totalItens : 0;
          return bPct - aPct;
        }
        case 'aComprar':
          return bi.pendVenda - ai.pendVenda;
      }
    });
    return arr;
  }, [data, sortBy]);

  if (loading) {
    return <div className="p-6 text-center text-sm text-ber-gray">Carregando painel consolidado…</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (!data) return null;
  const { totais } = data;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ShoppingCart size={20} className="text-ber-teal" />
          <h1 className="text-xl font-black text-ber-carbon">Metas de Compra · Consolidado</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-ber-gray uppercase tracking-wide">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="rounded-lg border border-ber-gray/30 px-2 py-1.5 text-sm focus:border-ber-teal focus:outline-none"
            >
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-ber-gray uppercase tracking-wide">Ordenar por</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortKey)}
              className="rounded-lg border border-ber-gray/30 px-2 py-1.5 text-sm focus:border-ber-teal focus:outline-none"
            >
              {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Cards de KPI */}
      <div className="mb-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {/* Comprado */}
          <div className="rounded-xl bg-white border border-ber-gray/15 p-5 shadow-sm">
            <p className="text-xs font-medium text-ber-gray uppercase tracking-wide">Comprado</p>
            <p className="mt-2 text-2xl font-black text-ber-carbon">
              {totais.itensComprados}<span className="text-base font-semibold text-ber-gray"> de {totais.totalItens} itens</span>
            </p>
            <p className="mt-2 text-lg font-bold text-ber-carbon">{fmtBRL(totais.totalComprado)}</p>
            <p className="text-xs text-ber-gray">de {fmtBRL(totais.totalVenda)} vendido</p>
          </div>

          {/* Saving / Vendido */}
          <div className={`rounded-xl p-5 shadow-sm border ${totais.okSaving >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
            <p className={`text-xs font-medium uppercase tracking-wide ${totais.okSaving >= 0 ? 'text-green-700' : 'text-red-600'}`}>Saving / Vendido</p>
            <p className={`mt-2 text-2xl font-black ${totais.okSaving >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtBRL(totais.okSaving)}</p>
            <p className={`mt-1 text-3xl font-black ${totais.okSaving >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtPct(totais.okSavingPct)}</p>
            <p className="mt-1 text-xs text-ber-gray">consolidado de todas obras</p>
          </div>

          {/* Saving / Meta */}
          <div className={`rounded-xl p-5 shadow-sm border ${totais.okSavingMeta >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
            <p className={`text-xs font-medium uppercase tracking-wide ${totais.okSavingMeta >= 0 ? 'text-green-700' : 'text-red-600'}`}>Saving / Meta</p>
            <p className={`mt-2 text-2xl font-black ${totais.okSavingMeta >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtBRL(totais.okSavingMeta)}</p>
            <p className={`mt-1 text-3xl font-black ${totais.okSavingMeta >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtPct(totais.okSavingMetaPct)}</p>
            <p className="mt-1 text-xs text-ber-gray">{totais.okSavingMeta >= 0 ? 'dentro da meta' : '⚠ acima da meta'}</p>
          </div>

          {/* Projeção */}
          <div className="rounded-xl p-5 shadow-sm border bg-ber-teal/5 border-ber-teal/30">
            <p className="text-xs font-medium uppercase tracking-wide text-ber-teal">📈 Projeção</p>
            <p className="mt-2 text-2xl font-black text-ber-teal">{fmtBRL(totais.projecaoSaving)}</p>
            <p className="mt-1 text-xs text-ber-gray">saving final estimado · soma das obras com ≥10% comprado</p>
          </div>
        </div>

        {/* Linha de referência */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg bg-white border border-ber-gray/10 p-3">
            <p className="text-[10px] font-medium text-ber-gray uppercase tracking-wide">Total Venda</p>
            <p className="mt-0.5 text-sm font-bold text-ber-carbon">{fmtBRL(totais.totalVendaBruta)}</p>
          </div>
          <div className="rounded-lg bg-white border border-ber-gray/10 p-3">
            <p className="text-[10px] font-medium text-ber-gray uppercase tracking-wide">Total Meta</p>
            <p className="mt-0.5 text-sm font-bold text-ber-carbon">{fmtBRL(totais.totalMeta)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
            <p className="text-[10px] font-medium text-amber-700 uppercase tracking-wide">🛒 A Comprar</p>
            <p className="mt-0.5 text-sm font-bold text-amber-700">{totais.itensPendentes} itens · {fmtBRL(totais.pendVenda)}</p>
            <p className="text-[10px] text-amber-700/80">meta {fmtBRL(totais.pendMeta)}</p>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
            <p className="text-[10px] font-medium text-amber-700 uppercase tracking-wide">Potencial Saving</p>
            <p className="mt-0.5 text-sm font-bold text-amber-700">{fmtBRL(totais.potencialSaving)}</p>
            <p className="text-[10px] text-amber-700/80">se bater a meta no restante</p>
          </div>
        </div>
      </div>

      {/* Tabela por obra */}
      {sortedObras.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-16 text-center">
          <ShoppingCart size={32} className="mx-auto mb-3 text-ber-gray/40" />
          <p className="text-sm font-medium text-ber-gray">Nenhuma obra encontrada</p>
          <p className="mt-1 text-xs text-ber-gray/60">Ajuste o filtro de status</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ber-gray/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-ber-carbon text-xs text-white">
              <tr>
                <th className="px-3 py-3 text-left">Obra</th>
                <th className="px-3 py-3 text-center">Status</th>
                <th className="px-3 py-3 text-right">Venda</th>
                <th className="px-3 py-3 text-right">Comprado</th>
                <th className="px-3 py-3 text-center">% Itens</th>
                <th className="px-3 py-3 text-right">Saving / Vend.</th>
                <th className="px-3 py-3 text-right">Saving / Meta</th>
                <th className="px-3 py-3 text-right">A Comprar</th>
                <th className="px-3 py-3 text-right">Projeção</th>
                <th className="px-3 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {sortedObras.map(o => {
                const i = o.indicadores;
                const pctItens = i.totalItens > 0 ? (i.itensComprados / i.totalItens) * 100 : 0;
                const savingNeg = i.okSavingMeta < 0;
                return (
                  <tr key={o.obraId} className="border-t border-ber-gray/10 hover:bg-ber-bg/40">
                    <td className="px-3 py-2.5 font-medium text-ber-carbon">
                      <Link href={`/obras/${o.obraId}/compras`} className="hover:text-ber-teal">
                        {o.obraName}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[o.obraStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[o.obraStatus] ?? o.obraStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtBRL(i.totalVenda)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtBRL(i.totalComprado)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-ber-gray">{fmtPct(pctItens)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${i.okSaving >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      <span className="inline-flex items-center gap-1">
                        {i.okSaving >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {fmtPct(i.okSavingPct)}
                      </span>
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${savingNeg ? 'text-red-600' : 'text-green-700'}`}>
                      <span className="inline-flex items-center gap-1">
                        {savingNeg && <AlertTriangle size={12} />}
                        {fmtPct(i.okSavingMetaPct)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <span className="text-amber-700">{i.itensPendentes} · {fmtBRL(i.pendVenda)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {i.projecaoSaving !== null ? (
                        <span className="text-ber-teal">{fmtBRL(i.projecaoSaving)}</span>
                      ) : (
                        <span className="text-ber-gray/40">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link href={`/obras/${o.obraId}/compras`} className="text-ber-gray hover:text-ber-teal">
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
