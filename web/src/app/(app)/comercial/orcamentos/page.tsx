'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore, getUserPermissions } from '@/stores/authStore';
import api from '@/lib/api';
import {
  Star, StarOff, Plus, X, ChevronDown, ChevronRight, Download,
  History, Edit2, Copy, Trash2, Search, Filter, GripVertical, LayoutList, LayoutGrid,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from 'recharts';
import {
  DndContext, DragEndEvent, DragOverlay, PointerSensor,
  closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* ─── Types ─── */

interface Responsavel { id: string; name: string; role: string }

interface Orcamento {
  id: string;
  numero: string;
  cliente: string;
  descricaoCurta: string | null;
  m2: number | null;
  valorVenda: number | null;
  segmento: string | null;
  estrategico: boolean;
  tipo: string;
  probabilidade: string | null;
  ordem: number;
  status: string;
  categoria: string;
  dataInicio: string | null;
  dataFim: string | null;
  dataEntrega: string | null;
  responsavel: Responsavel | null;
  terceirizado: boolean;
  observacoes: string | null;
  changeOrderDe: string | null;
  pai: { id: string; numero: string; cliente: string } | null;
  filhos: Array<{ id: string; numero: string; cliente: string; status: string }>;
  historico?: Array<{
    id: string; campo: string; valorAntigo: string | null;
    valorNovo: string | null; alteradoPor: string; alteradoEm: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface StatsData {
  pipeline: { valor: number; count: number };
  emProducao: number;
  entreguesNoMes: number;
  winRate: number | null;
  byStatus: Array<{ status: string; _count: { id: number } }>;
  bySegmento: Array<{ segmento: string | null; _count: { id: number }; _sum: { valorVenda: number | null } }>;
}

/* ─── Constants ─── */

const STATUS_LABELS: Record<string, string> = {
  LEAD: 'Lead', A_INICIAR: 'A Iniciar', PRODUZINDO: 'Produzindo', REVISAO: 'Revisão',
  ENVIADO: 'Enviado', AGUARDANDO: 'Aguardando', APROVADO: 'Aprovado',
  ENTREGUE: 'Entregue', DECLINADO: 'Declinado', NO_GO: 'No-Go',
  CHANGE_ORDER: 'Change Order', PRODUZIR: 'A Produzir',
  CANCELADO: 'Cancelado', PERDIDO: 'Perdido',
};

const STATUS_COLORS: Record<string, string> = {
  LEAD: 'border border-blue-300 text-blue-500 bg-transparent',
  PRODUZINDO: 'bg-[#00B0F0] text-white',
  REVISAO: 'bg-yellow-400 text-gray-900',
  ENVIADO: 'bg-purple-500 text-white',
  AGUARDANDO: 'bg-purple-400 text-white',
  APROVADO: 'bg-green-500 text-white',
  ENTREGUE: 'bg-green-700 text-white',
  DECLINADO: 'bg-gray-400 text-white',
  NO_GO: 'bg-gray-500 text-white',
  A_INICIAR: 'border border-gray-400 text-gray-600 bg-transparent',
  CHANGE_ORDER: 'bg-orange-500 text-white',
  PRODUZIR: 'bg-sky-400 text-white',
  CANCELADO: 'bg-red-400 text-white',
  PERDIDO: 'bg-rose-700 text-white',
};

const GANTT_BAR_BG: Record<string, string> = {
  LEAD: 'transparent',
  PRODUZINDO: '#00B0F0',
  REVISAO: '#FACC15',
  ENVIADO: '#A855F7',
  AGUARDANDO: '#C084FC',
  APROVADO: '#22C55E',
  ENTREGUE: '#15803D',
  DECLINADO: '#9CA3AF',
  NO_GO: '#6B7280',
  A_INICIAR: 'transparent',
  CHANGE_ORDER: '#F97316',
  PRODUZIR: '#38BDF8',
  CANCELADO: '#F87171',
  PERDIDO: '#9F1239',
};

const CATEGORIAS = ['LEAD', 'EM_ANDAMENTO', 'A_INICIAR', 'SEM_ACAO'] as const;
const CATEGORIA_LABELS: Record<string, string> = {
  LEAD: 'Lead', EM_ANDAMENTO: 'Em Andamento', A_INICIAR: 'A Iniciar', SEM_ACAO: 'Sem Ação',
};
const SEGMENTOS = ['Corporativo', 'Residencial', 'Industrial', 'Igreja', 'Hotel', 'Outros'];
const ALL_STATUSES = Object.keys(STATUS_LABELS);
const PIE_COLORS = ['#00B0F0', '#FACC15', '#A855F7', '#22C55E', '#F97316', '#9CA3AF', '#06B6D4'];

const PIPELINE_STATUSES = ['ENVIADO', 'AGUARDANDO', 'APROVADO'];
const PROBABILIDADES = ['ALTA', 'MEDIA', 'BAIXA'] as const;
type Probabilidade = (typeof PROBABILIDADES)[number];
const PROB_LABELS: Record<Probabilidade, string> = { ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' };
const PROB_WEIGHT: Record<Probabilidade, number> = { ALTA: 0.8, MEDIA: 0.5, BAIXA: 0.2 };
const PROB_COLORS: Record<Probabilidade, { bg: string; text: string; border: string; badge: string }> = {
  ALTA:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200', badge: 'bg-green-100 text-green-700' },
  MEDIA: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700' },
  BAIXA: { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',   badge: 'bg-red-100 text-red-700' },
};

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const RESP_COLORS = [
  'bg-teal-100 text-teal-700',
  'bg-blue-100 text-blue-700',
  'bg-purple-100 text-purple-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-indigo-100 text-indigo-700',
];

function respColor(name: string) {
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return RESP_COLORS[hash % RESP_COLORS.length];
}

/* ─── Gantt helpers ─── */

type ZoomLevel = 'dia' | 'semana' | 'mes';
const ZOOM_PX: Record<ZoomLevel, number> = { dia: 40, semana: 14, mes: 4 };
const ROW_H = 40;
const BAR_H = 22;
const LABEL_W = 320;
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function ganttRange(items: Orcamento[]) {
  const withDates = items.filter(o => ['LEAD', 'EM_ANDAMENTO', 'A_INICIAR'].includes(o.categoria) && (o.dataInicio || o.dataFim));
  if (withDates.length === 0) {
    const today = new Date();
    return { start: addDays(today, -30), end: addDays(today, 60) };
  }
  const times = withDates.flatMap(o => {
    const arr: number[] = [];
    if (o.dataInicio) arr.push(new Date(o.dataInicio).getTime());
    if (o.dataFim) arr.push(new Date(o.dataFim).getTime());
    return arr;
  });
  return {
    start: addDays(new Date(Math.min(...times)), -14),
    end: addDays(new Date(Math.max(...times)), 21),
  };
}

/* ─── Status Badge ─── */

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[status] ?? 'bg-gray-200 text-gray-700'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

/* ─── Drawer de Edição ─── */

interface DrawerProps {
  orc: Orcamento | null;
  users: Responsavel[];
  allOrcs: Orcamento[];
  canWrite: boolean;
  onClose: () => void;
  onSaved: (o: Orcamento) => void;
  onDeleted: (id: string) => void;
}

function OrcamentoDrawer({ orc, users: _users, allOrcs: _allOrcs, canWrite, onClose, onSaved, onDeleted }: DrawerProps) {
  const isNew = !orc;
  const [tab, setTab] = useState<'crm' | 'historico'>('crm');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [numero, setNumero] = useState('');
  const [cliente, setCliente] = useState('');
  const [criarNoCrm, setCriarNoCrm] = useState(true);
  const [crmCtx, setCrmCtx] = useState<{ oportunidade: { id: string; titulo: string; etapa: string; empresa: { razaoSocial: string } | null } | null; obra: { id: string; name: string; status: string; fase: string } | null } | null>(null);
  const [criandoOp, setCriandoOp] = useState(false);
  const [showCriarOp, setShowCriarOp] = useState(false);
  const [novaOpEtapa, setNovaOpEtapa] = useState('proposta_enviada');

  useEffect(() => {
    if (orc?.id) {
      api.get(`/crm/orcamentos/${orc.id}/contexto`).then(r => setCrmCtx(r.data)).catch(() => {});
    } else {
      setCrmCtx(null);
    }
  }, [orc?.id]);

  async function handleCriarOportunidade() {
    if (!orc?.id) return;
    setCriandoOp(true);
    try {
      const res = await api.post('/crm/oportunidades', {
        titulo: orc.cliente || orc.numero,
        etapa: novaOpEtapa,
        origem: 'outbound',
      });
      const opId = res.data.id;
      await api.patch(`/crm/oportunidades/${opId}/vincular-orcamento`, { orcamentoId: orc.id });
      const r = await api.get(`/crm/orcamentos/${orc.id}/contexto`);
      setCrmCtx(r.data);
      setShowCriarOp(false);
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao criar oportunidade');
    } finally {
      setCriandoOp(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!numero.trim()) { setError('Número obrigatório'); return; }
    if (!cliente.trim()) { setError('Cliente obrigatório'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/orcamentos', {
        numero: numero.trim(),
        cliente: cliente.trim(),
        status: 'A_INICIAR',
      });
      const novoOrc: Orcamento = res.data.data;

      if (criarNoCrm) {
        try {
          const opRes = await api.post('/crm/oportunidades', {
            titulo: cliente.trim(),
            etapa: 'proposta_enviada',
            origem: 'outbound',
          });
          await api.patch(`/crm/oportunidades/${opRes.data.id}/vincular-orcamento`, {
            orcamentoId: novoOrc.id,
          });
        } catch {
          // CRM creation failed silently — orçamento was created successfully
        }
      }

      onSaved(novoOrc);
    } catch (err: any) {
      const errData = err.response?.data?.error ?? err.response?.data;
      setError(errData?.message ?? 'Erro ao criar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!orc || !confirm(`Excluir orçamento ${orc.numero}?`)) return;
    setDeleting(true);
    try {
      await api.delete(`/orcamentos/${orc.id}`);
      onDeleted(orc.id);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  }

  async function handleDuplicar() {
    if (!orc) return;
    try {
      const res = await api.post(`/orcamentos/${orc.id}/duplicar`);
      onSaved(res.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Erro ao duplicar');
    }
  }

  const inputCls = 'w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-[#06A99D] focus:ring-1 focus:ring-[#06A99D] focus:outline-none';
  const labelCls = 'mb-1 block text-xs font-semibold text-gray-600 uppercase tracking-wide';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {isNew ? 'Novo Orçamento' : `Orçamento ${orc!.numero}`}
            </h2>
            {!isNew && orc!.cliente && orc!.cliente !== orc!.numero && (
              <p className="text-xs text-gray-500">{orc!.cliente}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isNew && canWrite && (
              <>
                <button type="button" onClick={handleDuplicar} title="Duplicar" className="rounded-lg p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                  <Copy size={15} />
                </button>
                <button type="button" onClick={handleDelete} disabled={deleting} title="Excluir" className="rounded-lg p-2 text-gray-400 hover:text-red-600 hover:bg-red-50">
                  <Trash2 size={15} />
                </button>
              </>
            )}
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs — só para existentes */}
        {!isNew && (
          <div className="flex border-b border-gray-100 px-5">
            {(['crm', 'historico'] as const).map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`py-2.5 px-1 mr-5 text-xs font-semibold uppercase tracking-wide border-b-2 transition-colors ${
                  tab === t ? 'border-[#06A99D] text-[#06A99D]' : 'border-transparent text-gray-400 hover:text-gray-700'
                }`}>
                {t === 'crm' ? 'CRM' : 'Histórico'}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && <p className="mb-3 text-xs text-red-600">{error}</p>}

          {/* Novo orçamento */}
          {isNew && (
            <form id="orc-new-form" onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className={labelCls}>Número *</label>
                <input
                  className={inputCls}
                  value={numero}
                  onChange={e => setNumero(e.target.value)}
                  placeholder="ex: 582.26"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className={labelCls}>Cliente *</label>
                <input
                  className={inputCls}
                  value={cliente}
                  onChange={e => setCliente(e.target.value)}
                  placeholder="Nome do cliente ou empresa"
                  required
                />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setCriarNoCrm(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${criarNoCrm ? 'bg-[#06A99D]' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${criarNoCrm ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-sm text-gray-700">Criar oportunidade no CRM junto</span>
              </label>
              {criarNoCrm && (
                <p className="text-[11px] text-[#06A99D] bg-[#06A99D]/5 rounded-lg px-3 py-2">
                  Uma oportunidade CRM será criada e vinculada automaticamente ao orçamento.
                </p>
              )}
            </form>
          )}

          {/* Histórico */}
          {!isNew && tab === 'historico' && (
            <div className="space-y-3">
              {(orc!.historico ?? []).length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">Nenhuma alteração registrada</p>
              )}
              {(orc!.historico ?? []).map(h => (
                <div key={h.id} className="rounded-lg border border-gray-100 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-700 uppercase">{h.campo}</span>
                    <span className="text-[10px] text-gray-400">{fmtDate(h.alteradoEm)} · {h.alteradoPor}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="line-through">{h.valorAntigo ?? '—'}</span>
                    <span>→</span>
                    <span className="font-medium text-gray-800">{h.valorNovo ?? '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* CRM */}
          {!isNew && tab === 'crm' && (
            <div className="space-y-2">
              {crmCtx?.oportunidade ? (
                <div className="rounded-lg border border-[#5A7A7A]/30 bg-[#5A7A7A]/5 p-4 space-y-3">
                  <p className="text-[10px] font-bold text-[#5A7A7A] uppercase tracking-wide">Oportunidade Vinculada</p>
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-semibold text-gray-500 w-16 shrink-0 pt-0.5">Negócio</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{crmCtx.oportunidade.titulo}</p>
                      {crmCtx.oportunidade.empresa && (
                        <p className="text-[11px] text-gray-500">{crmCtx.oportunidade.empresa.razaoSocial}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-gray-500 w-16 shrink-0">Etapa CRM</span>
                    <select
                      value={crmCtx.oportunidade.etapa}
                      onChange={async (e) => {
                        try {
                          await api.patch(`/crm/oportunidades/${crmCtx!.oportunidade!.id}`, { etapa: e.target.value });
                          const r = await api.get(`/crm/orcamentos/${orc!.id}/contexto`);
                          setCrmCtx(r.data);
                        } catch { setError('Erro ao atualizar etapa'); }
                      }}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-[#5A7A7A]"
                    >
                      <option value="lead">Lead</option>
                      <option value="qualificacao">Qualificação</option>
                      <option value="proposta_producao">Proposta em Produção</option>
                      <option value="proposta_enviada">Proposta Enviada</option>
                      <option value="negociacao">Negociação</option>
                      <option value="ganho">Ganho</option>
                      <option value="perdido">Perdido</option>
                    </select>
                  </div>
                  {crmCtx.obra && (
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-semibold text-gray-500 w-16 shrink-0">Obra</span>
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{crmCtx.obra.name}</p>
                        <p className="text-[10px] text-gray-500">{crmCtx.obra.status} · {crmCtx.obra.fase.replace('_', ' ')}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center space-y-3">
                  <p className="text-xs text-gray-400">Nenhuma oportunidade CRM vinculada</p>
                  {canWrite && !showCriarOp && (
                    <button type="button" onClick={() => setShowCriarOp(true)}
                      className="text-sm font-semibold text-[#5A7A7A] hover:text-[#3d5c5c] underline underline-offset-2">
                      + Criar oportunidade no CRM
                    </button>
                  )}
                  {canWrite && showCriarOp && (
                    <div className="space-y-2 text-left">
                      <p className="text-[10px] text-gray-500">Onde no pipeline?</p>
                      <div className="flex gap-2 items-center">
                        <select value={novaOpEtapa} onChange={e => setNovaOpEtapa(e.target.value)}
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                          <option value="lead">Lead</option>
                          <option value="qualificacao">Qualificação</option>
                          <option value="proposta_producao">Proposta em Produção</option>
                          <option value="proposta_enviada">Proposta Enviada</option>
                          <option value="negociacao">Negociação</option>
                        </select>
                        <button type="button" onClick={handleCriarOportunidade} disabled={criandoOp}
                          className="text-xs bg-[#5A7A7A] text-white rounded-lg px-3 py-1.5 disabled:opacity-40 whitespace-nowrap">
                          {criandoOp ? '…' : 'Criar'}
                        </button>
                        <button type="button" onClick={() => setShowCriarOp(false)}
                          className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — só para novo */}
        {isNew && canWrite && (
          <div className="border-t border-gray-100 px-5 py-4">
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button form="orc-new-form" type="submit" disabled={saving}
                className="flex-1 rounded-lg bg-[#06A99D] px-4 py-2 text-sm font-bold text-white hover:bg-[#058e83] disabled:opacity-50">
                {saving ? 'Criando…' : 'Criar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Tab Timeline (Gantt) ─── */

interface GanttProps {
  items: Orcamento[];
  canWrite: boolean;
  onClickItem: (o: Orcamento) => void;
  onReorder: (orderedIds: string[]) => void;
}

interface GanttRowProps {
  orc: Orcamento;
  canWrite: boolean;
  totalW: number;
  todayOffset: number;
  barLeft: number;
  barWidth: number;
  barBg: string;
  isOutline: boolean;
  onClickItem: (o: Orcamento) => void;
  onTooltip: (orc: Orcamento | null, e?: React.MouseEvent) => void;
}

function GanttRow({ orc, canWrite, totalW, todayOffset, barLeft, barWidth, barBg, isOutline, onClickItem, onTooltip }: GanttRowProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: orc.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, height: ROW_H, opacity: isDragging ? 0.35 : 1 }}
      className="flex items-center border-b border-gray-100 hover:bg-gray-50/60 group"
    >
      {/* Label */}
      <div style={{ width: LABEL_W, minWidth: LABEL_W }}
        className="shrink-0 sticky left-0 z-[5] flex items-center gap-1 pl-1 pr-2 overflow-hidden border-r border-gray-100 h-full bg-white group-hover:bg-gray-50/60">
        {canWrite && (
          <button
            {...attributes}
            {...listeners}
            onClick={e => e.stopPropagation()}
            className="shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity touch-none p-0.5 rounded">
            <GripVertical size={13} />
          </button>
        )}
        <div className="flex items-center gap-1.5 overflow-hidden cursor-pointer flex-1 h-full min-w-0" onClick={() => onClickItem(orc)}>
          {orc.estrategico && <Star size={11} className="shrink-0 fill-yellow-400 text-yellow-400" />}
          <span className="text-xs font-semibold text-gray-800 truncate">{orc.numero}</span>
          <span className="text-[10px] text-gray-400 truncate">{orc.cliente}</span>
        </div>
        {orc.terceirizado ? (
          <div title="Terceirizado" className="shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[8px] font-bold bg-slate-200 text-slate-600">TC</div>
        ) : orc.responsavel && (
          <div
            title={orc.responsavel.name}
            className={`shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[8px] font-bold ${respColor(orc.responsavel.name)}`}>
            {initials(orc.responsavel.name)}
          </div>
        )}
      </div>

      {/* Bar area */}
      <div className="relative" style={{ width: totalW, height: ROW_H }}>
        <div className="absolute top-0 bottom-0 w-px bg-red-400 opacity-40" style={{ left: todayOffset }} />
        <div
          className="absolute rounded cursor-pointer flex items-center px-2 transition-opacity hover:opacity-90"
          style={{
            left: barLeft, width: barWidth,
            top: (ROW_H - BAR_H) / 2, height: BAR_H,
            background: isOutline ? 'transparent' : barBg,
            border: isOutline ? '2px solid #9CA3AF' : 'none',
          }}
          onClick={() => onClickItem(orc)}
          onMouseEnter={e => onTooltip(orc, e)}
          onMouseLeave={() => onTooltip(null)}
        >
          <span className={`text-[10px] font-semibold truncate ${isOutline ? 'text-gray-600' : 'text-white'}`}>
            {orc.cliente}
          </span>
        </div>
      </div>
    </div>
  );
}

function TabTimeline({ items, canWrite, onClickItem, onReorder }: GanttProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [tooltip, setTooltip] = useState<{ orc: Orcamento; x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>('dia');
  const [activeId, setActiveId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    if (!scrollRef.current) return;
    const px = ZOOM_PX[zoom];
    const { start } = ganttRange(items);
    const offset = Math.max(0, daysBetween(start, new Date())) * px;
    scrollRef.current.scrollLeft = Math.max(0, offset - 7 * px);
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const pxPerDay = ZOOM_PX[zoom];
  const { start, end } = ganttRange(items);
  const totalDays = daysBetween(start, end);
  const totalW = totalDays * pxPerDay;
  const today = new Date();
  const todayOffset = Math.max(0, daysBetween(start, today)) * pxPerDay;
  const HEADER_H = zoom === 'mes' ? 28 : 48;

  const monthSpans: Array<{ label: string; left: number; width: number }> = [];
  {
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur <= end) {
      const left = Math.max(0, daysBetween(start, cur)) * pxPerDay;
      const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const daysInView = Math.min(daysBetween(cur, nextMonth), totalDays - daysBetween(start, cur));
      monthSpans.push({ label: `${MONTHS_SHORT[cur.getMonth()]}/${String(cur.getFullYear()).slice(2)}`, left, width: daysInView * pxPerDay });
      cur = nextMonth;
    }
  }

  const dayTicks: Array<{ label: string; left: number; isToday: boolean; isFirst: boolean }> = [];
  if (zoom === 'dia') {
    for (let d = 0; d < totalDays; d++) {
      const date = addDays(start, d);
      dayTicks.push({ label: String(date.getDate()), left: d * pxPerDay, isToday: date.toDateString() === today.toDateString(), isFirst: date.getDate() === 1 });
    }
  }

  const weekSpans: Array<{ label: string; left: number; width: number }> = [];
  if (zoom === 'semana') {
    const dow = start.getDay();
    let cur = addDays(start, dow === 0 ? -6 : 1 - dow);
    while (cur <= end) {
      const visStart = cur < start ? start : cur;
      const visEnd = addDays(cur, 6) > end ? end : addDays(cur, 6);
      weekSpans.push({ label: `${visStart.getDate()} ${MONTHS_SHORT[visStart.getMonth()]}`, left: Math.max(0, daysBetween(start, visStart)) * pxPerDay, width: (daysBetween(visStart, visEnd) + 1) * pxPerDay });
      cur = addDays(cur, 7);
    }
  }

  const grouped = (['EM_ANDAMENTO', 'A_INICIAR', 'LEAD'] as const).map(cat => ({
    cat,
    items: items.filter(o => o.categoria === cat && (o.dataInicio || o.dataFim)),
  })).filter(g => g.items.length > 0);

  function barProps(o: Orcamento) {
    const s = o.dataInicio ? new Date(o.dataInicio) : today;
    const e2 = o.dataFim ? new Date(o.dataFim) : addDays(s, 7);
    return {
      left: Math.max(0, daysBetween(start, s)) * pxPerDay,
      width: Math.max(pxPerDay * 2, (daysBetween(s, e2) + 1) * pxPerDay),
    };
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    for (const { items: catItems } of grouped) {
      const oldIndex = catItems.findIndex(o => o.id === active.id);
      const newIndex = catItems.findIndex(o => o.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(arrayMove(catItems, oldIndex, newIndex).map(o => o.id));
        break;
      }
    }
  }

  function handleTooltip(orc: Orcamento | null, e?: React.MouseEvent) {
    if (!orc || !e) { setTooltip(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ orc, x: rect.left, y: rect.bottom + 6 });
  }

  const activeOrc = activeId ? items.find(o => o.id === activeId) ?? null : null;

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center justify-between gap-1 px-4 py-2 border-b border-gray-100 bg-white">
        <button
          onClick={() => { if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, todayOffset - 7 * pxPerDay); }}
          className="px-3 py-1 rounded-md text-[11px] font-bold transition-colors bg-red-50 text-red-500 hover:bg-red-100 border border-red-200">
          ↩ Ir para hoje
        </button>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400 mr-1 uppercase tracking-wide">Zoom</span>
          {(['dia', 'semana', 'mes'] as ZoomLevel[]).map(z => (
            <button key={z} onClick={() => setZoom(z)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold capitalize transition-colors ${zoom === z ? 'bg-[#06A99D] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {z === 'dia' ? 'Dia' : z === 'semana' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {/* Scroll container */}
      <div className="flex-1 overflow-auto" ref={scrollRef}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={e => setActiveId(String(e.active.id))}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div style={{ minWidth: LABEL_W + totalW + 40 }}>
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
              <div className="flex">
                <div style={{ width: LABEL_W, minWidth: LABEL_W, height: zoom === 'mes' ? 28 : 20 }} className="shrink-0 sticky left-0 z-20 border-r border-gray-200 bg-gray-50" />
                <div className="relative" style={{ width: totalW, height: zoom === 'mes' ? 28 : 20 }}>
                  {monthSpans.map(m => (
                    <div key={m.label} className="absolute top-0 border-r border-gray-100 flex items-center px-2"
                      style={{ left: m.left, width: m.width, height: zoom === 'mes' ? 28 : 20 }}>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap overflow-hidden">{m.label}</span>
                    </div>
                  ))}
                  <div className="absolute top-0 bottom-0 w-px bg-red-400" style={{ left: todayOffset }} />
                </div>
              </div>
              {zoom !== 'mes' && (
                <div className="flex border-t border-gray-100">
                  <div style={{ width: LABEL_W, minWidth: LABEL_W, height: 28 }} className="shrink-0 sticky left-0 z-20 border-r border-gray-200 bg-gray-50" />
                  <div className="relative" style={{ width: totalW, height: 28 }}>
                    {zoom === 'dia' && dayTicks.map(d => (
                      <div key={d.left}
                        className={`absolute top-0 flex items-center justify-center border-r ${d.isFirst ? 'border-r-gray-300' : 'border-r-gray-100'} ${d.isToday ? 'bg-red-50' : ''}`}
                        style={{ left: d.left, width: pxPerDay, height: 28 }}>
                        <span className={`text-[10px] font-semibold ${d.isToday ? 'text-red-500' : d.isFirst ? 'text-gray-700' : 'text-gray-400'}`}>{d.label}</span>
                      </div>
                    ))}
                    {zoom === 'semana' && weekSpans.map((w, i) => (
                      <div key={i} className="absolute top-0 flex items-center border-r border-gray-200 px-1.5"
                        style={{ left: w.left, width: w.width, height: 28 }}>
                        <span className="text-[10px] font-semibold text-gray-500 whitespace-nowrap overflow-hidden">{w.label}</span>
                      </div>
                    ))}
                    <div className="absolute top-0 bottom-0 w-px bg-red-400 opacity-60" style={{ left: todayOffset }} />
                  </div>
                </div>
              )}
            </div>

            {/* Groups */}
            {grouped.map(({ cat, items: catItems }) => {
              const isCollapsed = collapsed[cat];
              return (
                <div key={cat}>
                  <div className="flex items-center bg-gray-50 border-b border-gray-200 sticky z-10" style={{ top: HEADER_H }}>
                    <div style={{ width: LABEL_W, minWidth: LABEL_W }}
                      className="shrink-0 sticky left-0 z-20 flex items-center gap-2 px-3 py-2 border-r border-gray-200 bg-gray-50 cursor-pointer select-none"
                      onClick={() => setCollapsed(c => ({ ...c, [cat]: !c[cat] }))}>
                      {isCollapsed ? <ChevronRight size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{CATEGORIA_LABELS[cat]}</span>
                      <span className="ml-auto text-[10px] text-gray-400">{catItems.length}</span>
                    </div>
                    <div className="relative" style={{ width: totalW, height: 30 }}>
                      <div className="absolute top-0 bottom-0 w-px bg-red-400 opacity-30" style={{ left: todayOffset }} />
                    </div>
                  </div>

                  {!isCollapsed && (
                    <SortableContext items={catItems.map(o => o.id)} strategy={verticalListSortingStrategy}>
                      {catItems.map(orc => {
                        const { left: barLeft, width: barWidth } = barProps(orc);
                        return (
                          <GanttRow
                            key={orc.id}
                            orc={orc}
                            canWrite={canWrite}
                            totalW={totalW}
                            todayOffset={todayOffset}
                            barLeft={barLeft}
                            barWidth={barWidth}
                            barBg={GANTT_BAR_BG[orc.status] ?? '#9CA3AF'}
                            isOutline={orc.status === 'A_INICIAR'}
                            onClickItem={onClickItem}
                            onTooltip={handleTooltip}
                          />
                        );
                      })}
                    </SortableContext>
                  )}
                </div>
              );
            })}

            {grouped.length === 0 && (
              <div className="flex items-center justify-center py-20 text-sm text-gray-400">
                Nenhum orçamento com datas para exibir no Gantt
              </div>
            )}
          </div>

          <DragOverlay>
            {activeOrc && (() => {
              const { left: barLeft, width: barWidth } = barProps(activeOrc);
              const isOutline = activeOrc.status === 'A_INICIAR';
              const bg = GANTT_BAR_BG[activeOrc.status] ?? '#9CA3AF';
              return (
                <div className="flex items-center shadow-2xl rounded border border-gray-200 bg-white" style={{ height: ROW_H, width: LABEL_W + Math.min(barLeft + barWidth + 20, totalW) }}>
                  <div style={{ width: LABEL_W, minWidth: LABEL_W }}
                    className="shrink-0 flex items-center gap-1.5 pl-2 pr-2 overflow-hidden border-r border-gray-100 h-full">
                    <GripVertical size={13} className="text-gray-400 shrink-0" />
                    {activeOrc.estrategico && <Star size={11} className="shrink-0 fill-yellow-400 text-yellow-400" />}
                    <span className="text-xs font-semibold text-gray-800 truncate">{activeOrc.numero}</span>
                    <span className="text-[10px] text-gray-400 truncate flex-1">{activeOrc.cliente}</span>
                    {activeOrc.terceirizado ? (
                      <div className="shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[8px] font-bold bg-slate-200 text-slate-600">TC</div>
                    ) : activeOrc.responsavel && (
                      <div className={`shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[8px] font-bold ${respColor(activeOrc.responsavel.name)}`}>
                        {initials(activeOrc.responsavel.name)}
                      </div>
                    )}
                  </div>
                  <div className="relative flex-1 h-full overflow-hidden">
                    <div className="absolute rounded flex items-center px-2"
                      style={{ left: barLeft, width: barWidth, top: (ROW_H - BAR_H) / 2, height: BAR_H, background: isOutline ? 'transparent' : bg, border: isOutline ? '2px solid #9CA3AF' : 'none' }}>
                      <span className={`text-[10px] font-semibold truncate ${isOutline ? 'text-gray-600' : 'text-white'}`}>{activeOrc.cliente}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </DragOverlay>
        </DndContext>
      </div>

      {tooltip && (
        <div className="fixed z-50 rounded-lg bg-gray-900 text-white px-3 py-2 text-xs pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y, maxWidth: 260 }}>
          <p className="font-bold">{tooltip.orc.numero} — {tooltip.orc.cliente}</p>
          <p className="text-gray-300">{STATUS_LABELS[tooltip.orc.status]}</p>
          {tooltip.orc.segmento && <p className="text-gray-400">{tooltip.orc.segmento}</p>}
          <p className="text-gray-400">{fmtDate(tooltip.orc.dataInicio)} → {fmtDate(tooltip.orc.dataFim)}</p>
          {tooltip.orc.valorVenda && <p className="text-green-400 font-semibold">{BRL(tooltip.orc.valorVenda)}</p>}
          {tooltip.orc.terceirizado
            ? <p className="text-gray-400">Terceirizado</p>
            : tooltip.orc.responsavel && <p className="text-gray-400">{tooltip.orc.responsavel.name}</p>
          }
        </div>
      )}
    </div>
  );
}

/* ─── Tab Lista ─── */

function TabLista({ items, canWrite, onClickItem, onNew }: {
  items: Orcamento[];
  canWrite: boolean;
  onClickItem: (o: Orcamento) => void;
  onNew: () => void;
}) {
  function exportCSV() {
    const header = ['Número', 'Cliente', 'Segmento', 'm²', 'R$', 'Status', 'Responsável', 'Início', 'Fim'];
    const rows = items.map(o => [
      o.numero, o.cliente, o.segmento ?? '', o.m2 ?? '', o.valorVenda ?? '',
      STATUS_LABELS[o.status] ?? o.status,
      o.terceirizado ? 'Terceirizado' : (o.responsavel?.name ?? ''),
      o.dataInicio?.slice(0, 10) ?? '',
      o.dataFim?.slice(0, 10) ?? '',
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'orcamentos.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">{items.length} orçamentos</span>
        <div className="flex gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
            <Download size={13} /> CSV
          </button>
          {canWrite && (
            <button onClick={onNew}
              className="flex items-center gap-1.5 rounded-lg bg-[#06A99D] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#058e83]">
              <Plus size={13} /> Novo
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
            <tr>
              <th className="w-8 px-3 py-2.5" />
              <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Número</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide min-w-[240px]">Cliente</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide hidden md:table-cell">Segmento</th>
              <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wide hidden lg:table-cell">m²</th>
              <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wide hidden lg:table-cell">R$</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide hidden md:table-cell">Tipo</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide hidden md:table-cell">Resp.</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide hidden xl:table-cell">Início</th>
              <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wide hidden xl:table-cell">Fim</th>
            </tr>
          </thead>
          <tbody>
            {items.map(o => (
              <tr key={o.id}
                className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                onClick={() => onClickItem(o)}>
                <td className="px-3 py-2.5 text-center">
                  {o.estrategico && <Star size={12} className="fill-yellow-400 text-yellow-400 mx-auto" />}
                </td>
                <td className="px-3 py-2.5 font-semibold text-gray-800">{o.numero}</td>
                <td className="px-3 py-2.5 text-gray-700">{o.cliente}</td>
                <td className="px-3 py-2.5 text-gray-500 hidden md:table-cell">{o.segmento ?? '—'}</td>
                <td className="px-3 py-2.5 text-right text-gray-500 hidden lg:table-cell">
                  {o.m2 ? `${o.m2.toLocaleString('pt-BR')} m²` : '—'}
                </td>
                <td className="px-3 py-2.5 text-right text-gray-700 font-medium hidden lg:table-cell">
                  {o.valorVenda ? BRL(o.valorVenda) : '—'}
                </td>
                <td className="px-3 py-2.5"><StatusBadge status={o.status} /></td>
                <td className="px-3 py-2.5 hidden md:table-cell">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    o.tipo === 'REVISAO'      ? 'bg-orange-100 text-orange-700' :
                    o.tipo === 'CHANGE_ORDER' ? 'bg-purple-100 text-purple-700' :
                    'bg-teal-50 text-teal-700'
                  }`}>
                    {o.tipo === 'REVISAO' ? 'Revisão' : o.tipo === 'CHANGE_ORDER' ? 'Change Order' : 'Novo'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-gray-500 hidden md:table-cell">{o.terceirizado ? 'Terceirizado' : (o.responsavel?.name ?? '—')}</td>
                <td className="px-3 py-2.5 text-gray-400 text-xs hidden xl:table-cell">{fmtDate(o.dataInicio)}</td>
                <td className="px-3 py-2.5 text-gray-400 text-xs hidden xl:table-cell">{fmtDate(o.dataFim)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={11} className="py-16 text-center text-gray-400 text-sm">Nenhum orçamento encontrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── Tab Pipeline ─── */

function TabPipeline({ items, onClickItem }: { items: Orcamento[]; onClickItem: (o: Orcamento) => void }) {
  const [viewMode, setViewMode] = useState<'cards' | 'lista'>('cards');

  const propostas = items.filter(o => PIPELINE_STATUSES.includes(o.status));
  const byProb = PROBABILIDADES.map(prob => {
    const group = propostas.filter(o => o.probabilidade === prob);
    const total = group.reduce((s, o) => s + Number(o.valorVenda ?? 0), 0);
    const ponderado = total * PROB_WEIGHT[prob];
    return { prob, group, total, ponderado };
  });
  const semProb = propostas.filter(o => !o.probabilidade);
  const totalGeral = byProb.reduce((s, b) => s + b.total, 0);
  const totalPonderado = byProb.reduce((s, b) => s + b.ponderado, 0);

  // Lista completa ordenada por status
  const STATUS_ORDER = ['LEAD','A_INICIAR','PRODUZIR','PRODUZINDO','REVISAO','ENVIADO','AGUARDANDO','APROVADO','ENTREGUE','CHANGE_ORDER','DECLINADO','NO_GO','CANCELADO','PERDIDO'];
  const allSorted = [...items].sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.status);
    const bi = STATUS_ORDER.indexOf(b.status);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  const totalAllValor = items.reduce((s, o) => s + Number(o.valorVenda ?? 0), 0);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-5 space-y-5">

        {/* KPIs topo */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Propostas em aberto</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{propostas.length}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Total R$</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{BRL(totalGeral)}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Valor Ponderado</p>
            <p className="mt-1 text-2xl font-black text-[#06A99D]">{BRL(totalPonderado)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Alta×80% · Média×50% · Baixa×20%</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Sem classificação</p>
            <p className="mt-1 text-2xl font-black text-gray-400">{semProb.length}</p>
          </div>
        </div>

        {/* Toggle de view */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {viewMode === 'cards' ? `${propostas.length} propostas enviadas/aguardando/aprovadas` : `${items.length} itens · todos os status`}
          </p>
          <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              title="Cards por probabilidade"
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === 'cards' ? 'bg-[#06A99D] text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutGrid size={13} /> Cards
            </button>
            <button
              onClick={() => setViewMode('lista')}
              title="Lista completa"
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === 'lista' ? 'bg-[#06A99D] text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutList size={13} /> Lista
            </button>
          </div>
        </div>

        {viewMode === 'cards' ? (
          <>
            {/* Cards por probabilidade */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {byProb.map(({ prob, group, total, ponderado }) => {
                const c = PROB_COLORS[prob];
                return (
                  <div key={prob} className={`rounded-xl border-2 ${c.border} ${c.bg} p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-sm font-black uppercase tracking-wide ${c.text}`}>{PROB_LABELS[prob]}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${c.badge}`}>
                        {group.length} proposta{group.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className={`text-xl font-black ${c.text}`}>{BRL(total)}</p>
                    <p className={`text-[11px] mt-0.5 ${c.text} opacity-70`}>
                      Ponderado: {BRL(ponderado)} ({Math.round(PROB_WEIGHT[prob] * 100)}%)
                    </p>
                    <div className="mt-3 space-y-2">
                      {group.length === 0 && (
                        <p className={`text-xs ${c.text} opacity-50 text-center py-3`}>Nenhuma proposta</p>
                      )}
                      {group.map(o => (
                        <div key={o.id} onClick={() => onClickItem(o)}
                          className="cursor-pointer rounded-lg bg-white/70 hover:bg-white px-3 py-2 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-gray-800 truncate">{o.cliente}</span>
                            <StatusBadge status={o.status} />
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[10px] text-gray-400">{o.numero}</span>
                            <span className="text-xs font-bold text-gray-700">{o.valorVenda ? BRL(o.valorVenda) : '—'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {semProb.length > 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                  Sem probabilidade classificada ({semProb.length})
                </p>
                <div className="space-y-2">
                  {semProb.map(o => (
                    <div key={o.id} onClick={() => onClickItem(o)}
                      className="cursor-pointer flex items-center justify-between rounded-lg bg-white border border-gray-100 px-3 py-2 hover:border-gray-300 transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-xs font-semibold text-gray-700 truncate">{o.cliente}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">{o.numero}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={o.status} />
                        <span className="text-xs font-bold text-gray-700">{o.valorVenda ? BRL(o.valorVenda) : '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Lista completa — todos os status */
          <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
            <div className="grid grid-cols-[1fr_120px_100px_90px_80px_90px] gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-bold uppercase tracking-wide text-gray-400">
              <span>Cliente / Orçamento</span>
              <span>Status</span>
              <span>Responsável</span>
              <span>Probabilidade</span>
              <span>Segmento</span>
              <span className="text-right">Valor</span>
            </div>
            {allSorted.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-10">Nenhum item encontrado.</p>
            )}
            {allSorted.map((o, idx) => (
              <div
                key={o.id}
                onClick={() => onClickItem(o)}
                className={`cursor-pointer grid grid-cols-[1fr_120px_100px_90px_80px_90px] gap-3 px-4 py-2.5 items-center text-xs hover:bg-[#06A99D]/5 transition-colors ${idx !== allSorted.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{o.cliente}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{o.numero}{o.descricaoCurta ? ` · ${o.descricaoCurta}` : ''}</p>
                </div>
                <div><StatusBadge status={o.status} /></div>
                <span className="text-gray-600 truncate">{o.responsavel?.name ?? <span className="text-gray-300">—</span>}</span>
                <span>
                  {o.probabilidade
                    ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PROB_COLORS[o.probabilidade as Probabilidade]?.badge ?? 'bg-gray-100 text-gray-500'}`}>{PROB_LABELS[o.probabilidade as Probabilidade] ?? o.probabilidade}</span>
                    : <span className="text-gray-300">—</span>}
                </span>
                <span className="text-gray-500 truncate">{o.segmento ?? <span className="text-gray-300">—</span>}</span>
                <span className="text-right font-bold text-gray-700">{o.valorVenda ? BRL(o.valorVenda) : '—'}</span>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_120px_100px_90px_80px_90px] gap-3 px-4 py-2.5 border-t border-gray-200 bg-gray-50 text-xs font-bold text-gray-700">
              <span>{items.length} itens</span>
              <span /><span /><span /><span />
              <span className="text-right">{BRL(totalAllValor)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Tab Dashboard ─── */

function TabDashboard({ stats, items }: { stats: StatsData | null; items: Orcamento[] }) {
  if (!stats) return <div className="flex items-center justify-center py-20 text-gray-400">Carregando…</div>;

  const byStatusChart = stats.byStatus.map(s => ({
    name: STATUS_LABELS[s.status] ?? s.status,
    value: s._count.id,
    status: s.status,
  }));

  const bySegChart = stats.bySegmento.map(s => ({
    name: s.segmento ?? 'N/D',
    count: s._count.id,
    valor: Number(s._sum.valorVenda ?? 0),
  }));

  // Burndown semanal (últimas 8 semanas)
  const now = new Date();
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (7 - i) * 7);
    return d;
  });
  const burndownData = weeks.map(w => ({
    week: w.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    ativos: items.filter(o => {
      if (!o.dataInicio) return false;
      const s = new Date(o.dataInicio);
      const e2 = o.dataFim ? new Date(o.dataFim) : new Date(s);
      e2.setDate(e2.getDate() + 30);
      return s <= w && e2 >= w;
    }).length,
  }));

  const kpis = [
    {
      label: 'Pipeline',
      value: BRL(Number(stats.pipeline.valor)),
      sub: `${stats.pipeline.count} orçamentos`,
      color: 'text-purple-600',
    },
    {
      label: 'Em Produção',
      value: String(stats.emProducao),
      sub: 'em andamento',
      color: 'text-[#00B0F0]',
    },
    {
      label: 'Entregues no Mês',
      value: String(stats.entreguesNoMes),
      sub: 'este mês',
      color: 'text-green-600',
    },
    {
      label: 'Win Rate (90d)',
      value: stats.winRate != null ? `${stats.winRate}%` : '—',
      sub: 'últimos 90 dias',
      color: stats.winRate != null && stats.winRate >= 50 ? 'text-green-600' : 'text-orange-500',
    },
  ];

  return (
    <div className="p-5 overflow-auto space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl bg-white border border-gray-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{k.label}</p>
            <p className={`mt-1 text-2xl font-black ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-gray-400">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Donut por status */}
        <div className="rounded-xl bg-white border border-gray-100 p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Por Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={byStatusChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                {byStatusChart.map((entry, i) => (
                  <Cell key={i} fill={GANTT_BAR_BG[entry.status] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTip />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar por segmento */}
        <div className="rounded-xl bg-white border border-gray-100 p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Por Segmento</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={bySegChart} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <RechartsTip />
              <Bar dataKey="count" fill="#06A99D" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Burndown semanal */}
        <div className="rounded-xl bg-white border border-gray-100 p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Ativos por Semana</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={burndownData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <RechartsTip />
              <Bar dataKey="ativos" fill="#00B0F0" radius={[3, 3, 0, 0]} name="Ativos" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Por responsável */}
        <div className="rounded-xl bg-white border border-gray-100 p-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Por Responsável</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              layout="vertical"
              data={Object.entries(
                items.reduce((acc, o) => {
                  const name = o.terceirizado ? 'Terceirizado' : (o.responsavel?.name ?? 'Sem resp.');
                  acc[name] = (acc[name] ?? 0) + 1;
                  return acc;
                }, {} as Record<string, number>),
              ).map(([name, count]) => ({ name, count }))}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 9 }} />
              <RechartsTip />
              <Bar dataKey="count" fill="#5A7D5A" radius={[0, 3, 3, 0]} name="Qtd" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

type ActiveTab = 'timeline' | 'lista' | 'pipeline' | 'dashboard';

export default function EsteiraDOrcamentosPage() {
  const { user } = useAuthStore();
  const perms = getUserPermissions(user);
  const canWrite = user ? !['campo'].includes(user.role) && perms.orcamentos : false;

  const [tab, setTab] = useState<ActiveTab>('timeline');
  const [items, setItems] = useState<Orcamento[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [users, setUsers] = useState<Responsavel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSegmento, setFilterSegmento] = useState('');
  const [filterResp, setFilterResp] = useState('');
  const [filterEstrategico, setFilterEstrategico] = useState('');
  const [filterQ, setFilterQ] = useState('');

  // Drawer
  const [drawer, setDrawer] = useState<{ open: boolean; orc: Orcamento | null }>({
    open: false, orc: null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (filterStatus) params.status = filterStatus;
      if (filterSegmento) params.segmento = filterSegmento;
      if (filterResp) params.responsavelId = filterResp;
      if (filterEstrategico) params.estrategico = filterEstrategico;
      if (filterQ) params.q = filterQ;

      const [itemsRes, usersRes] = await Promise.all([
        api.get('/orcamentos', { params }),
        api.get('/users', { params: { limit: 100 } }),
      ]);
      setItems(itemsRes.data.data ?? []);
      setUsers(usersRes.data.data ?? []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message ?? 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterSegmento, filterResp, filterEstrategico, filterQ]);

  const loadStats = useCallback(async () => {
    try {
      const res = await api.get('/orcamentos/stats');
      setStats(res.data.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === 'dashboard') loadStats(); }, [tab, loadStats]);

  async function handleReorder(orderedIds: string[]) {
    setItems(prev => {
      const idSet = new Set(orderedIds);
      const reordered = orderedIds.map(id => prev.find(o => o.id === id)!).filter(Boolean);
      const result: Orcamento[] = [];
      let inserted = false;
      for (const item of prev) {
        if (!idSet.has(item.id)) {
          result.push(item);
        } else if (!inserted) {
          result.push(...reordered);
          inserted = true;
        }
      }
      return result;
    });
    try {
      await api.post('/orcamentos/reorder', { ids: orderedIds });
    } catch {
      load();
    }
  }

  function openDrawer(orc: Orcamento | null) {
    if (orc && orc.historico === undefined) {
      // Fetch full detail with history
      api.get(`/orcamentos/${orc.id}`).then(r => {
        setDrawer({ open: true, orc: r.data.data });
      }).catch(() => setDrawer({ open: true, orc }));
    } else {
      setDrawer({ open: true, orc });
    }
  }

  function onSaved(saved: Orcamento) {
    setItems(prev => {
      const idx = prev.findIndex(o => o.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setDrawer({ open: false, orc: null });
    if (tab === 'dashboard') loadStats();
  }

  function onDeleted(id: string) {
    setItems(prev => prev.filter(o => o.id !== id));
    setDrawer({ open: false, orc: null });
    if (tab === 'dashboard') loadStats();
  }

  const TABS: Array<{ key: ActiveTab; label: string }> = [
    { key: 'timeline', label: 'Timeline' },
    { key: 'lista', label: 'Lista' },
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'dashboard', label: 'Dashboard' },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div className="border-b border-gray-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-gray-900 tracking-tight">Esteira de Orçamentos</h1>
            <p className="text-xs text-gray-400">Controle e acompanhamento do pipeline comercial</p>
          </div>
          {canWrite && (
            <button onClick={() => setDrawer({ open: true, orc: null })}
              className="flex items-center gap-1.5 rounded-lg bg-[#06A99D] px-4 py-2 text-sm font-bold text-white hover:bg-[#058e83]">
              <Plus size={15} /> Novo Orçamento
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="h-8 rounded-lg border border-gray-200 bg-gray-50 pl-7 pr-3 text-xs focus:border-[#06A99D] focus:outline-none"
              placeholder="Buscar…" value={filterQ} onChange={e => setFilterQ(e.target.value)} />
          </div>
          <select className="h-8 rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs focus:border-[#06A99D] focus:outline-none"
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select className="h-8 rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs focus:border-[#06A99D] focus:outline-none"
            value={filterSegmento} onChange={e => setFilterSegmento(e.target.value)}>
            <option value="">Todos os segmentos</option>
            {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="h-8 rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs focus:border-[#06A99D] focus:outline-none"
            value={filterResp} onChange={e => setFilterResp(e.target.value)}>
            <option value="">Todos os resp.</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className="h-8 rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs focus:border-[#06A99D] focus:outline-none"
            value={filterEstrategico} onChange={e => setFilterEstrategico(e.target.value)}>
            <option value="">Estratégico?</option>
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </div>

        {/* Tab bar */}
        <div className="mt-3 flex gap-0 border-b border-gray-100">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-[#06A99D] text-[#06A99D]'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Carregando…</div>
        ) : error ? (
          <div className="flex items-center justify-center py-20 text-red-500 text-sm">{error}</div>
        ) : tab === 'timeline' ? (
          <TabTimeline items={items} canWrite={canWrite} onClickItem={openDrawer} onReorder={handleReorder} />
        ) : tab === 'lista' ? (
          <TabLista items={items} canWrite={canWrite} onClickItem={openDrawer} onNew={() => setDrawer({ open: true, orc: null })} />
        ) : tab === 'pipeline' ? (
          <TabPipeline items={items} onClickItem={openDrawer} />
        ) : (
          <TabDashboard stats={stats} items={items} />
        )}
      </div>

      {/* Drawer */}
      {drawer.open && (
        <OrcamentoDrawer
          orc={drawer.orc}
          users={users}
          allOrcs={items}
          canWrite={canWrite}
          onClose={() => setDrawer({ open: false, orc: null })}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}
