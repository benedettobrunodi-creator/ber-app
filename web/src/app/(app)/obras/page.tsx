'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Plus, MapPin, Calendar, User, HardHat, Archive, ArchiveRestore, Trash2, RefreshCw, X, AlertTriangle } from 'lucide-react';
import NovaObraModal from '@/components/obras/NovaObraModal';

type ObraStatus = 'planejamento' | 'em_andamento' | 'pausada' | 'concluida' | 'cancelada';

interface Obra {
  id: string;
  name: string;
  client: string | null;
  address: string | null;
  status: ObraStatus;
  progressPercent: number;
  startDate: string | null;
  expectedEndDate: string | null;
  coordinator: { id: string; name: string; avatarUrl: string | null } | null;
  _count: { members: number; tasks: number };
}

const STATUS_CONFIG: Record<ObraStatus, { label: string; className: string }> = {
  planejamento:  { label: 'Planejamento',  className: 'bg-ber-gray/15 text-ber-gray' },
  em_andamento:  { label: 'Em andamento',  className: 'bg-ber-teal/15 text-ber-teal' },
  pausada:       { label: 'Pausada',       className: 'bg-amber-100 text-amber-700' },
  concluida:     { label: 'Concluída',     className: 'bg-ber-olive/15 text-ber-olive' },
  cancelada:     { label: 'Arquivada',     className: 'bg-red-50 text-red-500' },
};

const FILTERS: { label: string; value: string }[] = [
  { label: 'Todas',        value: '' },
  { label: 'Em andamento', value: 'em_andamento' },
  { label: 'Concluídas',   value: 'concluida' },
  { label: 'Pausadas',     value: 'pausada' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface ConfirmDialogProps {
  obraName: string;
  onConfirm: () => void;
  onCancel: () => void;
}
function ConfirmDialog({ obraName, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-t-2xl md:rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <h2 className="text-base font-bold text-ber-carbon">Arquivar obra?</h2>
          <button onClick={onCancel} className="text-ber-gray hover:text-ber-carbon">
            <X size={18} />
          </button>
        </div>
        <p className="mt-2 text-sm text-ber-gray">
          A obra <strong>"{obraName}"</strong> será marcada como arquivada. Você pode reativá-la depois.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border border-ber-gray/30 px-4 py-2 text-sm font-medium text-ber-carbon hover:bg-ber-offwhite"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Arquivar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ObrasPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmObra, setConfirmObra] = useState<Obra | null>(null);
  const [deleteObra, setDeleteObra] = useState<Obra | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  async function fetchObras() {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 100 };
      if (filter) params.status = filter;
      const res = await api.get('/obras', { params });
      const data: Obra[] = res.data.data;
      data.sort((a, b) => (a.status === 'cancelada' ? 1 : 0) - (b.status === 'cancelada' ? 1 : 0));
      setObras(data);
    } catch {
      /* handled by interceptor */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchObras(); }, [filter]);

  async function handleArchive(obra: Obra) {
    try {
      await api.delete(`/obras/${obra.id}`);
      setConfirmObra(null);
      fetchObras();
    } catch {
      /* handled by interceptor */
    }
  }

  async function handleUnarchive(obra: Obra) {
    try {
      await api.put(`/obras/${obra.id}`, { status: 'em_andamento' });
      fetchObras();
    } catch {
      /* handled by interceptor */
    }
  }

  async function handleDeletePermanent(obra: Obra) {
    try {
      await api.delete(`/obras/${obra.id}/permanent`);
      setDeleteObra(null);
      fetchObras();
    } catch {
      /* handled by interceptor */
    }
  }

  async function handleSyncClickUp() {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await api.post('/obras/sync-clickup');
      const { synced, unmatched, errors } = res.data.data;
      const msgs: string[] = [];
      if (synced.length) msgs.push(`✅ ${synced.length} obra(s) sincronizada(s)`);
      if (unmatched.length) msgs.push(`⚠️ ${unmatched.length} sem correspondência`);
      if (errors.length) msgs.push(`❌ ${errors.length} erro(s)`);
      setSyncMsg(msgs.join(' · '));
      fetchObras();
    } catch {
      setSyncMsg('Erro ao sincronizar com ClickUp');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(''), 6000);
    }
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-black text-ber-carbon">Obras</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncClickUp}
            disabled={syncing}
            title="Sincronizar progresso do cronograma"
            className="flex items-center gap-1.5 rounded-md border border-ber-gray/30 bg-white px-3 py-2 text-xs font-medium text-ber-carbon transition-colors hover:bg-ber-offwhite disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando…' : 'Sync Cronograma'}
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ber-black"
          >
            <Plus size={16} />
            Nova Obra
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="mt-3 rounded-md bg-ber-teal/10 px-3 py-2 text-xs font-medium text-ber-teal">
          {syncMsg}
        </div>
      )}

      {/* Filters */}
      <div className="mt-5 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-ber-carbon text-white'
                : 'bg-white text-ber-carbon hover:bg-ber-gray/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="mt-12 text-center text-sm text-ber-gray">Carregando...</div>
      ) : obras.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <HardHat size={48} className="text-ber-gray/40" />
          <p className="mt-4 text-sm font-medium text-ber-gray">Nenhuma obra encontrada</p>
          <p className="mt-1 text-xs text-ber-gray/70">Clique em "Nova Obra" para cadastrar a primeira.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-ber-gray/10 bg-white shadow-sm">
          {/* List header */}
          <div className="grid grid-cols-[1fr_auto_160px_140px_100px_72px] items-center gap-4 border-b border-ber-gray/10 bg-ber-offwhite px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ber-gray">
            <span>Obra</span>
            <span className="w-28 text-left">Status</span>
            <span>Coordenador</span>
            <span>Prazo</span>
            <span className="text-right">Progresso</span>
            <span />
          </div>

          {obras.map((obra, idx) => {
            const statusCfg = STATUS_CONFIG[obra.status] ?? STATUS_CONFIG.planejamento;
            return (
              <div
                key={obra.id}
                className={`group relative grid grid-cols-[1fr_auto_160px_140px_100px_72px] items-center gap-4 px-4 py-3 transition-colors hover:bg-ber-teal/5 ${idx !== obras.length - 1 ? 'border-b border-ber-gray/10' : ''} ${obra.status === 'cancelada' ? 'opacity-50' : ''}`}
              >
                <Link href={`/obras/${obra.id}`} className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ber-carbon group-hover:text-ber-teal">
                    {obra.name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ber-gray">
                    {obra.client && <span className="truncate">{obra.client}</span>}
                    {obra.client && obra.address && <span>·</span>}
                    {obra.address && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin size={10} />
                        {obra.address}
                      </span>
                    )}
                  </div>
                </Link>

                <span className={`w-28 shrink-0 rounded-full px-2.5 py-0.5 text-center text-xs font-semibold ${statusCfg.className}`}>
                  {statusCfg.label}
                </span>

                <div className="flex items-center gap-1.5 text-xs text-ber-gray">
                  {obra.coordinator ? (
                    <><User size={11} /><span className="truncate">{obra.coordinator.name}</span></>
                  ) : <span className="text-ber-gray/40">—</span>}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-ber-gray">
                  {obra.expectedEndDate ? (
                    <><Calendar size={11} /><span>{formatDate(obra.expectedEndDate)}</span></>
                  ) : <span className="text-ber-gray/40">—</span>}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs font-bold text-ber-olive">{obra.progressPercent}%</span>
                  <div className="h-1 w-full rounded-full bg-ber-offwhite">
                    <div
                      className="h-full rounded-full bg-ber-olive transition-all"
                      style={{ width: `${obra.progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {obra.status === 'cancelada' ? (
                    <button onClick={() => handleUnarchive(obra)} title="Desarquivar" className="rounded p-1 text-ber-gray hover:bg-green-50 hover:text-green-600">
                      <ArchiveRestore size={14} />
                    </button>
                  ) : (
                    <button onClick={() => setConfirmObra(obra)} title="Arquivar" className="rounded p-1 text-ber-gray hover:bg-amber-50 hover:text-amber-500">
                      <Archive size={14} />
                    </button>
                  )}
                  <button onClick={() => setDeleteObra(obra)} title="Excluir" className="rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <NovaObraModal
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); fetchObras(); }}
        />
      )}

      {confirmObra && (
        <ConfirmDialog
          obraName={confirmObra.name}
          onConfirm={() => handleArchive(confirmObra)}
          onCancel={() => setConfirmObra(null)}
        />
      )}

      {deleteObra && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-t-2xl md:rounded-xl bg-white p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-ber-carbon">Excluir permanentemente?</h2>
                <p className="mt-1 text-sm text-ber-gray">
                  Esta ação é <strong>irreversível</strong>. Todos os dados da obra{' '}
                  <strong>"{deleteObra.name}"</strong> serão excluídos definitivamente — tarefas, fotos, checklists e membros.
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setDeleteObra(null)}
                className="flex-1 rounded-md border border-ber-gray/30 px-4 py-2 text-sm font-medium text-ber-carbon hover:bg-ber-offwhite"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeletePermanent(deleteObra)}
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
