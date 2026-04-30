'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { RefreshCw, Calendar, User, AlertTriangle, Clock, GripVertical } from 'lucide-react';
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

type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
type View = 'in_progress' | 'overdue' | 'this_week' | 'kanban';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position?: number;
  dueDate: string | null;
  assignee: { id: string; name: string } | null;
  obraId?: string;
}

interface Obra {
  id: string;
  name: string;
  status: string;
  _count: { tasks: number };
}

const VIEWS: { key: View; label: string }[] = [
  { key: 'in_progress', label: 'Em andamento' },
  { key: 'overdue',     label: 'Atrasadas' },
  { key: 'this_week',  label: 'Essa semana' },
  { key: 'kanban',     label: 'Kanban' },
];

const KANBAN_COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: 'todo',        label: 'A fazer',       color: 'bg-gray-100' },
  { key: 'in_progress', label: 'Em andamento',  color: 'bg-blue-50' },
  { key: 'review',      label: 'Revisão',       color: 'bg-amber-50' },
  { key: 'done',        label: 'Concluído',     color: 'bg-green-50' },
];

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  urgent: 'border-l-red-500',
  high:   'border-l-red-400',
  medium: 'border-l-ber-olive',
  low:    'border-l-ber-gray',
};

const PRIORITY_LABEL: Record<TaskPriority, { text: string; className: string }> = {
  urgent: { text: 'Urgente', className: 'text-red-600' },
  high:   { text: 'Alta',    className: 'text-red-500' },
  medium: { text: 'Média',   className: 'text-ber-olive' },
  low:    { text: 'Baixa',   className: 'text-ber-gray' },
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo:        'A fazer',
  in_progress: 'Em andamento',
  review:      'Revisão',
  done:        'Concluído',
};

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dueDate) < today;
}

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function filterTasks(tasks: Task[], view: View): Task[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  switch (view) {
    case 'in_progress':
      return tasks.filter(t => t.status === 'in_progress');
    case 'overdue':
      return tasks.filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== 'done');
    case 'this_week':
      return tasks.filter(t => {
        if (!t.dueDate || t.status === 'done') return false;
        const d = new Date(t.dueDate);
        return d >= today && d <= weekEnd;
      });
    case 'kanban':
      return tasks;
  }
}

/* ─── List Task Card ─── */

function ListTaskCard({ task, obraName }: { task: Task; obraName?: string }) {
  const pCfg = PRIORITY_LABEL[task.priority] ?? PRIORITY_LABEL.medium;
  const overdue = isOverdue(task.dueDate);

  return (
    <div className={`rounded-lg border-l-[3px] bg-white p-3 shadow-sm ${PRIORITY_STYLE[task.priority]}`}>
      <p className="text-sm font-semibold text-ber-carbon leading-snug">{task.title}</p>
      {obraName && (
        <p className="mt-0.5 text-[10px] font-semibold text-ber-teal truncate">{obraName}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ber-gray">
        <span className={`font-semibold ${pCfg.className}`}>{pCfg.text}</span>
        <span className="rounded-full bg-ber-bg px-1.5 py-0.5 text-[10px] font-medium">
          {STATUS_LABEL[task.status] ?? task.status}
        </span>
        {task.assignee && (
          <span className="flex items-center gap-1"><User size={10} />{task.assignee.name.split(' ')[0]}</span>
        )}
        {task.dueDate && (
          <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-semibold' : ''}`}>
            {overdue ? <AlertTriangle size={10} /> : <Calendar size={10} />}
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Sortable Task Card (for Kanban view) ─── */

function SortableTaskCard({ task, obraName }: { task: Task; obraName?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const pCfg = PRIORITY_LABEL[task.priority] ?? PRIORITY_LABEL.medium;

  return (
    <div ref={setNodeRef} style={style} {...attributes}
      className={`group rounded-lg border-l-[3px] bg-white p-3 shadow-sm hover:shadow-md transition-shadow ${PRIORITY_STYLE[task.priority]}`}>
      <div className="flex items-start gap-2">
        <button {...listeners} className="mt-0.5 shrink-0 cursor-grab text-ber-gray/30 opacity-0 group-hover:opacity-100 transition-opacity touch-none" title="Arrastar">
          <GripVertical size={14} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ber-carbon leading-snug">{task.title}</p>
          {obraName && (
            <p className="mt-1 text-[10px] font-semibold text-ber-teal truncate">{obraName}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ber-gray">
            <span className={`font-semibold ${pCfg.className}`}>{pCfg.text}</span>
            {task.assignee && (
              <span className="flex items-center gap-1"><User size={10} />{task.assignee.name.split(' ')[0]}</span>
            )}
            {task.dueDate && (
              <span className="flex items-center gap-1"><Calendar size={10} />{formatDate(task.dueDate)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`min-h-[100px] rounded-lg transition-colors ${isOver ? 'bg-ber-olive/10 ring-2 ring-ber-olive/30' : ''}`}>
      {children}
    </div>
  );
}

function TaskCardOverlay({ task }: { task: Task }) {
  const pCfg = PRIORITY_LABEL[task.priority] ?? PRIORITY_LABEL.medium;
  return (
    <div className={`rounded-lg border-l-[3px] bg-white p-3 shadow-xl ${PRIORITY_STYLE[task.priority]} w-[280px]`}>
      <p className="text-sm font-semibold text-ber-carbon leading-snug">{task.title}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-ber-gray">
        <span className={`font-semibold ${pCfg.className}`}>{pCfg.text}</span>
      </div>
    </div>
  );
}

/* ─── Main ─── */

export default function KanbanPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [selectedObraId, setSelectedObraId] = useState<string>('all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [view, setView] = useState<View>('in_progress');
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    api.get('/obras', { params: { limit: 100, status: 'em_andamento' } })
      .then(r => setObras(r.data.data ?? []))
      .catch(() => {});
  }, []);

  const loadTasks = useCallback((obraId: string, obrasArr: Obra[]) => {
    setLoading(true);
    if (obraId === 'all') {
      if (obrasArr.length === 0) { setLoading(false); return; }
      Promise.all(
        obrasArr.map(o =>
          api.get(`/obras/${o.id}/tasks`, { params: { limit: 500 } })
            .then(r => (r.data.data ?? []).map((t: Task) => ({ ...t, obraId: o.id })))
            .catch(() => [] as Task[])
        )
      ).then(results => {
        setTasks(results.flat());
        setLoading(false);
      });
    } else {
      api.get(`/obras/${obraId}/tasks`, { params: { limit: 500 } })
        .then(r => { setTasks(r.data.data ?? []); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    loadTasks(selectedObraId, obras);
  }, [selectedObraId, obras, loadTasks]);

  const obraMap = Object.fromEntries(obras.map(o => [o.id, o]));
  const visibleTasks = filterTasks(tasks, view);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await api.post('/clickup/sync');
      const s = r.data.summary;
      setSyncMsg(`Sincronizado: ${s.obras} obras, +${s.inserted} novas, ~${s.updated} atualizadas`);
      loadTasks(selectedObraId, obras);
    } catch {
      setSyncMsg('Erro ao sincronizar com ClickUp');
    } finally {
      setSyncing(false);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find(t => t.id === event.active.id) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const draggedTask = tasks.find(t => t.id === active.id);
    if (!draggedTask) return;

    let targetStatus: TaskStatus;
    const overTask = tasks.find(t => t.id === over.id);
    if (overTask) {
      targetStatus = overTask.status;
    } else if (KANBAN_COLUMNS.some(c => c.key === over.id)) {
      targetStatus = over.id as TaskStatus;
    } else {
      return;
    }

    const oldStatus = draggedTask.status;
    setTasks(prev => {
      const updated = prev.map(t => t.id === draggedTask.id ? { ...t, status: targetStatus } : t);
      if (overTask && overTask.id !== draggedTask.id) {
        const colTasks = updated.filter(t => t.status === targetStatus);
        const oldIdx = colTasks.findIndex(t => t.id === draggedTask.id);
        const newIdx = colTasks.findIndex(t => t.id === overTask.id);
        if (oldIdx !== -1 && newIdx !== -1) {
          const reordered = arrayMove(colTasks, oldIdx, newIdx);
          return [...updated.filter(t => t.status !== targetStatus), ...reordered];
        }
      }
      return updated;
    });

    const obraId = draggedTask.obraId ?? selectedObraId;
    if (obraId && obraId !== 'all') {
      try {
        const body: { position: number; status?: TaskStatus } = { position: 0 };
        if (oldStatus !== targetStatus) body.status = targetStatus;
        await api.patch(`/obras/${obraId}/tasks/${draggedTask.id}/position`, body);
      } catch { /* silent — optimistic update stays */ }
    }
  }

  // Group tasks by obra for multi-obra list views
  function groupByObra(taskList: Task[]): { obraId: string; obraName: string; tasks: Task[] }[] {
    const groups: Record<string, { obraId: string; obraName: string; tasks: Task[] }> = {};
    for (const t of taskList) {
      const key = t.obraId ?? 'unknown';
      if (!groups[key]) groups[key] = { obraId: key, obraName: obraMap[key]?.name ?? key, tasks: [] };
      groups[key].tasks.push(t);
    }
    return Object.values(groups).sort((a, b) => a.obraName.localeCompare(b.obraName));
  }

  const showAllObras = selectedObraId === 'all';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-ber-border bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-ber-carbon">Kanban</h1>
            <p className="text-xs text-ber-gray mt-0.5">Tarefas sincronizadas do ClickUp</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <select
                value={selectedObraId}
                onChange={e => setSelectedObraId(e.target.value)}
                className="appearance-none rounded-lg border border-ber-gray/20 bg-ber-bg pl-3 pr-8 py-2 text-sm font-semibold text-ber-carbon focus:border-ber-teal focus:outline-none min-w-[200px]"
              >
                <option value="all">Todas as obras ({obras.length})</option>
                {obras.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg border border-ber-teal/30 bg-ber-teal/5 px-3 py-2 text-sm font-bold text-ber-teal hover:bg-ber-teal/10 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizando...' : 'Sync ClickUp'}
            </button>
          </div>
        </div>

        {syncMsg && (
          <p className={`mt-2 text-xs font-medium ${syncMsg.startsWith('Erro') ? 'text-red-500' : 'text-ber-teal'}`}>
            {syncMsg}
          </p>
        )}

        {/* View tabs */}
        <div className="mt-3 flex gap-1 border-b border-transparent">
          {VIEWS.map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`rounded-t-lg px-4 py-2 text-xs font-bold transition-colors ${
                view === v.key
                  ? 'bg-ber-carbon text-white'
                  : 'text-ber-gray hover:bg-ber-bg'
              }`}
            >
              {v.label}
              {v.key !== 'kanban' && (
                <span className="ml-1.5 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                  {filterTasks(tasks, v.key).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-ber-gray animate-pulse">Carregando tarefas...</p>
          </div>
        ) : view === 'kanban' ? (
          /* ─── Kanban 4-column board ─── */
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {KANBAN_COLUMNS.map(col => {
                const colTasks = visibleTasks.filter(t => t.status === col.key);
                return (
                  <div key={col.key} className={`rounded-xl ${col.color} p-3`}>
                    <div className="mb-3 flex items-center justify-between px-1">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-ber-gray">{col.label}</h3>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-ber-gray shadow-sm">
                        {colTasks.length}
                      </span>
                    </div>
                    <DroppableColumn id={col.key}>
                      <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                        <div className="space-y-2">
                          {colTasks.map(task => (
                            <SortableTaskCard
                              key={task.id}
                              task={task}
                              obraName={showAllObras && task.obraId ? obraMap[task.obraId]?.name : undefined}
                            />
                          ))}
                          {colTasks.length === 0 && (
                            <p className="py-6 text-center text-xs text-ber-gray/40">Sem tarefas</p>
                          )}
                        </div>
                      </SortableContext>
                    </DroppableColumn>
                  </div>
                );
              })}
            </div>
            <DragOverlay>
              {activeTask && <TaskCardOverlay task={activeTask} />}
            </DragOverlay>
          </DndContext>
        ) : visibleTasks.length === 0 ? (
          /* ─── Empty state ─── */
          <div className="flex h-40 flex-col items-center justify-center gap-2">
            <p className="text-sm text-ber-gray">
              {view === 'overdue' ? 'Nenhuma tarefa atrasada.' :
               view === 'this_week' ? 'Nenhuma tarefa para essa semana.' :
               'Nenhuma tarefa em andamento.'}
            </p>
          </div>
        ) : showAllObras ? (
          /* ─── List view — grouped by obra ─── */
          <div className="space-y-6">
            {groupByObra(visibleTasks).map(group => (
              <div key={group.obraId}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-sm font-bold text-ber-carbon">{group.obraName}</h2>
                  <span className="rounded-full bg-ber-border px-2 py-0.5 text-[10px] font-bold text-ber-gray">
                    {group.tasks.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {group.tasks.map(task => (
                    <ListTaskCard key={task.id} task={task} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ─── List view — single obra ─── */
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleTasks.map(task => (
              <ListTaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
