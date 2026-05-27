'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Trash2 } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<Proposal | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get('/proposals').then((res) => {
      const raw = res.data?.data ?? res.data?.proposals ?? [];
      setProposals(Array.isArray(raw) ? raw : []);
    }).finally(() => setLoading(false));
  }, []);

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/proposals/${confirmDelete.id}`);
      setProposals(prev => prev.filter(p => p.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch {
      /* handled by interceptor */
    } finally {
      setDeleting(false);
    }
  }

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
        <p className="text-sm text-[var(--ber-carbon-light)] mt-1">{proposals.length} propostas</p>
      </div>

      {/* Proposals list */}
      {proposals.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--ber-border)] p-10 text-center text-[var(--ber-carbon-light)] text-sm">
          Nenhuma proposta encontrada.
        </div>
      ) : (
        <div className="space-y-2">
          {proposals.map(p => (
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
                <div className="flex items-start gap-3">
                  <div className="text-right shrink-0">
                    <p className="font-bold text-[var(--ber-carbon)]">{fmtCurrency(p.value)}</p>
                    {p.sentDate && (
                      <p className="text-xs text-[var(--ber-carbon-light)] mt-0.5">Enviada {fmtDate(p.sentDate)}</p>
                    )}
                    {p.closedDate && (
                      <p className="text-xs text-[var(--ber-carbon-light)]">Fechada {fmtDate(p.closedDate)}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setConfirmDelete(p)}
                    title="Excluir lead"
                    className="mt-0.5 rounded p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-t-2xl md:rounded-xl bg-white p-6">
            <h2 className="text-base font-bold text-[var(--ber-carbon)]">Excluir lead?</h2>
            <p className="mt-2 text-sm text-[var(--ber-carbon-light)]">
              <strong>"{confirmDelete.title}"</strong> ({confirmDelete.clientName}) será excluído permanentemente.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-[var(--ber-carbon)] hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
