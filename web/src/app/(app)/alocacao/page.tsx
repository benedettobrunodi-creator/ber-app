'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, getUserPermissions } from '@/stores/authStore';
import api from '@/lib/api';
import { Plus, X, AlertTriangle, Lightbulb, Calendar, Users, HardHat, ChevronDown } from 'lucide-react';

/* ─── Types ─── */

interface UserInfo {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
}

interface ObraInfo {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  expectedEndDate: string | null;
}

interface Alocacao {
  id: string;
  userId: string;
  obraId: string;
  fase: 'obra' | 'projeto' | 'ambas';
  dedicacaoPct: number;
  dataInicio: string | null;
  dataFim: string | null;
  createdAt: string;
  user: { id: string; name: string; role: string; avatarUrl: string | null };
  obra: { id: string; name: string; status: string; startDate: string | null; expectedEndDate: string | null };
}

type Zoom = 'semana' | 'mes' | 'trimestre';
type ViewMode = 'recurso' | 'obra';
type Tab = 'timeline' | 'conflitos' | 'sugestoes';

/* ─── Date helpers ─── */

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/* ─── Gantt config ─── */

const PX_PER_DAY: Record<Zoom, number> = { semana: 20, mes: 7, trimestre: 3 };
const CHART_DAYS: Record<Zoom, number> = { semana: 70, mes: 180, trimestre: 365 };
const CHART_OFFSET: Record<Zoom, number> = { semana: 14, mes: 30, trimestre: 30 };
const ROW_H = 44;
const HEADER_H = 40;
const LEFT_W = 180;

const OBRA_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
  '#F97316', '#6366F1',
];

/* ─── Conflict detection ─── */

interface Conflict {
  userId: string;
  userName: string;
  maxPct: number;
  allocations: Alocacao[];
  overlapStart: Date;
  overlapEnd: Date;
}

function resolveStart(a: Alocacao): Date | null {
  return parseDate(a.dataInicio) ?? parseDate(a.obra.startDate);
}
function resolveEnd(a: Alocacao): Date | null {
  return parseDate(a.dataFim) ?? parseDate(a.obra.expectedEndDate);
}

function detectConflicts(alocacoes: Alocacao[]): Conflict[] {
  const byUser = new Map<string, Alocacao[]>();
  for (const a of alocacoes) {
    const list = byUser.get(a.userId) ?? [];
    list.push(a);
    byUser.set(a.userId, list);
  }

  const conflicts: Conflict[] = [];
  for (const [, userAlocs] of byUser.entries()) {
    if (userAlocs.length < 2) continue;
    for (let i = 0; i < userAlocs.length; i++) {
      for (let j = i + 1; j < userAlocs.length; j++) {
        const a = userAlocs[i];
        const b = userAlocs[j];
        const aS = resolveStart(a);
        const aE = resolveEnd(a);
        const bS = resolveStart(b);
        const bE = resolveEnd(b);
        if (!aS || !aE || !bS || !bE) continue;
        if (aS <= bE && bS <= aE) {
          const totalPct = a.dedicacaoPct + b.dedicacaoPct;
          if (totalPct > 100) {
            const overlapStart = new Date(Math.max(aS.getTime(), bS.getTime()));
            const overlapEnd = new Date(Math.min(aE.getTime(), bE.getTime()));
            conflicts.push({
              userId: a.userId,
              userName: a.user.name,
              maxPct: totalPct,
              allocations: [a, b],
              overlapStart,
              overlapEnd,
            });
          }
        }
      }
    }
  }
  return conflicts;
}

/* ─── Modal ─── */

interface ModalProps {
  obras: ObraInfo[];
  users: UserInfo[];
  onClose: () => void;
  onSaved: (a: Alocacao) => void;
}

function NovaAlocacaoModal({ obras, users, onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState({
    userId: '',
    obraId: '',
    fase: 'ambas' as 'obra' | 'projeto' | 'ambas',
    dedicacaoPct: 100,
    dataInicio: '',
    dataFim: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.userId || !form.obraId) { setError('Selecione recurso e obra'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/alocacoes', {
        userId: form.userId,
        obraId: form.obraId,
        fase: form.fase,
        dedicacaoPct: form.dedicacaoPct,
        dataInicio: form.dataInicio || null,
        dataFim: form.dataFim || null,
      });
      onSaved(res.data.data);
    } catch {
      setError('Erro ao salvar alocação');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Nova Alocação</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Recurso</label>
            <select
              value={form.userId}
              onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecionar colaborador…</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Obra</label>
            <select
              value={form.obraId}
              onChange={e => setForm(f => ({ ...f, obraId: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecionar obra…</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Fase</label>
            <select
              value={form.fase}
              onChange={e => setForm(f => ({ ...f, fase: e.target.value as typeof form.fase }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ambas">Obra + Projeto (Ambas)</option>
              <option value="obra">Somente Obra</option>
              <option value="projeto">Somente Projeto</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Dedicação: <span className="font-semibold text-gray-800">{form.dedicacaoPct}%</span>
            </label>
            <input
              type="range"
              min={1}
              max={100}
              value={form.dedicacaoPct}
              onChange={e => setForm(f => ({ ...f, dedicacaoPct: Number(e.target.value) }))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>1%</span><span>50%</span><span>100%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Início (opcional)</label>
              <input
                type="date"
                value={form.dataInicio}
                onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Fim (opcional)</label>
              <input
                type="date"
                value={form.dataFim}
                onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Gantt ─── */

interface TooltipData {
  x: number;
  y: number;
  userName: string;
  obraName: string;
  fase: string;
  dedicacao: number;
  dataInicio: string;
  dataFim: string;
}

interface GanttBar {
  id: string;
  left: number;
  width: number;
  color: string;
  tooltip: Omit<TooltipData, 'x' | 'y'>;
}

interface GanttRow {
  id: string;
  label: string;
  subLabel: string;
  bars: GanttBar[];
}

function buildGanttRows(
  alocacoes: Alocacao[],
  viewMode: ViewMode,
  zoom: Zoom,
  obraColorMap: Record<string, string>,
  today: Date,
): { rows: GanttRow[]; chartStart: Date; totalWidth: number; todayLeft: number } {
  const pxPerDay = PX_PER_DAY[zoom];
  const chartDays = CHART_DAYS[zoom];
  const offset = CHART_OFFSET[zoom];
  const chartStart = addDays(today, -offset);
  const totalWidth = chartDays * pxPerDay;
  const todayLeft = diffDays(today, chartStart) * pxPerDay;

  const rowMap = new Map<string, GanttRow>();

  for (const aloc of alocacoes) {
    const start = resolveStart(aloc) ?? today;
    const end = resolveEnd(aloc) ?? addDays(today, 30);

    const left = Math.max(0, diffDays(start, chartStart)) * pxPerDay;
    const rawRight = diffDays(end, chartStart) * pxPerDay;
    const width = Math.max(6, rawRight - left);

    if (rawRight < 0 || left > totalWidth) continue;

    const bar: GanttBar = {
      id: aloc.id,
      left,
      width,
      color: obraColorMap[aloc.obraId] ?? '#6B7280',
      tooltip: {
        userName: aloc.user.name,
        obraName: aloc.obra.name,
        fase: aloc.fase === 'ambas' ? 'Obra + Projeto' : aloc.fase === 'obra' ? 'Obra' : 'Projeto',
        dedicacao: aloc.dedicacaoPct,
        dataInicio: fmtDate(resolveStart(aloc)),
        dataFim: fmtDate(resolveEnd(aloc)),
      },
    };

    if (viewMode === 'recurso') {
      if (!rowMap.has(aloc.userId)) {
        rowMap.set(aloc.userId, { id: aloc.userId, label: aloc.user.name, subLabel: aloc.user.role, bars: [] });
      }
      rowMap.get(aloc.userId)!.bars.push(bar);
    } else {
      if (!rowMap.has(aloc.obraId)) {
        rowMap.set(aloc.obraId, { id: aloc.obraId, label: aloc.obra.name, subLabel: aloc.obra.status, bars: [] });
      }
      rowMap.get(aloc.obraId)!.bars.push(bar);
    }
  }

  return { rows: [...rowMap.values()], chartStart, totalWidth, todayLeft };
}

function generateTicks(chartStart: Date, chartDays: number, zoom: Zoom, pxPerDay: number) {
  const ticks: { left: number; label: string }[] = [];

  if (zoom === 'semana') {
    for (let d = 0; d < chartDays; d += 7) {
      const date = addDays(chartStart, d);
      ticks.push({ left: d * pxPerDay, label: fmtShort(date) });
    }
  } else {
    let cur = new Date(chartStart.getFullYear(), chartStart.getMonth(), 1);
    const end = addDays(chartStart, chartDays);
    while (cur < end) {
      const dayOffset = diffDays(cur, chartStart);
      if (dayOffset >= 0) {
        ticks.push({
          left: dayOffset * pxPerDay,
          label: cur.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }),
        });
      }
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }

  return ticks;
}

interface GanttChartProps {
  alocacoes: Alocacao[];
  zoom: Zoom;
  viewMode: ViewMode;
  obraColorMap: Record<string, string>;
}

function GanttChart({ alocacoes, zoom, viewMode, obraColorMap }: GanttChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const today = new Date();

  const pxPerDay = PX_PER_DAY[zoom];
  const { rows, chartStart, totalWidth, todayLeft } = buildGanttRows(alocacoes, viewMode, zoom, obraColorMap, today);
  const ticks = generateTicks(chartStart, CHART_DAYS[zoom], zoom, pxPerDay);
  const totalH = HEADER_H + rows.length * ROW_H;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Calendar size={48} className="mb-3 opacity-40" />
        <p className="text-sm">Nenhuma alocação encontrada.</p>
        <p className="text-xs">Clique em "Nova Alocação" para começar.</p>
      </div>
    );
  }

  return (
    <div className="relative flex overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* Left fixed panel */}
      <div className="flex-shrink-0 border-r border-gray-200" style={{ width: LEFT_W }}>
        {/* Header spacer */}
        <div className="border-b border-gray-200 bg-gray-50" style={{ height: HEADER_H }}>
          <div className="flex h-full items-center px-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {viewMode === 'recurso' ? 'Recurso' : 'Obra'}
            </span>
          </div>
        </div>
        {/* Row labels */}
        {rows.map(row => (
          <div
            key={row.id}
            className="flex flex-col justify-center border-b border-gray-100 px-4"
            style={{ height: ROW_H }}
          >
            <span className="truncate text-xs font-medium text-gray-800">{row.label}</span>
            <span className="text-[10px] text-gray-400">{row.subLabel}</span>
          </div>
        ))}
      </div>

      {/* Right scrollable area */}
      <div ref={scrollRef} className="relative flex-1 overflow-x-auto overflow-y-hidden">
        <div style={{ width: totalWidth, height: totalH, position: 'relative' }}>
          {/* Header ticks */}
          <div
            className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50"
            style={{ height: HEADER_H, width: totalWidth }}
          >
            {ticks.map((tick, i) => (
              <div
                key={i}
                className="absolute top-0 border-l border-gray-200"
                style={{ left: tick.left, height: HEADER_H }}
              >
                <span className="ml-1 mt-1 block text-[10px] text-gray-500">{tick.label}</span>
              </div>
            ))}
          </div>

          {/* Row grid lines */}
          {rows.map((row, ri) => (
            <div
              key={row.id}
              className="absolute w-full border-b border-gray-100"
              style={{ top: HEADER_H + ri * ROW_H, height: ROW_H, width: totalWidth }}
            >
              {/* Vertical grid lines at ticks */}
              {ticks.map((tick, i) => (
                <div
                  key={i}
                  className="absolute h-full border-l border-gray-100"
                  style={{ left: tick.left }}
                />
              ))}

              {/* Bars */}
              {row.bars.map(bar => (
                <div
                  key={bar.id}
                  className="absolute cursor-pointer rounded"
                  style={{
                    left: bar.left,
                    width: bar.width,
                    top: 8,
                    height: ROW_H - 16,
                    backgroundColor: bar.color,
                    opacity: 0.85,
                  }}
                  onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, ...bar.tooltip })}
                  onMouseMove={e => setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <span className="block truncate px-2 text-[10px] font-semibold leading-[28px] text-white">
                    {bar.tooltip.dedicacao}%
                  </span>
                </div>
              ))}
            </div>
          ))}

          {/* Today line */}
          {todayLeft >= 0 && todayLeft <= totalWidth && (
            <div
              className="pointer-events-none absolute z-20"
              style={{ left: todayLeft, top: HEADER_H, height: rows.length * ROW_H, width: 2, backgroundColor: '#EF4444' }}
            />
          )}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-gray-200 bg-white p-3 shadow-xl"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <p className="text-xs font-semibold text-gray-900">{tooltip.obraName}</p>
          <p className="text-xs text-gray-500">{tooltip.userName}</p>
          <div className="mt-1 space-y-0.5 text-[11px] text-gray-600">
            <p>Fase: {tooltip.fase}</p>
            <p>Dedicação: <span className="font-semibold">{tooltip.dedicacao}%</span></p>
            <p>Início: {tooltip.dataInicio}</p>
            <p>Fim: {tooltip.dataFim}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Page ─── */

export default function AlocacaoPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const perms = getUserPermissions(user);

  const [activeTab, setActiveTab] = useState<Tab>('timeline');
  const [zoom, setZoom] = useState<Zoom>('mes');
  const [viewMode, setViewMode] = useState<ViewMode>('recurso');
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([]);
  const [obras, setObras] = useState<ObraInfo[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (user && !perms.configuracoes) {
      router.replace('/dashboard');
    }
  }, [user, perms, router]);

  useEffect(() => {
    if (!perms.configuracoes) return;
    setLoading(true);
    Promise.all([
      api.get('/alocacoes'),
      api.get('/obras', { params: { limit: 200 } }),
      api.get('/users', { params: { limit: 200 } }),
    ]).then(([alRes, obRes, usRes]) => {
      setAlocacoes(alRes.data.data ?? []);
      setObras((obRes.data.data ?? []).filter((o: ObraInfo) => o.status !== 'cancelada'));
      setUsers(usRes.data.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [perms.configuracoes]);

  const conflicts = detectConflicts(alocacoes);

  const obraColorMap: Record<string, string> = {};
  obras.forEach((o, i) => { obraColorMap[o.id] = OBRA_COLORS[i % OBRA_COLORS.length]; });

  function handleSaved(a: Alocacao) {
    setAlocacoes(prev => [a, ...prev]);
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/alocacoes/${id}`);
      setAlocacoes(prev => prev.filter(a => a.id !== id));
    } catch { /* ignore */ }
  }

  const activeAlocacoes = alocacoes.filter(a => {
    const today = new Date();
    const end = resolveEnd(a);
    return !end || end >= today;
  });
  const allocatedUserIds = new Set(activeAlocacoes.map(a => a.userId));
  const allocatedObraIds = new Set(activeAlocacoes.map(a => a.obraId));
  const idleUsers = users.filter(u => !allocatedUserIds.has(u.id));
  const obrasWithoutTeam = obras.filter(o => o.status === 'em_andamento' && !allocatedObraIds.has(o.id));

  if (!perms.configuracoes) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Alocação de Mão de Obra</h1>
          <p className="text-xs text-gray-500">{alocacoes.length} alocações cadastradas</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus size={16} />
          Nova Alocação
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-6">
        {([
          { key: 'timeline', label: 'Timeline' },
          { key: 'conflitos', label: 'Conflitos', badge: conflicts.length },
          { key: 'sugestoes', label: 'Sugestões' },
        ] as { key: Tab; label: string; badge?: number }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative mr-1 flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">Carregando…</div>
        ) : (
          <>
            {/* ── TIMELINE ── */}
            {activeTab === 'timeline' && (
              <div className="space-y-4">
                {/* Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* View mode toggle */}
                  <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
                    {(['recurso', 'obra'] as ViewMode[]).map(m => (
                      <button
                        key={m}
                        onClick={() => setViewMode(m)}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          viewMode === m ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {m === 'recurso' ? <Users size={12} /> : <HardHat size={12} />}
                        {m === 'recurso' ? 'Por Recurso' : 'Por Obra'}
                      </button>
                    ))}
                  </div>

                  {/* Zoom */}
                  <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
                    {([
                      { key: 'semana', label: 'Semana' },
                      { key: 'mes', label: 'Mês' },
                      { key: 'trimestre', label: 'Trimestre' },
                    ] as { key: Zoom; label: string }[]).map(z => (
                      <button
                        key={z.key}
                        onClick={() => setZoom(z.key)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          zoom === z.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {z.label}
                      </button>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="ml-auto flex flex-wrap gap-2">
                    {obras
                      .filter(o => alocacoes.some(a => a.obraId === o.id))
                      .slice(0, 8)
                      .map((o, i) => (
                        <span key={o.id} className="flex items-center gap-1 text-[10px] text-gray-600">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-sm"
                            style={{ backgroundColor: OBRA_COLORS[i % OBRA_COLORS.length] }}
                          />
                          {o.name}
                        </span>
                      ))}
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <span className="inline-block h-2.5 w-0.5 bg-red-500" /> Hoje
                    </span>
                  </div>
                </div>

                <GanttChart
                  alocacoes={alocacoes}
                  zoom={zoom}
                  viewMode={viewMode}
                  obraColorMap={obraColorMap}
                />
              </div>
            )}

            {/* ── CONFLITOS ── */}
            {activeTab === 'conflitos' && (
              <div className="space-y-3">
                {conflicts.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-gray-400">
                    <div className="mb-3 rounded-full bg-green-100 p-4">
                      <Calendar size={28} className="text-green-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">Sem conflitos de alocação</p>
                    <p className="text-xs">Todos os recursos estão com dedicação dentro do limite.</p>
                  </div>
                ) : (
                  conflicts.map((c, i) => (
                    <div key={i} className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-full bg-red-100 p-1.5">
                          <AlertTriangle size={14} className="text-red-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-900">{c.userName}</p>
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                              {c.maxPct}% alocado
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            Sobreposição: {fmtDate(c.overlapStart)} → {fmtDate(c.overlapEnd)}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {c.allocations.map(a => (
                              <span
                                key={a.id}
                                className="rounded-md px-2 py-1 text-[10px] font-medium text-white"
                                style={{ backgroundColor: obraColorMap[a.obraId] ?? '#6B7280' }}
                              >
                                {a.obra.name} · {a.dedicacaoPct}%
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── SUGESTÕES ── */}
            {activeTab === 'sugestoes' && (
              <div className="space-y-6">
                {/* Conflitos a resolver */}
                {conflicts.length > 0 && (
                  <section>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <AlertTriangle size={15} className="text-red-500" />
                      Conflitos a resolver ({conflicts.length})
                    </h3>
                    <div className="space-y-2">
                      {conflicts.slice(0, 3).map((c, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                            {c.maxPct}%
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{c.userName}</p>
                            <p className="text-xs text-gray-400">
                              {c.allocations.map(a => a.obra.name).join(' + ')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Recursos ociosos */}
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <Users size={15} className="text-amber-500" />
                    Recursos sem alocação ativa ({idleUsers.length})
                  </h3>
                  {idleUsers.length === 0 ? (
                    <p className="text-xs text-gray-400">Todos os colaboradores têm alocação ativa.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {idleUsers.map(u => (
                        <div key={u.id} className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-600">
                            {u.name.charAt(0)}
                          </div>
                          <span className="text-xs text-gray-700">{u.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Obras sem equipe */}
                <section>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <HardHat size={15} className="text-blue-500" />
                    Obras em andamento sem alocação ({obrasWithoutTeam.length})
                  </h3>
                  {obrasWithoutTeam.length === 0 ? (
                    <p className="text-xs text-gray-400">Todas as obras em andamento têm equipe alocada.</p>
                  ) : (
                    <div className="space-y-2">
                      {obrasWithoutTeam.map(o => (
                        <div key={o.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{o.name}</p>
                            <p className="text-xs text-gray-400">
                              {o.startDate ? `Início: ${fmtDate(parseDate(o.startDate))}` : 'Sem data de início'}
                            </p>
                          </div>
                          <button
                            onClick={() => setShowModal(true)}
                            className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100"
                          >
                            Alocar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Dica */}
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <div className="flex gap-3">
                    <Lightbulb size={16} className="mt-0.5 flex-shrink-0 text-blue-500" />
                    <p className="text-xs text-blue-700">
                      Mantenha a dedicação total de cada colaborador em no máximo 100% para evitar sobrecarga.
                      Use períodos personalizados nas alocações para granularidade maior.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <NovaAlocacaoModal
          obras={obras}
          users={users}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
