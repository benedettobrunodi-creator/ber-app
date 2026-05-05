'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { TrendingUp, DollarSign, Award, Filter } from 'lucide-react';

interface Proposal {
  id: string;
  clientName: string;
  title: string;
  value: number | null;
  status: string;
  sentDate: string | null;
  closedDate: string | null;
  notes: string | null;
  agendorWebUrl: string | null;
  creator: { id: string; name: string } | null;
  updatedAt: string;
}

interface Stats {
  pipeline: Record<string, number>;
  total: number;
  totalValue: number | null;
  wonValue: number | null;
  conversionRate: string;
  thisMonth: number;
}

const STATUS_LABELS: Record<string, string> = {
  leads_info:       'Leads (Info)',
  leads_aguardando: 'Leads (Aguardando)',
  contato:          'Contato',
  analise:          'Análise',
  go_aguardando:    'GO Aguardando',
  proposta_dev:     'Em Desenvolvimento',
  enviada_alta:     'Enviada — Alta',
  enviada_media:    'Enviada — Média',
  enviada_baixa:    'Enviada — Baixa',
  ganha:            'Ganha',
  perdida:          'Perdida',
};

const STATUS_COLORS: Record<string, string> = {
  leads_info:       'bg-gray-100 text-gray-600',
  leads_aguardando: 'bg-gray-100 text-gray-600',
  contato:          'bg-blue-100 text-blue-700',
  analise:          'bg-blue-100 text-blue-700',
  go_aguardando:    'bg-amber-100 text-amber-700',
  proposta_dev:     'bg-amber-100 text-amber-700',
  enviada_alta:     'bg-orange-100 text-orange-700',
  enviada_media:    'bg-orange-100 text-orange-700',
  enviada_baixa:    'bg-orange-100 text-orange-700',
  ganha:            'bg-emerald-100 text-emerald-700',
  perdida:          'bg-red-100 text-red-600',
};

const FILTER_GROUPS = [
  { label: 'Todos', value: '' },
  { label: 'Leads', value: 'leads_info' },
  { label: 'Contato', value: 'contato' },
  { label: 'Análise', value: 'analise' },
  { label: 'Em Dev', value: 'proposta_dev' },
  { label: 'Enviadas', value: 'enviada_alta' },
  { label: 'Ganhas', value: 'ganha' },
  { label: 'Perdidas', value: 'perdida' },
];

function fmtCurrency(value: number | null | undefined) {
  if (value == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function OrcamentosPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const params = statusFilter ? `?status=${statusFilter}` : '';
    Promise.all([
      api.get(`/proposals${params}`),
      api.get('/proposals/stats'),
    ]).then(([pRes, sRes]) => {
      const raw = pRes.data?.data ?? pRes.data?.proposals ?? [];
      setProposals(Array.isArray(raw) ? raw : []);
      setStats(sRes.data?.data ?? null);
    }).finally(() => setLoading(false));
  }, [statusFilter]);

  const displayed = statusFilter
    ? proposals
    : proposals;

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-[var(--ber-carbon-light)]">
      <div className="w-5 h-5 border-2 border-[var(--ber-olive)] border-t-transparent rounded-full animate-spin" />
      Carregando...
    </div>
  );

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--ber-carbon)]">Esteira de Orçamentos</h1>
        <p className="text-sm text-[var(--ber-carbon-light)] mt-1">
          {stats?.total ?? 0} propostas · taxa de conversão {stats?.conversionRate ?? 0}%
        </p>
      </div>

      {/* KPI cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-[var(--ber-border)] p-4">
            <div className="flex items-center gap-2 text-[var(--ber-carbon-light)] text-xs font-semibold uppercase tracking-wide mb-1">
              <TrendingUp size={14} />
              Pipeline total
            </div>
            <p className="text-xl font-bold text-[var(--ber-carbon)]">{fmtCurrency(stats.totalValue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-[var(--ber-border)] p-4">
            <div className="flex items-center gap-2 text-[var(--ber-carbon-light)] text-xs font-semibold uppercase tracking-wide mb-1">
              <Award size={14} />
              Ganho
            </div>
            <p className="text-xl font-bold text-emerald-600">{fmtCurrency(stats.wonValue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-[var(--ber-border)] p-4 col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 text-[var(--ber-carbon-light)] text-xs font-semibold uppercase tracking-wide mb-1">
              <DollarSign size={14} />
              Este mês
            </div>
            <p className="text-xl font-bold text-[var(--ber-carbon)]">{stats.thisMonth} propostas</p>
          </div>
        </div>
      )}

      {/* Status filter */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        <Filter size={14} className="text-[var(--ber-carbon-light)] shrink-0" />
        {FILTER_GROUPS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === f.value
                ? 'bg-[var(--ber-olive)] text-white'
                : 'bg-white border border-[var(--ber-border)] text-[var(--ber-carbon-light)] hover:border-[var(--ber-olive)] hover:text-[var(--ber-olive)]'
            }`}
          >
            {f.label}
            {stats && f.value && stats.pipeline[f.value] != null
              ? ` (${stats.pipeline[f.value]})`
              : ''}
          </button>
        ))}
      </div>

      {/* Proposals list */}
      {displayed.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--ber-border)] p-10 text-center text-[var(--ber-carbon-light)] text-sm">
          Nenhuma proposta encontrada.
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(p => (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-[var(--ber-border)] p-4 hover:border-[var(--ber-olive)] hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                    {p.agendorWebUrl && (
                      <a
                        href={p.agendorWebUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[var(--ber-olive)] hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        Agendor ↗
                      </a>
                    )}
                  </div>
                  <p className="font-semibold text-[var(--ber-carbon)] truncate">{p.title}</p>
                  <p className="text-sm text-[var(--ber-carbon-light)] mt-0.5">{p.clientName}</p>
                  {p.notes && (
                    <p className="text-xs text-[var(--ber-carbon-light)] mt-1 line-clamp-2">{p.notes}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-[var(--ber-carbon)]">{fmtCurrency(p.value)}</p>
                  {p.sentDate && (
                    <p className="text-xs text-[var(--ber-carbon-light)] mt-0.5">Enviada {fmtDate(p.sentDate)}</p>
                  )}
                  {p.closedDate && (
                    <p className="text-xs text-[var(--ber-carbon-light)]">Fechada {fmtDate(p.closedDate)}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
