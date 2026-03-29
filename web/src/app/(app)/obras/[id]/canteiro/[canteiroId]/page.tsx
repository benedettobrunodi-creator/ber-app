'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  ArrowLeft,
  Check,
  X as XIcon,
  Minus,
  Camera,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface CanteiroDetail {
  id: string;
  weekStart: string;
  status: string;
  createdAt: string;
  creator: { id: string; name: string } | null;
  approver: { id: string; name: string } | null;
  approvedAt: string | null;
  obra: { id: string; name: string };
  items: CanteiroItemData[];
}

interface CanteiroItemData {
  id: string;
  title: string;
  category: string;
  order: number;
  required: boolean;
  answer: string | null; // 'conforme' | 'nao_conforme' | 'nao_aplicavel'
  photoUrl: string | null;
  observation: string | null;
  answerer: { id: string; name: string } | null;
  answeredAt: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  organizacao: 'Organização',
  protecao: 'Proteção',
  isolamento: 'Isolamento',
  comunicacao: 'Comunicação',
  higiene: 'Higiene',
  equipamentos: 'Equipamentos',
};

const CATEGORY_ICONS: Record<string, string> = {
  organizacao: '\u{1F4E6}',
  protecao: '\u{1F6E1}\uFE0F',
  isolamento: '\u{1F6A7}',
  comunicacao: '\u{1F4CB}',
  higiene: '\u{1F9F9}',
  equipamentos: '\u{1F527}',
};

const ANSWER_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  conforme: { bg: 'bg-ber-olive', text: 'text-white', label: 'Conforme' },
  nao_conforme: { bg: 'bg-red-500', text: 'text-white', label: 'Não conforme' },
  nao_aplicavel: { bg: 'bg-ber-gray', text: 'text-white', label: 'N/A' },
};

const STATUS_BANNER: Record<string, { bg: string; border: string; textColor: string; icon: typeof CheckCircle2; label: string }> = {
  aprovado: { bg: 'bg-green-50', border: 'border-green-200', textColor: 'text-green-800', icon: CheckCircle2, label: 'Canteiro aprovado' },
  reprovado: { bg: 'bg-red-50', border: 'border-red-200', textColor: 'text-red-800', icon: XCircle, label: 'Canteiro reprovado' },
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  em_andamento: { label: 'Em andamento', className: 'bg-amber-100 text-amber-700' },
  aprovado: { label: 'Aprovado', className: 'bg-green-100 text-green-700' },
  reprovado: { label: 'Reprovado', className: 'bg-red-100 text-red-700' },
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

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1').replace('/v1', '');

// ─── Component ──────────────────────────────────────────────────────────────────

export default function CanteiroDetailPage() {
  const params = useParams<{ id: string; canteiroId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [canteiro, setCanteiro] = useState<CanteiroDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingItems, setSavingItems] = useState<Record<string, boolean>>({});
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [uploadingItems, setUploadingItems] = useState<Record<string, boolean>>({});
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const obraId = params.id;
  const canteiroId = params.canteiroId;
  const isFinalized = canteiro?.status === 'aprovado' || canteiro?.status === 'reprovado';
  const isCoordOrDir = user?.role === 'coordenacao' || user?.role === 'diretoria';

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  async function fetchData() {
    setLoading(true);
    try {
      const res = await api.get(`/canteiro/${canteiroId}`);
      const data: CanteiroDetail = res.data.data;
      setCanteiro(data);

      const obs: Record<string, string> = {};
      data.items.forEach((item) => {
        obs[item.id] = item.observation || '';
      });
      setObservations(obs);
    } catch {
      /* handled by interceptor */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canteiroId]);

  // ─── Answer item ────────────────────────────────────────────────────────────

  async function handleAnswer(itemId: string, answer: string) {
    if (isFinalized) return;
    setSavingItems((prev) => ({ ...prev, [itemId]: true }));
    try {
      await api.patch(`/canteiro/${canteiroId}/items/${itemId}`, {
        answer,
        observation: observations[itemId] || null,
      });
      setCanteiro((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  answer,
                  observation: observations[itemId] || null,
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

  // ─── Save observation on blur ───────────────────────────────────────────────

  async function handleSaveObservation(itemId: string) {
    if (isFinalized) return;
    const item = canteiro?.items.find((i) => i.id === itemId);
    if (!item) return;
    setSavingItems((prev) => ({ ...prev, [itemId]: true }));
    try {
      await api.patch(`/canteiro/${canteiroId}/items/${itemId}`, {
        answer: item.answer,
        observation: observations[itemId] || null,
      });
      setCanteiro((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.id === itemId ? { ...it, observation: observations[itemId] || null } : it,
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
    if (isFinalized) return;
    setUploadingItems((prev) => ({ ...prev, [itemId]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await api.post('/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const photoUrl: string = uploadRes.data.data.url;

      const item = canteiro?.items.find((i) => i.id === itemId);
      await api.patch(`/canteiro/${canteiroId}/items/${itemId}`, {
        answer: item?.answer ?? null,
        observation: observations[itemId] || null,
        photoUrl,
      });

      setCanteiro((prev) => {
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

  // ─── Approval actions ─────────────────────────────────────────────────────

  async function handleSubmitForApproval() {
    alert('Checklist pronto para revisão da coordenação.');
  }

  async function handleApprove(status: 'aprovado' | 'reprovado') {
    setSubmittingApproval(true);
    try {
      await api.patch(`/canteiro/${canteiroId}/approve`, { status });
      fetchData();
    } catch {
      /* handled */
    } finally {
      setSubmittingApproval(false);
    }
  }

  // ─── Derived values ────────────────────────────────────────────────────────

  const items = canteiro?.items ?? [];
  const sortedItems = [...items].sort((a, b) => a.order - b.order);
  const answeredCount = items.filter((i) => i.answer !== null).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
  const requiredItems = items.filter((i) => i.required);
  const allRequiredAnswered = requiredItems.every((i) => i.answer !== null);

  // Group items by category
  const categories = sortedItems.reduce<Record<string, CanteiroItemData[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="text-sm text-ber-gray">Carregando...</div>;
  }

  if (!canteiro) {
    return <div className="text-sm text-ber-gray">Checklist de canteiro não encontrado.</div>;
  }

  const weekDate = new Date(canteiro.weekStart).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const statusBadge = STATUS_BADGE[canteiro.status] || STATUS_BADGE.em_andamento;
  const banner = STATUS_BANNER[canteiro.status];

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {banner && (
        <div className={`flex items-center gap-3 rounded-lg ${banner.bg} border ${banner.border} p-4`}>
          <banner.icon size={20} className={`${banner.textColor} shrink-0`} />
          <div>
            <p className={`text-sm font-semibold ${banner.textColor}`}>{banner.label}</p>
            {canteiro.approver && canteiro.approvedAt && (
              <p className={`text-xs ${banner.textColor} opacity-80`}>
                Por {canteiro.approver.name} em {formatDateTime(canteiro.approvedAt)}
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
              Canteiro — Semana de {weekDate}
            </h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-ber-gray">
            {canteiro.obra.name}
          </p>
          {canteiro.creator && (
            <p className="mt-0.5 text-xs text-ber-gray">
              Criado por {canteiro.creator.name} em {formatDateTime(canteiro.createdAt)}
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

      {/* Items grouped by category */}
      {Object.entries(categories).map(([category, catItems]) => (
        <div key={category}>
          <h2 className="text-sm font-bold uppercase tracking-wide text-ber-gray mb-3">
            {CATEGORY_ICONS[category] || ''} {CATEGORY_LABELS[category] || category}
          </h2>

          <div className="space-y-4">
            {catItems.map((item) => {
              const isSaving = savingItems[item.id] || false;
              const isNaoConforme = item.answer === 'nao_conforme';

              return (
                <div
                  key={item.id}
                  className={`rounded-lg bg-white shadow-sm p-4 ${isNaoConforme ? 'border-l-4 border-l-red-500' : ''}`}
                >
                  {/* Item header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-ber-carbon">{item.title}</p>
                        {item.required && (
                          <span className="rounded bg-red-50 text-red-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                            Obrigatório
                          </span>
                        )}
                      </div>
                    </div>
                    {isSaving && (
                      <span className="text-xs text-ber-gray animate-pulse">Salvando...</span>
                    )}
                  </div>

                  {/* Answer buttons */}
                  <div className="mt-3 flex gap-2">
                    {(['conforme', 'nao_conforme', 'nao_aplicavel'] as const).map((ans) => {
                      const style = ANSWER_STYLES[ans];
                      const isActive = item.answer === ans;
                      return (
                        <button
                          key={ans}
                          disabled={isFinalized || isSaving}
                          onClick={() => handleAnswer(item.id, ans)}
                          className={`rounded-lg px-4 py-2 text-sm font-semibold border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            isActive
                              ? `${style.bg} ${style.text} border-transparent`
                              : 'border-ber-gray/30 text-ber-gray hover:border-ber-gray'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            {ans === 'conforme' && <Check size={14} />}
                            {ans === 'nao_conforme' && <XIcon size={14} />}
                            {ans === 'nao_aplicavel' && <Minus size={14} />}
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

                  {/* Details section */}
                  <div className="mt-3 space-y-3 border-t border-ber-gray/10 pt-3">
                    {/* Observation */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-ber-gray mb-1">
                        <MessageSquare size={12} />
                        Observação
                      </label>
                      <textarea
                        disabled={isFinalized}
                        rows={2}
                        value={observations[item.id] ?? ''}
                        onChange={(e) =>
                          setObservations((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        onBlur={() => handleSaveObservation(item.id)}
                        placeholder="Adicionar observação..."
                        className="w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none disabled:bg-ber-offwhite disabled:cursor-not-allowed resize-none"
                      />
                    </div>

                    {/* Photo */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-ber-gray mb-1">
                        <Camera size={12} />
                        Foto
                      </label>

                      {item.photoUrl && (
                        <div className="mb-2">
                          <img
                            src={`${API_BASE}${item.photoUrl}`}
                            alt="Foto do item"
                            className="h-24 w-auto rounded-md border border-ber-gray/20 object-cover"
                          />
                        </div>
                      )}

                      {!isFinalized && (
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
                            : item.photoUrl
                              ? 'Trocar Foto'
                              : 'Tirar Foto / Anexar Foto'}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            disabled={isFinalized || uploadingItems[item.id]}
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
              );
            })}
          </div>
        </div>
      ))}

      {/* Bottom actions */}
      {!isFinalized && (
        <div className="space-y-3">
          {isCoordOrDir ? (
            <div className="flex gap-3">
              <button
                onClick={() => handleApprove('aprovado')}
                disabled={!allRequiredAnswered || submittingApproval}
                className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} />
                {submittingApproval ? 'Salvando...' : 'Aprovar'}
              </button>
              <button
                onClick={() => handleApprove('reprovado')}
                disabled={submittingApproval}
                className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <XCircle size={18} />
                {submittingApproval ? 'Salvando...' : 'Reprovar'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleSubmitForApproval}
              disabled={!allRequiredAnswered}
              className="w-full rounded-lg bg-ber-olive px-4 py-3 text-sm font-bold text-ber-black transition-colors hover:bg-ber-olive/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <AlertTriangle size={18} />
              Enviar para Aprovação
            </button>
          )}

          {!allRequiredAnswered && (
            <p className="text-center text-xs text-ber-gray">
              Responda todos os itens obrigatórios para liberar a aprovação.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
