'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plus, User, Calendar, ChevronDown } from 'lucide-react';

type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

interface Task {
  id: string;
  title: string;
  description: string | null;
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
  _count: { tasks: number };
}

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

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function KanbanPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [selectedObraId, setSelectedObraId] = useState<string>('all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium' as TaskPriority, dueDate: '' });

  // Load obras on mount
  useEffect(() => {
    api.get('/obras', { params: { limit: 100, status: 'em_andamento' } })
      .then(r => setObras(r.data.data ?? []))
      .catch(() => {});
  }, []);

  // Load tasks whenever obra selection changes
  useEffect(() => {
    setLoading(true);
    if (selectedObraId === 'all') {
      // Fetch tasks for all obras in parallel
      if (obras.length === 0) { setLoading(false); return; }
      Promise.all(
        obras.map(o =>
          api.get(`/obras/${o.id}/tasks`, { params: { limit: 200 } })
            .then(r => (r.data.data ?? []).map((t: Task) => ({ ...t, obraId: o.id })))
            .catch(() => [] as Task[])
        )
      ).then(results => {
        setTasks(results.flat());
        setLoading(false);
      });
    } else {
      api.get(`/obras/${selectedObraId}/tasks`, { params: { limit: 200 } })
        .then(r => { setTasks(r.data.data ?? []); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [selectedObraId, obras]);

  const selectedObra = obras.find(o => o.id === selectedObraId);

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.title.trim() || selectedObraId === 'all') return;
    setSubmitting(true);
    try {
      const body: Record<string, string> = { title: newTask.title, priority: newTask.priority };
      if (newTask.dueDate) body.dueDate = new Date(newTask.dueDate).toISOString();
      await api.post(`/obras/${selectedObraId}/tasks`, body);
      setNewTask({ title: '', priority: 'medium', dueDate: '' });
      setShowForm(false);
      // Refresh
      const r = await api.get(`/obras/${selectedObraId}/tasks`, { params: { limit: 200 } });
      setTasks(r.data.data ?? []);
    } catch { /* handled */ } finally { setSubmitting(false); }
  }

  // Group tasks by obra for "all" view
  const obraMap = Object.fromEntries(obras.map(o => [o.id, o]));

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-ber-gray/10 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-ber-carbon">Kanban</h1>
            <p className="text-xs text-ber-gray mt-0.5">Gestão de tarefas por obra</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Obra selector */}
            <div className="relative">
              <select
                value={selectedObraId}
                onChange={e => { setSelectedObraId(e.target.value); setShowForm(false); }}
                className="appearance-none rounded-lg border border-ber-gray/20 bg-ber-offwhite/80 pl-3 pr-8 py-2 text-sm font-semibold text-ber-carbon focus:border-ber-teal focus:outline-none min-w-[200px]"
              >
                <option value="all">🏗 Todas as obras ({obras.length})</option>
                {obras.map(o => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o._count?.tasks ?? 0})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ber-gray" />
            </div>

            {/* Add task (only when single obra selected) */}
            {selectedObraId !== 'all' && (
              <button
                onClick={() => setShowForm(p => !p)}
                className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-2 text-sm font-bold text-white hover:bg-ber-black transition-colors"
              >
                <Plus size={14} /> Nova tarefa
              </button>
            )}
          </div>
        </div>

        {/* Tab pills for obras (when ≤ 6) */}
        {obras.length > 0 && obras.length <= 6 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedObraId('all')}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${selectedObraId === 'all' ? 'bg-ber-carbon text-white' : 'bg-ber-offwhite text-ber-gray hover:bg-ber-gray/10'}`}
            >
              Todas
            </button>
            {obras.map(o => (
              <button key={o.id} onClick={() => setSelectedObraId(o.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${selectedObraId === o.id ? 'bg-ber-carbon text-white' : 'bg-ber-offwhite text-ber-gray hover:bg-ber-gray/10'}`}>
                {o.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New task form */}
      {showForm && selectedObraId !== 'all' && (
        <div className="border-b border-ber-gray/10 bg-white px-6 py-3">
          <form onSubmit={handleCreateTask} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Título *</label>
              <input type="text" value={newTask.title} onChange={e => setNewTask(p => ({...p, title: e.target.value}))}
                placeholder="Título da tarefa" required autoFocus
                className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Prioridade</label>
              <select value={newTask.priority} onChange={e => setNewTask(p => ({...p, priority: e.target.value as TaskPriority}))}
                className="mt-1 block rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:outline-none">
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Prazo</label>
              <input type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({...p, dueDate: e.target.value}))}
                className="mt-1 block rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:outline-none" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="rounded-md px-4 py-1.5 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
              <button type="submit" disabled={submitting}
                className="rounded-md bg-ber-olive px-4 py-1.5 text-sm font-bold text-ber-black hover:bg-ber-olive/80 disabled:opacity-50">
                {submitting ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Kanban board */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-ber-gray animate-pulse">Carregando tarefas...</p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2">
            <p className="text-sm text-ber-gray">Nenhuma tarefa encontrada.</p>
            {selectedObraId !== 'all' && (
              <button onClick={() => setShowForm(true)}
                className="text-sm font-semibold text-ber-teal hover:underline">
                + Criar primeira tarefa
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {KANBAN_COLUMNS.map(col => {
              const colTasks = tasks.filter(t => t.status === col.key);
              return (
                <div key={col.key} className={`rounded-xl ${col.color} p-3`}>
                  <div className="mb-3 flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-ber-gray">{col.label}</h3>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-ber-gray shadow-sm">
                      {colTasks.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map(task => {
                      const pCfg = PRIORITY_LABEL[task.priority] ?? PRIORITY_LABEL.medium;
                      const obra = task.obraId ? obraMap[task.obraId] : null;
                      return (
                        <div key={task.id}
                          className={`rounded-lg border-l-[3px] bg-white p-3 shadow-sm hover:shadow-md transition-shadow ${PRIORITY_STYLE[task.priority]}`}>
                          <p className="text-sm font-semibold text-ber-carbon leading-snug">{task.title}</p>
                          {/* Obra badge (only in "all" view) */}
                          {selectedObraId === 'all' && obra && (
                            <p className="mt-1 text-[10px] font-semibold text-ber-teal truncate">{obra.name}</p>
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
                      );
                    })}
                    {colTasks.length === 0 && (
                      <p className="py-6 text-center text-xs text-ber-gray/40">Sem tarefas</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
