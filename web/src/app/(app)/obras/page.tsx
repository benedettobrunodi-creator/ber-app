'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Plus, MapPin, Calendar, User, HardHat, Archive, ArchiveRestore, Trash2, X, AlertTriangle, Search, ArrowUpDown } from 'lucide-react';
import NovaObraModal from '@/components/obras/NovaObraModal';

type ObraStatus = 'nao_iniciada' | 'planejamento' | 'em_andamento' | 'pos_obra' | 'pausada' | 'concluida' | 'cancelada';

interface Obra {
  id: string;
  name: string;
  client: string | null;
  address: string | null;
  status: ObraStatus;
  progressPercent: number;
  progressoRelatorio: number | null;
  ultimoRelatorioEm: string | null;
  startDate: string | null;
  expectedEndDate: string | null;
  situacaoAtual: string | null;
  coordinator: { id: string; name: string; avatarUrl: string | null } | null;
  _count: { members: number; tasks: number };
}

interface Kpis {
  total: number;
  ativas: number;
  atrasadas: number;
  avancoMedio: number | null;
  relatoriosAtrasados: number;
  contratacoesVencendo: number;
}

const STATUS_CONFIG: Record<ObraStatus, { label: string; className: string }> = {
  nao_iniciada:  { label: 'Não iniciada',            className: 'bg-ber-gray/10 text-ber-gray/70' },
  planejamento:  { label: 'Pré Obra - Planejamento', className: 'bg-ber-gray/15 text-ber-gray' },
  em_andamento:  { label: 'Em andamento',            className: 'bg-ber-teal/15 text-ber-teal' },
  pos_obra:      { label: 'Pós Obra',                className: 'bg-ber-olive/10 text-ber-olive/80' },
  pausada:       { label: 'Pausada',                 className: 'bg-amber-100 text-amber-700' },
  concluida:     { label: 'Concluída',               className: 'bg-ber-olive/15 text-ber-olive' },
  cancelada:     { label: 'Arquivada',               className: 'bg-red-50 text-red-500' },
};

const FILTERS: { label: string; value: string }[] = [
  { label: 'Todas',                   value: '' },
  { label: 'Não iniciadas',           value: 'nao_iniciada' },
  { label: 'Pré Obra - Planejamento', value: 'planejamento' },
  { label: 'Em andamento',            value: 'em_andamento' },
  { label: 'Pós Obra',                value: 'pos_obra' },
  { label: 'Pausadas',                value: 'pausada' },
  { label: 'Concluídas',              value: 'concluida' },
];

type SortKey = 'recentes' | 'nome' | 'prazo' | 'progresso' | 'atualizacao';
const SORTS: { label: string; value: SortKey }[] = [
  { label: 'Recentes',            value: 'recentes' },
  { label: 'Nome A–Z',            value: 'nome' },
  { label: 'Prazo mais próximo',  value: 'prazo' },
  { label: 'Menor progresso',     value: 'progresso' },
  { label: 'Atualização antiga',  value: 'atualizacao' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Fase do Sequenciamento — mesma régua da tela da obra (status + avanço do relatório). */
function faseSequenciamento(obra: Obra): string | null {
  if (obra.status === 'nao_iniciada' || obra.status === 'planejamento') return 'PP1';
  if (obra.status === 'pos_obra' || obra.status === 'concluida') return 'PP6';
  const avanco = obra.progressoRelatorio;
  if (avanco == null) return null;
  if (avanco >= 100) return 'PP6';
  if (avanco >= 75) return 'PP5';
  if (avanco >= 50) return 'PP4';
  if (avanco >= 25) return 'PP3';
  return 'PP2';
}

/** Dias desde o fim do período do último relatório; null = nunca teve. */
function diasSemRelatorio(obra: Obra): number | null {
  if (!obra.ultimoRelatorioEm) return null;
  return Math.floor((Date.now() - new Date(obra.ultimoRelatorioEm).getTime()) / DAY_MS);
}

function relatorioAtrasado(obra: Obra): boolean {
  if (obra.status !== 'em_andamento') return false;
  const dias = diasSemRelatorio(obra);
  return dias === null || dias > 7;
}

/** Cor do prazo: estourado = vermelho; < 30 dias = âmbar; resto neutro. */
function prazoClasse(obra: Obra): string {
  if (!obra.expectedEndDate || obra.status === 'concluida' || obra.status === 'cancelada') return 'text-ber-gray';
  const diff = new Date(obra.expectedEndDate).getTime() - Date.now();
  if (diff < 0) return 'text-red-600 font-semibold';
  if (diff < 30 * DAY_MS) return 'text-amber-600 font-semibold';
  return 'text-ber-gray';
}

interface ConfirmDialogProps {
  obraName: string;
  onConfirm: () => void;
  onCancel: () => void;
}
function ConfirmDialog({ obraName, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-t-2xl md:rounded-xl bg-white p-6 max-h-[90dvh] overflow-y-auto">
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
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('recentes');
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmObra, setConfirmObra] = useState<Obra | null>(null);
  const [deleteObra, setDeleteObra] = useState<Obra | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function fetchObras() {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 100 };
      if (filter) params.status = filter;
      const res = await api.get('/obras', { params });
      setObras(res.data.data as Obra[]);
    } catch {
      /* handled by interceptor */
    } finally {
      setLoading(false);
    }
  }

  async function fetchKpis() {
    try {
      const res = await api.get('/obras/counts');
      setKpis(res.data.data as Kpis);
    } catch {
      /* handled by interceptor */
    }
  }

  useEffect(() => { fetchObras(); }, [filter]);
  useEffect(() => { fetchKpis(); }, []);

  const visiveis = useMemo(() => {
    let list = [...obras];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(o =>
        o.name.toLowerCase().includes(q) || (o.client ?? '').toLowerCase().includes(q),
      );
    }
    const cmp: Record<SortKey, (a: Obra, b: Obra) => number> = {
      recentes: () => 0, // mantém a ordem do backend (updatedAt desc)
      nome: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
      prazo: (a, b) => {
        const ta = a.expectedEndDate ? new Date(a.expectedEndDate).getTime() : Infinity;
        const tb = b.expectedEndDate ? new Date(b.expectedEndDate).getTime() : Infinity;
        return ta - tb;
      },
      progresso: (a, b) => (a.progressoRelatorio ?? 101) - (b.progressoRelatorio ?? 101),
      atualizacao: (a, b) => {
        const ta = a.ultimoRelatorioEm ? new Date(a.ultimoRelatorioEm).getTime() : 0;
        const tb = b.ultimoRelatorioEm ? new Date(b.ultimoRelatorioEm).getTime() : 0;
        return ta - tb; // mais antiga primeiro — quem está parado sobe
      },
    };
    if (sortKey !== 'recentes') list.sort(cmp[sortKey]);
    // Arquivadas sempre por último, independente da ordenação
    return [
      ...list.filter(o => o.status !== 'cancelada'),
      ...list.filter(o => o.status === 'cancelada'),
    ];
  }, [obras, search, sortKey]);

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
    setDeleteError('');
    setDeleting(true);
    try {
      await api.delete(`/obras/${obra.id}/permanent`);
      setDeleteObra(null);
      fetchObras();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
      const text = typeof msg === 'string' ? msg : msg?.message;
      setDeleteError(text || 'Erro ao excluir a obra. Tente arquivar.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl md:text-2xl font-black text-ber-carbon">Obras</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ber-black"
          >
            <Plus size={16} />
            Nova Obra
          </button>
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-ber-gray/10 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ber-gray">Obras ativas</p>
            <p className="mt-1 text-2xl font-black text-ber-carbon">{kpis.ativas}</p>
          </div>
          <div className="rounded-lg border border-ber-gray/10 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ber-gray">Relatórios atrasados</p>
            <p className={`mt-1 text-2xl font-black ${kpis.relatoriosAtrasados > 0 ? 'text-red-600' : 'text-ber-olive'}`}>
              {kpis.relatoriosAtrasados}
            </p>
          </div>
          <div className="rounded-lg border border-ber-gray/10 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ber-gray">Avanço médio</p>
            <p className="mt-1 text-2xl font-black text-ber-carbon">
              {kpis.avancoMedio !== null ? `${kpis.avancoMedio}%` : '—'}
            </p>
          </div>
          <div className="rounded-lg border border-ber-gray/10 bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ber-gray">Contratações vencendo (7d)</p>
            <p className={`mt-1 text-2xl font-black ${kpis.contratacoesVencendo > 0 ? 'text-amber-600' : 'text-ber-carbon'}`}>
              {kpis.contratacoesVencendo}
            </p>
          </div>
        </div>
      )}

      {/* Filtros + busca + ordenação */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
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

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ber-gray/50" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar obra ou cliente"
              className="w-48 rounded-md border border-ber-gray/20 bg-white py-1.5 pl-8 pr-3 text-sm text-ber-carbon placeholder:text-ber-gray/50 focus:border-ber-teal focus:outline-none focus:ring-1 focus:ring-ber-teal"
            />
          </div>
          <div className="relative">
            <ArrowUpDown size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ber-gray/50" />
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              className="appearance-none rounded-md border border-ber-gray/20 bg-white py-1.5 pl-8 pr-7 text-sm text-ber-carbon focus:border-ber-teal focus:outline-none focus:ring-1 focus:ring-ber-teal"
            >
              {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="mt-12 text-center text-sm text-ber-gray">Carregando...</div>
      ) : visiveis.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <HardHat size={48} className="text-ber-gray/40" />
          <p className="mt-4 text-sm font-medium text-ber-gray">Nenhuma obra encontrada</p>
          <p className="mt-1 text-xs text-ber-gray/70">
            {search ? 'Ajuste a busca ou os filtros.' : 'Clique em "Nova Obra" para cadastrar a primeira.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-ber-gray/10 bg-white">
          <div className="min-w-[960px]">
            {/* List header */}
            <div className="grid grid-cols-[1fr_auto_56px_150px_120px_120px_100px_64px] items-center gap-4 border-b border-ber-gray/10 bg-ber-offwhite px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ber-gray">
              <span>Obra</span>
              <span className="w-40 text-left">Status</span>
              <span title="Fase do Sequenciamento">Fase</span>
              <span>Coordenador</span>
              <span>Prazo</span>
              <span title="Fim do período do último relatório semanal">Atualização</span>
              <span className="text-right">Progresso</span>
              <span />
            </div>

            {visiveis.map((obra, idx) => {
              const statusCfg = STATUS_CONFIG[obra.status] ?? STATUS_CONFIG.planejamento;
              const fase = faseSequenciamento(obra);
              const atrasado = relatorioAtrasado(obra);
              const dias = diasSemRelatorio(obra);
              return (
                <div
                  key={obra.id}
                  className={`group relative grid grid-cols-[1fr_auto_56px_150px_120px_120px_100px_64px] items-center gap-4 px-4 py-3 transition-colors hover:bg-ber-teal/5 ${idx !== visiveis.length - 1 ? 'border-b border-ber-gray/10' : ''} ${obra.status === 'cancelada' ? 'opacity-50' : ''}`}
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

                  <span className={`w-40 shrink-0 rounded-full px-2.5 py-0.5 text-center text-xs font-semibold ${statusCfg.className}`}>
                    {statusCfg.label}
                  </span>

                  <span className={`text-xs font-bold ${fase ? 'text-ber-carbon' : 'text-ber-gray/40'}`} title="Fase do Sequenciamento (pela % de avanço)">
                    {fase ?? '—'}
                  </span>

                  <div className="flex items-center gap-1.5 text-xs text-ber-gray">
                    {obra.coordinator ? (
                      <><User size={11} /><span className="truncate">{obra.coordinator.name}</span></>
                    ) : <span className="text-ber-gray/40">—</span>}
                  </div>

                  <div className={`flex items-center gap-1.5 text-xs ${prazoClasse(obra)}`}>
                    {obra.expectedEndDate ? (
                      <><Calendar size={11} /><span>{formatDate(obra.expectedEndDate)}</span></>
                    ) : <span className="text-ber-gray/40">—</span>}
                  </div>

                  <div className="text-xs">
                    {obra.ultimoRelatorioEm ? (
                      <span className={atrasado ? 'font-semibold text-red-600' : 'text-ber-gray'} title={dias !== null ? `${dias} dia(s) desde o último relatório` : undefined}>
                        {formatDate(obra.ultimoRelatorioEm)}
                      </span>
                    ) : obra.status === 'em_andamento' ? (
                      <span className="font-semibold text-red-600" title="Nenhum relatório semanal ainda">sem relatório</span>
                    ) : (
                      <span className="text-ber-gray/40">—</span>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {obra.progressoRelatorio === null ? (
                      <>
                        <span className="text-xs font-bold text-ber-gray/40">—</span>
                        <div className="h-1 w-full rounded-full bg-ber-offwhite" title="Sem relatório semanal ainda" />
                      </>
                    ) : (
                      <>
                        <span className={`text-xs font-bold ${atrasado ? 'text-red-600' : 'text-ber-olive'}`}>{obra.progressoRelatorio}%</span>
                        <div className="h-1 w-full rounded-full bg-ber-offwhite">
                          <div
                            className={`h-full rounded-full transition-all ${atrasado ? 'bg-red-500' : 'bg-ber-olive'}`}
                            style={{ width: `${obra.progressoRelatorio}%` }}
                          />
                        </div>
                      </>
                    )}
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
          <div className="w-full max-w-sm rounded-t-2xl md:rounded-xl bg-white p-6 max-h-[90dvh] overflow-y-auto">
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
            {deleteError && (
              <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {deleteError}
              </div>
            )}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => { setDeleteObra(null); setDeleteError(''); }}
                disabled={deleting}
                className="flex-1 rounded-md border border-ber-gray/30 px-4 py-2 text-sm font-medium text-ber-carbon hover:bg-ber-offwhite disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeletePermanent(deleteObra)}
                disabled={deleting}
                className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Excluindo...' : 'Excluir definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
