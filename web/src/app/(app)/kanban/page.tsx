'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import {
  RefreshCw, ChevronLeft, GripVertical, AlertTriangle, Calendar, User,
  CheckCircle2, Clock3, CircleDot, Circle,
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent, DragOverlay, DragStartEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';

/* ─── Types ─── */

type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
type ObraDetailView = 'scrum' | 'cronograma' | 'burndown';

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
  obraId?: string;
}

interface Obra {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  expectedEndDate: string | null;
  progressPercent: number;
  _count: { tasks: number };
}

interface Etapa {
  id: string;
  name: string;
  order: number;
  status: string;
  estimatedDays: number | null;
  startDate: string | null;
  endDate: string | null;
  estimatedEndDate: string | null;
}

/* ─── Constants ─── */

const KANBAN_COLUMNS: { key: TaskStatus; label: string; color: string; bg: string }[] = [
  { key: 'todo',        label: 'A fazer',      color: 'text-ber-gray',   bg: 'bg-gray-50'   },
  { key: 'in_progress', label: 'Em andamento', color: 'text-blue-600',   bg: 'bg-blue-50'   },
  { key: 'review',      label: 'Revisão',      color: 'text-amber-600',  bg: 'bg-amber-50'  },
  { key: 'done',        label: 'Concluído',    color: 'text-green-600',  bg: 'bg-green-50'  },
];

const PRIORITY_BORDER: Record<TaskPriority, string> = {
  urgent: 'border-l-red-500',
  high:   'border-l-red-400',
  medium: 'border-l-ber-olive',
  low:    'border-l-ber-gray/40',
};

const PRIORITY_DOT: Record<TaskPriority, string> = {
  urgent: 'bg-red-500',
  high:   'bg-red-400',
  medium: 'bg-ber-olive',
  low:    'bg-ber-gray/40',
};

const ETAPA_STATUS_COLOR: Record<string, string> = {
  aprovada:              'bg-green-500',
  aguardando_aprovacao:  'bg-amber-400',
  em_andamento:          'bg-blue-500',
  nao_iniciada:          'bg-gray-200',
};

const ETAPA_STATUS_LABEL: Record<string, string> = {
  aprovada:             'Aprovada',
  aguardando_aprovacao: 'Aguardando',
  em_andamento:         'Em andamento',
  nao_iniciada:         'Não iniciada',
};

/* ─── Helpers ─── */

function isOverdue(d: string | null) {
  if (!d) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(d) < today;
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function fmtMonth(d: Date) {
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}

/* ─── Gantt Chart ─── */

function GanttChart({ etapas, obra }: { etapas: Etapa[]; obra: Obra }) {
  if (etapas.length === 0) {
    return <p className="py-10 text-center text-sm text-ber-gray">Nenhuma etapa cadastrada no sequenciamento.</p>;
  }

  // Build timeline bounds
  const today = new Date();
  const obraStart = obra.startDate ? new Date(obra.startDate) : null;
  const obraEnd   = obra.expectedEndDate ? new Date(obra.expectedEndDate) : null;

  // Assign estimated dates to etapas without real dates using cumulative estimation from obraStart
  let cumDays = 0;
  const etapasDated = etapas.map(e => {
    let barStart: Date | null = null;
    let barEnd: Date | null = null;

    if (e.startDate) {
      barStart = new Date(e.startDate);
      barEnd = e.endDate ? new Date(e.endDate) : e.estimatedEndDate ? new Date(e.estimatedEndDate) : null;
    } else if (obraStart && e.estimatedDays) {
      barStart = addDays(obraStart, cumDays);
      barEnd   = addDays(obraStart, cumDays + e.estimatedDays);
    }
    cumDays += e.estimatedDays ?? 0;
    return { ...e, barStart, barEnd };
  });

  const allDates = etapasDated.flatMap(e => [e.barStart, e.barEnd]).filter(Boolean) as Date[];
  if (obraStart) allDates.push(obraStart);
  if (obraEnd) allDates.push(obraEnd);

  if (allDates.length === 0) {
    return <p className="py-10 text-center text-sm text-ber-gray">Adicione datas de início à obra para visualizar o cronograma.</p>;
  }

  const rangeStart = new Date(Math.min(...allDates.map(d => d.getTime())));
  const rangeEnd   = new Date(Math.max(...allDates.map(d => d.getTime())));
  // Pad a bit
  rangeStart.setDate(rangeStart.getDate() - 3);
  rangeEnd.setDate(rangeEnd.getDate() + 7);

  const totalDays = Math.max(1, (rangeEnd.getTime() - rangeStart.getTime()) / 86400000);

  function pct(d: Date | null) {
    if (!d) return 0;
    return Math.max(0, Math.min(100, (d.getTime() - rangeStart.getTime()) / 86400000 / totalDays * 100));
  }

  // Month markers
  const months: { label: string; pct: number }[] = [];
  const cur = new Date(rangeStart);
  cur.setDate(1);
  while (cur <= rangeEnd) {
    months.push({ label: fmtMonth(cur), pct: pct(cur) });
    cur.setMonth(cur.getMonth() + 1);
  }

  const todayPct = pct(today);
  const isTodayInRange = today >= rangeStart && today <= rangeEnd;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Header */}
        <div className="flex mb-1">
          <div className="w-36 shrink-0" />
          <div className="relative flex-1 h-5">
            {months.map(m => (
              <span key={m.label} style={{ left: `${m.pct}%` }}
                className="absolute top-0 text-[10px] font-semibold uppercase tracking-wide text-ber-gray/70 whitespace-nowrap">
                {m.label}
              </span>
            ))}
          </div>
        </div>

        {/* Gridlines + etapa rows */}
        <div className="relative">
          {/* Month gridlines */}
          <div className="absolute inset-0 flex pointer-events-none">
            <div className="w-36 shrink-0" />
            <div className="relative flex-1">
              {months.map(m => (
                <div key={m.label} style={{ left: `${m.pct}%` }}
                  className="absolute top-0 bottom-0 w-px bg-ber-border/60" />
              ))}
              {/* Today line */}
              {isTodayInRange && (
                <div style={{ left: `${todayPct}%` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-ber-teal/70 z-10" />
              )}
            </div>
          </div>

          {/* Rows */}
          <div className="space-y-1">
            {etapasDated.map((etapa, i) => {
              const color = ETAPA_STATUS_COLOR[etapa.status] ?? 'bg-gray-200';
              const hasBar = etapa.barStart !== null;
              const leftPct = pct(etapa.barStart);
              const widthPct = etapa.barEnd && etapa.barStart
                ? Math.max(0.8, pct(etapa.barEnd) - leftPct)
                : 1.5;

              return (
                <div key={etapa.id} className={`flex items-center h-8 ${i % 2 === 0 ? 'bg-white' : 'bg-ber-bg/50'} rounded`}>
                  <div className="w-36 shrink-0 px-2 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
                    <span className="text-xs font-medium text-ber-carbon truncate" title={etapa.name}>
                      {etapa.name}
                    </span>
                  </div>
                  <div className="relative flex-1 h-full flex items-center">
                    {hasBar && (
                      <div
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                        title={`${ETAPA_STATUS_LABEL[etapa.status] ?? etapa.status} · ${fmtDate(etapa.startDate ?? etapa.barStart?.toISOString() ?? null)} → ${fmtDate(etapa.endDate ?? etapa.estimatedEndDate ?? etapa.barEnd?.toISOString() ?? null)}`}
                        className={`absolute h-5 rounded ${color} opacity-85 cursor-default transition-opacity hover:opacity-100`}
                      />
                    )}
                    {!hasBar && (
                      <span className="ml-2 text-[10px] text-ber-gray/50 italic">sem data</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 pl-36">
          {Object.entries(ETAPA_STATUS_LABEL).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5 text-[10px] text-ber-gray">
              <span className={`w-3 h-3 rounded-sm ${ETAPA_STATUS_COLOR[k]}`} />
              {v}
            </span>
          ))}
          {isTodayInRange && (
            <span className="flex items-center gap-1.5 text-[10px] text-ber-teal font-semibold">
              <span className="w-0.5 h-3 bg-ber-teal rounded" />
              Hoje
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Scrum board ─── */

function DroppableCol({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`min-h-[80px] rounded-lg transition-colors ${isOver ? 'bg-ber-olive/10 ring-2 ring-ber-olive/30' : ''}`}>
      {children}
    </div>
  );
}

function SortableCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id, data: { status: task.status },
  });
  const overdue = isOverdue(task.dueDate);
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      className={`group rounded-lg border-l-[3px] bg-white p-3 shadow-sm hover:shadow-md transition-shadow ${PRIORITY_BORDER[task.priority]}`}>
      <div className="flex items-start gap-2">
        <button {...listeners}
          className="mt-0.5 shrink-0 cursor-grab text-ber-gray/30 opacity-0 group-hover:opacity-100 transition-opacity touch-none">
          <GripVertical size={13} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ber-carbon leading-snug">{task.title}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ber-gray">
            <span className={`w-2 h-2 rounded-full mt-0.5 ${PRIORITY_DOT[task.priority]}`} />
            {task.assignee && <span className="flex items-center gap-1"><User size={10} />{task.assignee.name.split(' ')[0]}</span>}
            {task.dueDate && (
              <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-semibold' : ''}`}>
                {overdue ? <AlertTriangle size={10} /> : <Calendar size={10} />}
                {fmtDate(task.dueDate)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Obra card (main grid) ─── */

function ObraCard({ obra, tasks, onClick }: { obra: Obra; tasks: Task[]; onClick: () => void }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const obraTasks = tasks.filter(t => t.obraId === obra.id);
  const todo       = obraTasks.filter(t => t.status === 'todo').length;
  const inProgress = obraTasks.filter(t => t.status === 'in_progress').length;
  const done       = obraTasks.filter(t => t.status === 'done').length;
  const overdue    = obraTasks.filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== 'done').length;
  const total      = obraTasks.length;

  return (
    <button onClick={onClick}
      className="group w-full text-left rounded-2xl border border-ber-border bg-white p-5 shadow-sm hover:shadow-md hover:border-ber-teal/40 transition-all">
      {/* Name + status */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <h3 className="text-sm font-black text-ber-carbon leading-snug group-hover:text-ber-teal transition-colors">
          {obra.name}
        </h3>
        {overdue > 0 && (
          <span className="shrink-0 flex items-center gap-1 rounded-full bg-red-50 border border-red-100 px-2 py-0.5 text-[10px] font-bold text-red-500">
            <AlertTriangle size={9} /> {overdue} atrasada{overdue !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] font-semibold text-ber-gray mb-1">
          <span>Progresso ClickUp</span>
          <span>{obra.progressPercent}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-ber-border overflow-hidden">
          <div style={{ width: `${obra.progressPercent}%` }}
            className="h-full rounded-full bg-ber-teal transition-all" />
        </div>
      </div>

      {/* Task stats */}
      <div className="grid grid-cols-4 gap-1 text-center">
        {[
          { icon: Circle, label: 'A fazer', count: todo, color: 'text-ber-gray' },
          { icon: CircleDot, label: 'Andamento', count: inProgress, color: 'text-blue-500' },
          { icon: Clock3, label: 'Revisão', count: obraTasks.filter(t => t.status === 'review').length, color: 'text-amber-500' },
          { icon: CheckCircle2, label: 'Feitas', count: done, color: 'text-green-500' },
        ].map(({ icon: Icon, label, count, color }) => (
          <div key={label} className="rounded-lg bg-ber-bg py-2">
            <Icon size={14} className={`mx-auto mb-0.5 ${color}`} />
            <p className="text-base font-black text-ber-carbon">{count}</p>
            <p className="text-[9px] text-ber-gray leading-none">{label}</p>
          </div>
        ))}
      </div>

      {/* Dates */}
      {(obra.startDate || obra.expectedEndDate) && (
        <div className="mt-3 flex gap-3 text-[10px] text-ber-gray border-t border-ber-border pt-3">
          {obra.startDate && <span><span className="font-semibold">Início:</span> {fmtDate(obra.startDate)}</span>}
          {obra.expectedEndDate && <span><span className="font-semibold">Prazo:</span> {fmtDate(obra.expectedEndDate)}</span>}
        </div>
      )}
    </button>
  );
}

/* ─── Main page ─── */

export default function PainelDeGestao() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [selectedObra, setSelectedObra] = useState<Obra | null>(null);
  const [obraView, setObraView] = useState<ObraDetailView>('scrum');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingEtapas, setLoadingEtapas] = useState(false);
  const [burndownData, setBurndownData] = useState<any>(null);
  const [loadingBurndown, setLoadingBurndown] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Load obras + their tasks for the grid stats
  useEffect(() => {
    api.get('/obras', { params: { limit: 100, status: 'em_andamento' } })
      .then(r => {
        const obrasData: Obra[] = r.data.data ?? [];
        setObras(obrasData);
        // Load tasks for all obras to show stats on cards
        Promise.all(
          obrasData.map(o =>
            api.get(`/obras/${o.id}/tasks`, { params: { limit: 500 } })
              .then(r2 => (r2.data.data ?? []).map((t: Task) => ({ ...t, obraId: o.id })))
              .catch(() => [] as Task[])
          )
        ).then(res => setAllTasks(res.flat()));
      })
      .catch(() => {});
  }, []);

  // Load tasks + etapas when an obra is selected
  const openObra = useCallback(async (obra: Obra) => {
    setSelectedObra(obra);
    setObraView('scrum');
    setLoadingTasks(true);
    setLoadingEtapas(true);

    const [tasksRes, seqRes] = await Promise.allSettled([
      api.get(`/obras/${obra.id}/tasks`, { params: { limit: 500 } }),
      api.get(`/obras/${obra.id}/sequenciamento`),
    ]);

    setTasks(tasksRes.status === 'fulfilled' ? tasksRes.value.data.data ?? [] : []);
    setLoadingTasks(false);

    if (seqRes.status === 'fulfilled' && seqRes.value.data.data?.etapas) {
      setEtapas(seqRes.value.data.data.etapas);
    } else {
      setEtapas([]);
    }
    setLoadingEtapas(false);
  }, []);

  function closeObra() {
    setSelectedObra(null);
    setTasks([]);
    setEtapas([]);
    setBurndownData(null);
  }

  async function fetchBurndown(obraId: string) {
    setLoadingBurndown(true);
    try {
      const r = await api.get(`/obras/${obraId}/tasks/burndown`);
      setBurndownData(r.data.data ?? r.data);
    } catch {
      setBurndownData({ hasData: false, reason: 'error' });
    } finally {
      setLoadingBurndown(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await api.post('/clickup/sync');
      const s = r.data.summary;
      setSyncMsg(`Sincronizado: ${s.obras} obras · +${s.inserted} novas · ~${s.updated} atualizadas`);
      // Reload
      const r2 = await api.get('/obras', { params: { limit: 100, status: 'em_andamento' } });
      setObras(r2.data.data ?? []);
      if (selectedObra) {
        const r3 = await api.get(`/obras/${selectedObra.id}/tasks`, { params: { limit: 500 } });
        setTasks(r3.data.data ?? []);
      }
    } catch {
      setSyncMsg('Erro ao sincronizar com ClickUp');
    } finally {
      setSyncing(false);
    }
  }

  // DnD handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find(t => t.id === event.active.id) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || !selectedObra) return;
    const dragged = tasks.find(t => t.id === active.id);
    if (!dragged) return;

    const overTask = tasks.find(t => t.id === over.id);
    let targetStatus: TaskStatus;
    if (overTask) targetStatus = overTask.status;
    else if (KANBAN_COLUMNS.some(c => c.key === over.id)) targetStatus = over.id as TaskStatus;
    else return;

    setTasks(prev => {
      const updated = prev.map(t => t.id === dragged.id ? { ...t, status: targetStatus } : t);
      if (overTask && overTask.id !== dragged.id) {
        const col = updated.filter(t => t.status === targetStatus);
        const oldI = col.findIndex(t => t.id === dragged.id);
        const newI = col.findIndex(t => t.id === overTask.id);
        if (oldI !== -1 && newI !== -1) {
          const reordered = arrayMove(col, oldI, newI);
          return [...updated.filter(t => t.status !== targetStatus), ...reordered];
        }
      }
      return updated;
    });

    try {
      const body: Record<string, unknown> = { position: 0 };
      if (dragged.status !== targetStatus) body.status = targetStatus;
      await api.patch(`/obras/${selectedObra.id}/tasks/${dragged.id}/position`, body);
    } catch { /* silent */ }
  }

  /* ─── Render ─── */

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <div className="border-b border-ber-border bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {selectedObra && (
              <button onClick={closeObra}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-ber-gray hover:bg-ber-bg transition-colors">
                <ChevronLeft size={16} /> Obras
              </button>
            )}
            <div>
              <h1 className="text-xl font-black text-ber-carbon">
                {selectedObra ? selectedObra.name : 'Painel de Gestão'}
              </h1>
              {!selectedObra && (
                <p className="text-xs text-ber-gray mt-0.5">{obras.length} obras em andamento</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {syncMsg && (
              <p className={`text-xs font-medium ${syncMsg.startsWith('Erro') ? 'text-red-500' : 'text-ber-teal'}`}>
                {syncMsg}
              </p>
            )}
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg border border-ber-teal/30 bg-ber-teal/5 px-3 py-2 text-sm font-bold text-ber-teal hover:bg-ber-teal/10 transition-colors disabled:opacity-50">
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{syncing ? 'Sincronizando...' : 'Sync ClickUp'}</span>
            </button>
          </div>
        </div>

        {/* Sub-tabs when obra selected */}
        {selectedObra && (
          <div className="mt-3 flex gap-1">
            {([
              { key: 'scrum', label: 'Scrum' },
              { key: 'cronograma', label: 'Cronograma (Gantt)' },
              { key: 'burndown', label: 'Burndown' },
            ] as { key: ObraDetailView; label: string }[]).map(({ key, label }) => (
              <button key={key} onClick={() => {
                setObraView(key);
                if (key === 'burndown' && burndownData === null && selectedObra) {
                  fetchBurndown(selectedObra.id);
                }
              }}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-colors ${
                  obraView === key ? 'bg-ber-carbon text-white' : 'text-ber-gray hover:bg-ber-bg'
                }`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto px-6 py-5">

        {/* ── Obra grid ── */}
        {!selectedObra && (
          obras.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-ber-gray animate-pulse">Carregando obras...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {obras.map(obra => (
                <ObraCard
                  key={obra.id}
                  obra={obra}
                  tasks={allTasks}
                  onClick={() => openObra(obra)}
                />
              ))}
            </div>
          )
        )}

        {/* ── Obra detail ── */}
        {selectedObra && (
          <>
            {/* Scrum board */}
            {obraView === 'scrum' && (
              loadingTasks ? (
                <div className="flex h-40 items-center justify-center">
                  <p className="text-sm text-ber-gray animate-pulse">Carregando tarefas...</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {KANBAN_COLUMNS.map(col => {
                      const colTasks = tasks.filter(t => t.status === col.key);
                      return (
                        <div key={col.key} className={`rounded-xl ${col.bg} p-3`}>
                          <div className="mb-3 flex items-center justify-between px-1">
                            <h3 className={`text-xs font-bold uppercase tracking-wide ${col.color}`}>{col.label}</h3>
                            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-ber-gray shadow-sm">
                              {colTasks.length}
                            </span>
                          </div>
                          <DroppableCol id={col.key}>
                            <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                              <div className="space-y-2">
                                {colTasks.map(task => <SortableCard key={task.id} task={task} />)}
                                {colTasks.length === 0 && (
                                  <p className="py-6 text-center text-xs text-ber-gray/40">Sem tarefas</p>
                                )}
                              </div>
                            </SortableContext>
                          </DroppableCol>
                        </div>
                      );
                    })}
                  </div>
                  <DragOverlay>
                    {activeTask && (
                      <div className={`rounded-lg border-l-[3px] bg-white p-3 shadow-xl ${PRIORITY_BORDER[activeTask.priority]} w-[280px]`}>
                        <p className="text-sm font-semibold text-ber-carbon">{activeTask.title}</p>
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
              )
            )}

            {/* Cronograma / Gantt */}
            {obraView === 'cronograma' && (
              <div className="rounded-2xl border border-ber-border bg-white p-6">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-ber-carbon">Cronograma de Etapas</h2>
                    <p className="text-xs text-ber-gray mt-0.5">Baseado no sequenciamento da obra</p>
                  </div>
                  {selectedObra.expectedEndDate && (
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Prazo final</p>
                      <p className="text-sm font-black text-ber-carbon">{fmtDate(selectedObra.expectedEndDate)}</p>
                    </div>
                  )}
                </div>
                {loadingEtapas ? (
                  <p className="py-10 text-center text-sm text-ber-gray animate-pulse">Carregando cronograma...</p>
                ) : (
                  <GanttChart etapas={etapas} obra={selectedObra} />
                )}
              </div>
            )}

            {/* Burndown */}
            {obraView === 'burndown' && (
              <div className="rounded-2xl border border-ber-border bg-white p-6">
                <div className="mb-5">
                  <h2 className="text-sm font-bold text-ber-carbon">Burndown de Tarefas</h2>
                  <p className="text-xs text-ber-gray mt-0.5">Progresso real vs ideal ao longo do tempo</p>
                </div>

                {loadingBurndown && (
                  <div className="flex flex-col gap-3 animate-pulse">
                    <div className="h-8 w-48 rounded bg-ber-border" />
                    <div className="h-64 rounded bg-ber-border" />
                  </div>
                )}

                {!loadingBurndown && burndownData && !burndownData.hasData && (
                  <p className="py-10 text-center text-sm text-ber-gray">
                    {burndownData.reason === 'missing_dates'
                      ? 'Configure as datas de início e prazo da obra para ver o burndown.'
                      : 'Nenhuma tarefa cadastrada.'}
                  </p>
                )}

                {!loadingBurndown && burndownData?.hasData && (() => {
                  const bd = burndownData;
                  const lineColor = bd.status === 'ahead' ? '#22C55E' : bd.status === 'behind' ? '#EF4444' : '#14B8A6';
                  const areaColor = bd.status === 'behind' ? '#FCA5A5' : '#5EEAD4';
                  const todayStr = new Date().toISOString().split('T')[0];
                  const todayInSeries = bd.series.some((s: any) => s.date === todayStr);

                  return (
                    <>
                      {/* Metrics */}
                      <div className="mb-5 flex flex-wrap items-center gap-3">
                        <div className="rounded-xl border border-ber-border px-4 py-3 text-center min-w-[110px]">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Concluídas</p>
                          <p className="text-2xl font-black text-ber-carbon">{bd.pctComplete}%</p>
                        </div>
                        <div className="rounded-xl border border-ber-border px-4 py-3 text-center min-w-[110px]">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Esperado hoje</p>
                          <p className="text-2xl font-black text-ber-carbon">{bd.pctExpected}%</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                          bd.status === 'ahead' ? 'bg-green-50 text-green-700 border border-green-200'
                          : bd.status === 'behind' ? 'bg-red-50 text-red-600 border border-red-200'
                          : 'bg-teal-50 text-teal-700 border border-teal-200'
                        }`}>
                          {bd.status === 'ahead' ? 'Adiantado' : bd.status === 'behind' ? 'Atrasado' : 'No prazo'}
                        </span>
                      </div>

                      {/* Chart */}
                      <ResponsiveContainer width="100%" height={280}>
                        <ComposedChart data={bd.series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            tickFormatter={(v: string) =>
                              new Date(v + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                            }
                            interval="preserveStartEnd"
                          />
                          <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                          <Tooltip
                            formatter={(value: any, name: any) => [value, name === 'remaining' ? 'Restantes' : 'Ideal']}
                            labelFormatter={(label: any) =>
                              typeof label === 'string'
                                ? new Date(label + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                                : String(label)
                            }
                          />
                          <Legend formatter={(v) => v === 'remaining' ? 'Restantes' : 'Ideal'} />
                          {todayInSeries && (
                            <ReferenceLine x={todayStr} stroke="#14B8A6" strokeDasharray="4 2" label={{ value: 'Hoje', fontSize: 10, fill: '#14B8A6' }} />
                          )}
                          <Area
                            type="monotone"
                            dataKey="remaining"
                            fill={areaColor}
                            fillOpacity={0.15}
                            stroke="none"
                          />
                          <Line
                            type="monotone"
                            dataKey="ideal"
                            stroke="#9ca3af"
                            strokeDasharray="6 3"
                            dot={false}
                            strokeWidth={1.5}
                          />
                          <Line
                            type="monotone"
                            dataKey="remaining"
                            stroke={lineColor}
                            dot={false}
                            strokeWidth={2}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
