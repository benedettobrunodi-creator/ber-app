'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { ArrowLeft, Check, X as XIcon, Clock, Camera, Plus, CheckCircle2, MessageSquare, User, Upload, Loader2, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ChecklistDetail {
  id: string;
  type: string;
  segment: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  creator: { id: string; name: string } | null;
  template: { id: string; name: string } | null;
  obra: { id: string; name: string };
  items: ChecklistItemData[];
}

interface ChecklistItemData {
  id: string;
  title: string;
  description: string | null;
  required: boolean;
  order: number;
  answer: string | null;
  photoUrl: string | null;
  observation: string | null;
  responsible: { id: string; name: string } | null;
  answerer: { id: string; name: string } | null;
  answeredAt: string | null;
}

interface ObraMember {
  id: string;
  name: string;
  role: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  vistoria_inicial: 'Vistoria Inicial',
  qualidade: 'Qualidade',
  pre_entrega: 'Pre-entrega',
  inauguracao: 'Inauguracao',
};

const ANSWER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  sim: { bg: 'bg-ber-olive', text: 'text-white', label: 'Sim' },
  nao: { bg: 'bg-red-500', text: 'text-white', label: 'Nao' },
  pendente: { bg: 'bg-ber-gray', text: 'text-white', label: 'Pendente' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Sortable wrapper ───────────────────────────────────────────────────────────

function SortableItemRow({ id, children }: { id: string; children: (props: { listeners: any }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children({ listeners })}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function ChecklistDetailPage() {
  const params = useParams<{ id: string; checklistId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [checklist, setChecklist] = useState<ChecklistDetail | null>(null);
  const [members, setMembers] = useState<ObraMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingItems, setSavingItems] = useState<Record<string, boolean>>({});

  // Item-level editable state
  const [itemEdits, setItemEdits] = useState<
    Record<string, { observation: string; responsibleId: string; photoUrl: string }>
  >({});

  // Add item form
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Upload
  const [uploadingItems, setUploadingItems] = useState<Record<string, boolean>>({});

  // Complete
  const [completing, setCompleting] = useState(false);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1').replace('/v1', '');

  const obraId = params.id;
  const checklistId = params.checklistId;
  const isCompleted = checklist?.status === 'concluido';

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  async function fetchData() {
    setLoading(true);
    try {
      const [clRes, obraRes] = await Promise.all([
        api.get(`/checklists/${checklistId}`),
        api.get(`/obras/${obraId}`),
      ]);
      const clData: ChecklistDetail = clRes.data.data;
      setChecklist(clData);

      // Extract members from obra response
      const obraData = obraRes.data.data;
      const obraMembers: ObraMember[] = (obraData.members || []).map(
        (m: { user: { id: string; name: string; role: string } }) => ({
          id: m.user.id,
          name: m.user.name,
          role: m.user.role,
        }),
      );
      setMembers(obraMembers);

      // Initialize editable state for each item
      const edits: Record<string, { observation: string; responsibleId: string; photoUrl: string }> = {};
      clData.items.forEach((item) => {
        edits[item.id] = {
          observation: item.observation || '',
          responsibleId: item.responsible?.id || '',
          photoUrl: item.photoUrl || '',
        };
      });
      setItemEdits(edits);
    } catch {
      /* handled by interceptor */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklistId, obraId]);

  // ─── Answer item ────────────────────────────────────────────────────────────

  async function handleAnswer(itemId: string, answer: string) {
    if (isCompleted) return;
    setSavingItems((prev) => ({ ...prev, [itemId]: true }));
    const edit = itemEdits[itemId];
    try {
      await api.patch(`/checklists/${checklistId}/items/${itemId}`, {
        answer,
        observation: edit?.observation || null,
        responsibleId: edit?.responsibleId || null,
        photoUrl: edit?.photoUrl || null,
      });
      // Update local state
      setChecklist((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  answer,
                  observation: edit?.observation || null,
                  photoUrl: edit?.photoUrl || null,
                  responsible: edit?.responsibleId
                    ? members.find((m) => m.id === edit.responsibleId)
                      ? { id: edit.responsibleId, name: members.find((m) => m.id === edit.responsibleId)!.name }
                      : it.responsible
                    : null,
                  answerer: user ? { id: user.id, name: user.name } : null,
                  answeredAt: new Date().toISOString(),
                }
              : it,
          ),
        };
      });
    } catch {
      /* handled */
    } finally {
      setSavingItems((prev) => ({ ...prev, [itemId]: false }));
    }
  }

  // ─── Save item details (observation, responsible, photo) without changing answer ─

  async function handleSaveItemDetails(itemId: string) {
    if (isCompleted) return;
    const item = checklist?.items.find((i) => i.id === itemId);
    if (!item) return;
    setSavingItems((prev) => ({ ...prev, [itemId]: true }));
    const edit = itemEdits[itemId];
    try {
      await api.patch(`/checklists/${checklistId}/items/${itemId}`, {
        answer: item.answer,
        observation: edit?.observation || null,
        responsibleId: edit?.responsibleId || null,
        photoUrl: edit?.photoUrl || null,
      });
      setChecklist((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  observation: edit?.observation || null,
                  photoUrl: edit?.photoUrl || null,
                  responsible: edit?.responsibleId
                    ? members.find((m) => m.id === edit.responsibleId)
                      ? { id: edit.responsibleId, name: members.find((m) => m.id === edit.responsibleId)!.name }
                      : it.responsible
                    : null,
                }
              : it,
          ),
        };
      });
    } catch {
      /* handled */
    } finally {
      setSavingItems((prev) => ({ ...prev, [itemId]: false }));
    }
  }

  // ─── Upload photo ──────────────────────────────────────────────────────────

  async function handlePhotoUpload(itemId: string, file: File) {
    if (isCompleted) return;
    setUploadingItems((prev) => ({ ...prev, [itemId]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await api.post('/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const photoUrl: string = uploadRes.data.data.url;

      // Update local edit state
      setItemEdits((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], photoUrl },
      }));

      // Save to backend
      const item = checklist?.items.find((i) => i.id === itemId);
      const edit = itemEdits[itemId];
      await api.patch(`/checklists/${checklistId}/items/${itemId}`, {
        answer: item?.answer ?? null,
        observation: edit?.observation || null,
        responsibleId: edit?.responsibleId || null,
        photoUrl,
      });

      // Update local checklist state
      setChecklist((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.id === itemId ? { ...it, photoUrl } : it,
          ),
        };
      });
    } catch {
      /* handled */
    } finally {
      setUploadingItems((prev) => ({ ...prev, [itemId]: false }));
    }
  }

  // ─── Add item ───────────────────────────────────────────────────────────────

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItemTitle.trim()) return;
    setAddingItem(true);
    try {
      await api.post(`/checklists/${checklistId}/items`, {
        title: newItemTitle.trim(),
        description: newItemDescription.trim() || null,
      });
      setNewItemTitle('');
      setNewItemDescription('');
      setShowAddItem(false);
      fetchData();
    } catch {
      /* handled */
    } finally {
      setAddingItem(false);
    }
  }

  // ─── Complete checklist ─────────────────────────────────────────────────────

  async function handleComplete() {
    if (isCompleted) return;
    setCompleting(true);
    try {
      await api.patch(`/checklists/${checklistId}/complete`);
      fetchData();
    } catch {
      /* handled */
    } finally {
      setCompleting(false);
    }
  }

  // ─── Reorder items ─────────────────────────────────────────────────────────

  async function handleReorderDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !checklist) return;
    const oldIdx = checklist.items.findIndex(i => i.id === active.id);
    const newIdx = checklist.items.findIndex(i => i.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(checklist.items, oldIdx, newIdx).map((i, idx) => ({ ...i, order: idx + 1 }));
    setChecklist({ ...checklist, items: reordered });
    try {
      await api.put(`/checklists/${checklistId}/reorder`, { itemIds: reordered.map(i => i.id) });
    } catch { /* revert on next refresh */ }
  }

  // ─── Derived values ────────────────────────────────────────────────────────

  const items = checklist?.items ?? [];
  const sortedItems = [...items].sort((a, b) => a.order - b.order);
  const answeredCount = items.filter((i) => i.answer !== null).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
  const requiredItems = items.filter((i) => i.required);
  const allRequiredAnswered = requiredItems.every((i) => i.answer !== null);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="text-sm text-ber-gray">Carregando...</div>;
  }

  if (!checklist) {
    return <div className="text-sm text-ber-gray">Checklist nao encontrado.</div>;
  }

  const typeLabel = TYPE_LABELS[checklist.type] || checklist.type;

  return (
    <div className="space-y-6">
      {/* Completed banner */}
      {isCompleted && (
        <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 p-4">
          <CheckCircle2 size={20} className="text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Checklist concluido</p>
            {checklist.completedAt && (
              <p className="text-xs text-green-600">
                Concluido em {formatDateTime(checklist.completedAt)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push(`/obras/${obraId}`)}
          className="rounded p-1.5 text-ber-gray transition-colors hover:bg-white hover:text-ber-carbon mt-1"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-ber-carbon">
              {checklist.template?.name || 'Checklist'}
            </h1>
            <span className="rounded-full bg-ber-teal/15 text-ber-teal px-2.5 py-0.5 text-xs font-semibold">
              {typeLabel}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isCompleted
                  ? 'bg-ber-olive/15 text-ber-olive'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {isCompleted ? 'Concluido' : 'Em andamento'}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-ber-gray">
            {checklist.segment} &middot; {checklist.obra.name}
          </p>
          {checklist.creator && (
            <p className="mt-0.5 text-xs text-ber-gray">
              Criado por {checklist.creator.name} em {formatDateTime(checklist.createdAt)}
            </p>
          )}

          {/* Progress */}
          <div className="mt-3 max-w-md">
            <div className="flex items-center justify-between text-xs text-ber-gray mb-1">
              <span>{answeredCount} / {totalCount} itens respondidos</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-ber-gray/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-ber-olive transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorderDragEnd}>
        <SortableContext items={sortedItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {sortedItems.map((item) => {
              const edit = itemEdits[item.id] || { observation: '', responsibleId: '', photoUrl: '' };
              const isSaving = savingItems[item.id] || false;
              const isNao = item.answer === 'nao';

              return (
                <SortableItemRow key={item.id} id={item.id}>
                  {({ listeners }) => (
                    <div className={`rounded-lg bg-white shadow-sm p-4 ${isNao ? 'border-l-4 border-l-red-500' : ''}`}>
                      {/* Item header */}
                      <div className="flex items-start justify-between gap-3">
                        {!isCompleted && (
                          <button {...listeners} className="mt-1 shrink-0 cursor-grab text-ber-gray/30 hover:text-ber-gray transition-colors touch-none" title="Arrastar para reordenar">
                            <GripVertical size={16} />
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-ber-carbon">{item.title}</p>
                    {item.required && (
                      <span className="rounded bg-red-50 text-red-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                        Obrigatorio
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-1 text-xs text-ber-gray">{item.description}</p>
                  )}
                </div>
                {isSaving && (
                  <span className="text-xs text-ber-gray animate-pulse">Salvando...</span>
                )}
              </div>

              {/* Answer buttons */}
              <div className="mt-3 flex gap-2">
                {(['sim', 'nao', 'pendente'] as const).map((ans) => {
                  const style = ANSWER_STYLES[ans];
                  const isActive = item.answer === ans;
                  return (
                    <button
                      key={ans}
                      disabled={isCompleted || isSaving}
                      onClick={() => handleAnswer(item.id, ans)}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isActive
                          ? `${style.bg} ${style.text} border-transparent`
                          : 'border-ber-gray/30 text-ber-gray hover:border-ber-gray'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {ans === 'sim' && <Check size={14} />}
                        {ans === 'nao' && <XIcon size={14} />}
                        {ans === 'pendente' && <Clock size={14} />}
                        {style.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Answered info */}
              {item.answerer && item.answeredAt && (
                <p className="mt-2 text-[11px] text-ber-gray">
                  Respondido por {item.answerer.name} em {formatDateTime(item.answeredAt)}
                </p>
              )}

              {/* Expandable details */}
              <div className="mt-3 space-y-3 border-t border-ber-gray/10 pt-3">
                {/* Observation */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-ber-gray mb-1">
                    <MessageSquare size={12} />
                    Observacao
                  </label>
                  <textarea
                    disabled={isCompleted}
                    rows={2}
                    value={edit.observation}
                    onChange={(e) =>
                      setItemEdits((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], observation: e.target.value },
                      }))
                    }
                    onBlur={() => handleSaveItemDetails(item.id)}
                    placeholder="Adicionar observacao..."
                    className="w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none disabled:bg-ber-offwhite disabled:cursor-not-allowed resize-none"
                  />
                </div>

                {/* Responsible */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-ber-gray mb-1">
                    <User size={12} />
                    Responsavel
                  </label>
                  <select
                    disabled={isCompleted}
                    value={edit.responsibleId}
                    onChange={(e) => {
                      setItemEdits((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], responsibleId: e.target.value },
                      }));
                      // Auto-save on change
                      setTimeout(() => handleSaveItemDetails(item.id), 0);
                    }}
                    className="w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none disabled:bg-ber-offwhite disabled:cursor-not-allowed"
                  >
                    <option value="">Selecionar responsavel...</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Photo */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-ber-gray mb-1">
                    <Camera size={12} />
                    Foto
                  </label>

                  {/* Thumbnail */}
                  {(edit.photoUrl || item.photoUrl) && (
                    <div className="mb-2">
                      <img
                        src={`${API_BASE}${edit.photoUrl || item.photoUrl}`}
                        alt="Foto do item"
                        className="h-24 w-auto rounded-md border border-ber-gray/20 object-cover"
                      />
                    </div>
                  )}

                  {/* Upload button */}
                  {!isCompleted && (
                    <label
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm font-medium text-ber-gray transition-colors hover:border-ber-teal hover:text-ber-teal ${
                        uploadingItems[item.id] ? 'pointer-events-none opacity-50' : ''
                      }`}
                    >
                      {uploadingItems[item.id] ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Upload size={14} />
                      )}
                      {uploadingItems[item.id]
                        ? 'Enviando...'
                        : edit.photoUrl || item.photoUrl
                          ? 'Trocar Foto'
                          : 'Tirar Foto / Anexar Foto'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={isCompleted || uploadingItems[item.id]}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(item.id, file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
                    </div>
                  )}
                </SortableItemRow>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add Item */}
      {!isCompleted && (
        <div>
          {showAddItem ? (
            <form onSubmit={handleAddItem} className="rounded-lg bg-white shadow-sm p-4 space-y-3">
              <h3 className="text-sm font-bold text-ber-carbon">Adicionar Item</h3>
              <input
                type="text"
                placeholder="Titulo do item"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                required
                className="w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
              />
              <textarea
                placeholder="Descricao (opcional)"
                rows={2}
                value={newItemDescription}
                onChange={(e) => setNewItemDescription(e.target.value)}
                className="w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddItem(false);
                    setNewItemTitle('');
                    setNewItemDescription('');
                  }}
                  className="rounded-md px-4 py-1.5 text-sm font-medium text-ber-gray transition-colors hover:bg-ber-offwhite"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addingItem}
                  className="flex items-center gap-2 rounded-md bg-ber-carbon px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-ber-black disabled:opacity-50"
                >
                  <Plus size={14} />
                  {addingItem ? 'Adicionando...' : 'Adicionar Item'}
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowAddItem(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-ber-gray/30 py-3 text-sm font-medium text-ber-gray transition-colors hover:border-ber-gray hover:text-ber-carbon"
            >
              <Plus size={16} />
              Adicionar Item
            </button>
          )}
        </div>
      )}

      {/* Complete button */}
      {!isCompleted && (
        <button
          onClick={handleComplete}
          disabled={!allRequiredAnswered || completing}
          className="w-full rounded-lg bg-ber-olive px-4 py-3 text-sm font-bold text-ber-black transition-colors hover:bg-ber-olive/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <CheckCircle2 size={18} />
          {completing ? 'Concluindo...' : 'Concluir Checklist'}
        </button>
      )}

      {!allRequiredAnswered && !isCompleted && (
        <p className="text-center text-xs text-ber-gray">
          Responda todos os itens obrigatorios para concluir o checklist.
        </p>
      )}
    </div>
  );
}
