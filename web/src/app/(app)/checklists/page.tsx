'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ClipboardCheck, HardHat, CheckCircle2, Clock, Plus, X } from 'lucide-react';

// --- Types ---

interface Obra {
  id: string;
  name: string;
  client: string | null;
  status: string;
}

interface Checklist {
  id: string;
  obraId: string;
  type: string;
  segment: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
  creator: { id: string; name: string } | null;
  template: { id: string; name: string } | null;
  items: { answer: string | null; required: boolean }[];
  _count: { items: number };
}

interface ChecklistWithObra extends Checklist {
  obra: Obra;
}

interface Template {
  id: string;
  name: string;
  type: string;
  segment: string;
}

// --- Constants ---

const TYPE_FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'vistoria_inicial', label: 'Vistoria Inicial' },
  { key: 'qualidade', label: 'Qualidade' },
  { key: 'pre_entrega', label: 'Pre-entrega' },
  { key: 'inauguracao', label: 'Inauguracao' },
] as const;

const TYPE_LABELS: Record<string, string> = {
  vistoria_inicial: 'Vistoria Inicial',
  qualidade: 'Qualidade',
  pre_entrega: 'Pre-entrega',
  inauguracao: 'Inauguracao',
};

// --- Helpers ---

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// --- Component ---

export default function ChecklistsPage() {
  const router = useRouter();
  const [allChecklists, setAllChecklists] = useState<ChecklistWithObra[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('todos');

  // Modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedObraId, setSelectedObraId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const obrasRes = await api.get('/obras');
      const allObras: Obra[] = obrasRes.data.data;
      const activeObras = allObras.filter((o) => o.status === 'em_andamento');
      setObras(activeObras);

      const results = await Promise.all(
        activeObras.map(async (obra) => {
          try {
            const res = await api.get(`/obras/${obra.id}/checklists`);
            return (res.data.data as Checklist[]).map((cl) => ({ ...cl, obra, obraId: obra.id }));
          } catch {
            return [];
          }
        }),
      );

      const flat = results.flat().sort((a, b) => {
        if (a.status === 'em_andamento' && b.status !== 'em_andamento') return -1;
        if (a.status !== 'em_andamento' && b.status === 'em_andamento') return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setAllChecklists(flat);
    } catch {
      /* interceptor */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function openNewModal() {
    setShowNewModal(true);
    setSelectedObraId('');
    setSelectedTemplateId('');
    setCreateError('');
    setLoadingTemplates(true);
    try {
      const res = await api.get('/checklist-templates');
      setTemplates(res.data.data);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }

  async function handleCreate() {
    if (!selectedObraId || !selectedTemplateId) return;
    setCreating(true);
    setCreateError('');
    try {
      await api.post(`/obras/${selectedObraId}/checklists`, { templateId: selectedTemplateId });
      setShowNewModal(false);
      await fetchData();
    } catch (err: any) {
      setCreateError(err?.response?.data?.error?.message || 'Erro ao criar checklist.');
    } finally {
      setCreating(false);
    }
  }

  const filtered = activeFilter === 'todos'
    ? allChecklists
    : allChecklists.filter((cl) => cl.type === activeFilter);

  const activeCount = allChecklists.filter((c) => c.status === 'em_andamento').length;

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-black text-ber-carbon">Checklists de Qualidade</h1>
        <p className="mt-4 text-sm text-ber-gray">Carregando...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-ber-carbon">Checklists de Qualidade</h1>
          <p className="mt-0.5 text-sm text-ber-gray">
            {allChecklists.length} checklist{allChecklists.length !== 1 ? 's' : ''}
            {activeCount > 0 && (
              <span className="ml-2 font-semibold text-ber-teal">{activeCount} em andamento</span>
            )}
          </p>
        </div>
        <button
          onClick={openNewModal}
          className="inline-flex items-center gap-2 rounded-lg bg-ber-olive px-4 py-2.5 text-sm font-bold text-white transition hover:bg-ber-olive/90"
        >
          <Plus size={16} />
          Novo Checklist
        </button>
      </div>

      {/* Filtros por tipo */}
      <div className="mt-6 flex flex-wrap gap-2">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setActiveFilter(f.key)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              activeFilter === f.key
                ? 'bg-ber-carbon text-white'
                : 'bg-white text-ber-gray border border-ber-gray/15 hover:border-ber-teal/30'
            }`}
          >
            {f.label}
            {f.key !== 'todos' && (
              <span className="ml-1.5 opacity-60">
                {allChecklists.filter((c) => c.type === f.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="mt-12 flex flex-col items-center text-center">
          <ClipboardCheck size={40} className="mb-3 text-ber-gray/30" />
          <p className="text-sm text-ber-gray">
            {allChecklists.length === 0
              ? 'Nenhum checklist criado ainda.'
              : 'Nenhum checklist neste filtro.'}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {filtered.map((cl) => {
            const totalItems = cl._count?.items ?? 0;
            const answeredItems = cl.items?.filter((i) => i.answer !== null).length ?? 0;
            const progress = totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0;
            const isConcluido = cl.status === 'concluido';

            return (
              <button
                key={cl.id}
                onClick={() => router.push(`/obras/${cl.obraId}/checklists/${cl.id}`)}
                className="flex w-full items-center gap-4 rounded-lg border border-ber-gray/15 bg-white px-5 py-4 text-left transition-colors hover:border-ber-teal/30"
              >
                {/* Icon */}
                {isConcluido
                  ? <CheckCircle2 size={18} className="shrink-0 text-ber-olive" />
                  : <Clock size={18} className="shrink-0 text-ber-teal" />
                }

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ber-carbon">
                      {cl.template?.name ?? TYPE_LABELS[cl.type] ?? cl.type}
                    </p>
                    <span className="shrink-0 rounded bg-ber-teal/10 px-2 py-0.5 text-[10px] font-bold text-ber-teal">
                      {cl.obra.name}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ber-gray">
                    <span>{TYPE_LABELS[cl.type] ?? cl.type}</span>
                    <span>{answeredItems}/{totalItems} itens</span>
                    <span>{formatDate(cl.createdAt)}</span>
                    {cl.creator && <span>{cl.creator.name.split(' ')[0]}</span>}
                  </div>
                </div>

                {/* Barra de progresso */}
                {totalItems > 0 && (
                  <div className="w-24 shrink-0">
                    <div className="mb-1 text-right text-xs text-ber-gray">{progress}%</div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ber-gray/10">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progress === 100 ? 'bg-ber-olive' : 'bg-ber-teal'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Status badge */}
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    isConcluido
                      ? 'bg-ber-olive/15 text-ber-olive'
                      : 'bg-ber-teal/15 text-ber-teal'
                  }`}
                >
                  {isConcluido ? 'Concluido' : 'Em andamento'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Modal Novo Checklist */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-ber-carbon">Novo Checklist</h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="rounded p-1 text-ber-gray hover:bg-ber-gray/10"
              >
                <X size={18} />
              </button>
            </div>

            {/* Selecionar obra */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ber-gray">
                Obra
              </label>
              {obras.length === 0 ? (
                <p className="text-sm text-ber-gray">Nenhuma obra em andamento.</p>
              ) : (
                <select
                  value={selectedObraId}
                  onChange={(e) => setSelectedObraId(e.target.value)}
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2.5 text-sm text-ber-carbon focus:border-ber-olive focus:ring-1 focus:ring-ber-olive"
                >
                  <option value="">Selecione a obra...</option>
                  {obras.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}{o.client ? ` — ${o.client}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Selecionar template */}
            <div className="mb-5">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ber-gray">
                Template
              </label>
              {loadingTemplates ? (
                <p className="text-sm text-ber-gray">Carregando templates...</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-ber-gray">Nenhum template disponivel.</p>
              ) : (
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-ber-gray/20 px-3 py-2.5 text-sm text-ber-carbon focus:border-ber-olive focus:ring-1 focus:ring-ber-olive"
                >
                  <option value="">Selecione o template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({TYPE_LABELS[t.type] ?? t.type})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Error */}
            {createError && (
              <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {createError}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowNewModal(false)}
                className="rounded-lg border border-ber-gray/20 px-4 py-2 text-sm font-medium text-ber-gray transition hover:bg-ber-gray/5"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!selectedObraId || !selectedTemplateId || creating}
                className="inline-flex items-center gap-2 rounded-lg bg-ber-olive px-5 py-2 text-sm font-bold text-white transition hover:bg-ber-olive/90 disabled:opacity-50"
              >
                {creating ? 'Criando...' : 'Criar Checklist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
