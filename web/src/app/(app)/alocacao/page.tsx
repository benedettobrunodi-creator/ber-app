'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, getUserPermissions } from '@/stores/authStore';
import api from '@/lib/api';
import {
  Plus, X, AlertTriangle, Calendar, Users, HardHat, UserPlus,
  ChevronDown, ChevronUp, Trash2,
} from 'lucide-react';

/* ─── Types ─── */

interface UserInfo {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
}

interface RecursoExterno {
  id: string;
  nome: string;
  funcao: 'gestor' | 'mestre' | 'ajudante';
  createdAt: string;
}

interface ObraInfo {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  expectedEndDate: string | null;
  dataInicioProjeto: string | null;
  dataFimProjeto: string | null;
  dataInicioObra: string | null;
  dataFimObra: string | null;
}

interface Alocacao {
  id: string;
  userId: string | null;
  recursoExternoId: string | null;
  obraId: string;
  cargoNaAlocacao: 'coordenador' | 'gestor' | 'mestre' | 'ajudante';
  fase: 'obra' | 'projeto' | 'ambas';
  dedicacaoPct: number;
  dataInicio: string | null;
  dataFim: string | null;
  createdAt: string;
  user: { id: string; name: string; role: string; avatarUrl: string | null } | null;
  recursoExterno: { id: string; nome: string; funcao: string } | null;
  obra: {
    id: string;
    name: string;
    status: string;
    startDate: string | null;
    expectedEndDate: string | null;
    dataInicioProjeto: string | null;
    dataFimProjeto: string | null;
    dataInicioObra: string | null;
    dataFimObra: string | null;
  };
}

type Zoom = 'semana' | 'mes' | 'trimestre';
type ViewMode = 'recurso' | 'obra';
type Tab = 'timeline' | 'obras' | 'recursos' | 'conflitos';

type ModalState =
  | { type: 'none' }
  | { type: 'create'; prefillRecurso?: string; prefillObraId?: string }
  | { type: 'edit'; alocacao: Alocacao };

/* ─── Constants ─── */

const CARGO_LABELS: Record<string, string> = {
  coordenador: 'Coordenador',
  gestor: 'Gestor de Obras',
  mestre: 'Mestre',
  ajudante: 'Ajudante',
};

const CARGO_SHORT: Record<string, string> = {
  coordenador: 'Coord',
  gestor: 'Gestor',
  mestre: 'Mestre',
  ajudante: 'Ajud',
};

const FUNCAO_LABELS: Record<string, string> = {
  gestor: 'Gestor',
  mestre: 'Mestre de Obras',
  ajudante: 'Ajudante',
};

const PX_PER_DAY: Record<Zoom, number> = { semana: 20, mes: 7, trimestre: 3 };
const CHART_DAYS: Record<Zoom, number> = { semana: 70, mes: 180, trimestre: 365 };
const CHART_OFFSET: Record<Zoom, number> = { semana: 14, mes: 30, trimestre: 30 };
const ROW_H = 48;
const HEADER_H = 40;
const LEFT_W = 200;

/* ─── Helpers ─── */

function recursoNome(a: Alocacao): string {
  return a.user?.name ?? a.recursoExterno?.nome ?? '—';
}

function recursoKey(a: Alocacao): string {
  return a.userId ?? a.recursoExternoId ?? a.id;
}

function recursoSelectKey(a: Alocacao): string {
  if (a.userId) return `user:${a.userId}`;
  if (a.recursoExternoId) return `externo:${a.recursoExternoId}`;
  return a.id;
}

function recursoRole(a: Alocacao): string {
  return a.user?.role ?? a.recursoExterno?.funcao ?? '';
}

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

function toInputDate(d: Date | null): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

/* ─── Phase-aware date resolution ─── */

function resolveStart(a: Alocacao): Date | null {
  if (a.dataInicio) return parseDate(a.dataInicio);
  if (a.fase === 'projeto') return parseDate(a.obra.dataInicioProjeto);
  if (a.fase === 'obra')
    return parseDate(a.obra.dataInicioObra) ?? parseDate(a.obra.startDate);
  return (
    parseDate(a.obra.dataInicioProjeto) ??
    parseDate(a.obra.dataInicioObra) ??
    parseDate(a.obra.startDate)
  );
}

function resolveEnd(a: Alocacao): Date | null {
  if (a.dataFim) return parseDate(a.dataFim);
  if (a.fase === 'projeto') return parseDate(a.obra.dataFimProjeto);
  if (a.fase === 'obra')
    return parseDate(a.obra.dataFimObra) ?? parseDate(a.obra.expectedEndDate);
  return (
    parseDate(a.obra.dataFimObra) ??
    parseDate(a.obra.expectedEndDate)
  );
}

/* ─── Conflict detection (phase-aware) ─── */

interface Conflict {
  recursoKey: string;
  recursoName: string;
  maxPct: number;
  allocations: Alocacao[];
  overlapStart: Date;
  overlapEnd: Date;
}

function detectConflicts(alocacoes: Alocacao[]): Conflict[] {
  const byRecurso = new Map<string, Alocacao[]>();
  for (const a of alocacoes) {
    const key = recursoKey(a);
    const list = byRecurso.get(key) ?? [];
    list.push(a);
    byRecurso.set(key, list);
  }

  const conflicts: Conflict[] = [];
  for (const [, alocs] of byRecurso.entries()) {
    if (alocs.length < 2) continue;
    for (let i = 0; i < alocs.length; i++) {
      for (let j = i + 1; j < alocs.length; j++) {
        const a = alocs[i];
        const b = alocs[j];
        const phasesOverlap =
          a.fase === 'ambas' || b.fase === 'ambas' || a.fase === b.fase;
        if (!phasesOverlap) continue;
        const aS = resolveStart(a);
        const aE = resolveEnd(a);
        const bS = resolveStart(b);
        const bE = resolveEnd(b);
        if (!aS || !aE || !bS || !bE) continue;
        if (aS <= bE && bS <= aE) {
          const totalPct = a.dedicacaoPct + b.dedicacaoPct;
          if (totalPct > 100) {
            conflicts.push({
              recursoKey: recursoKey(a),
              recursoName: recursoNome(a),
              maxPct: totalPct,
              allocations: [a, b],
              overlapStart: new Date(Math.max(aS.getTime(), bS.getTime())),
              overlapEnd: new Date(Math.min(aE.getTime(), bE.getTime())),
            });
          }
        }
      }
    }
  }
  return conflicts;
}

/* ─── Conflict preview (for modal) ─── */

function previewConflict(
  alocacoes: Alocacao[],
  opts: {
    excludeId?: string;
    recursoSelectKey: string;
    fase: string;
    dataInicio: string;
    dataFim: string;
    dedicacaoPct: number;
  },
): number {
  const { excludeId, recursoSelectKey: rKey, fase, dataInicio, dataFim, dedicacaoPct } = opts;
  if (!dataInicio || !dataFim || !rKey) return 0;
  const newStart = parseDate(dataInicio);
  const newEnd = parseDate(dataFim);
  if (!newStart || !newEnd) return 0;

  const candidates = alocacoes.filter(a => {
    if (excludeId && a.id === excludeId) return false;
    const aKey = a.userId ? `user:${a.userId}` : `externo:${a.recursoExternoId}`;
    if (aKey !== rKey) return false;
    const phasesOverlap =
      fase === 'ambas' || a.fase === 'ambas' || fase === a.fase;
    return phasesOverlap;
  });

  let sumInPeriod = dedicacaoPct;
  for (const c of candidates) {
    const cS = resolveStart(c);
    const cE = resolveEnd(c);
    if (!cS || !cE) continue;
    if (cS <= newEnd && newStart <= cE) {
      sumInPeriod += c.dedicacaoPct;
    }
  }
  return sumInPeriod;
}

/* ─── Modal ─── */

interface ModalProps {
  obras: ObraInfo[];
  users: UserInfo[];
  recursosExternos: RecursoExterno[];
  alocacoes: Alocacao[];
  modalState: ModalState;
  onClose: () => void;
  onSaved: (a: Alocacao) => void;
  onUpdated: (a: Alocacao) => void;
  onNewRecursoExterno: (r: RecursoExterno) => void;
}

function AlocacaoModal({
  obras,
  users,
  recursosExternos,
  alocacoes,
  modalState,
  onClose,
  onSaved,
  onUpdated,
  onNewRecursoExterno,
}: ModalProps) {
  const editAlocacao = modalState.type === 'edit' ? modalState.alocacao : null;
  const prefillRecurso =
    modalState.type === 'create' ? modalState.prefillRecurso : undefined;
  const prefillObraId =
    modalState.type === 'create' ? modalState.prefillObraId : undefined;

  const initialObraId = editAlocacao?.obraId ?? prefillObraId ?? '';
  const initialFase: 'obra' | 'projeto' | 'ambas' = editAlocacao?.fase ?? 'obra';
  const initialObra = obras.find(o => o.id === initialObraId) ?? null;
  const initialDates = (() => {
    if (editAlocacao) {
      return {
        dataInicio: editAlocacao.dataInicio?.slice(0, 10) ?? '',
        dataFim: editAlocacao.dataFim?.slice(0, 10) ?? '',
      };
    }
    if (initialObra) {
      return {
        dataInicio:
          initialObra.dataInicioObra?.slice(0, 10) ??
          initialObra.startDate?.slice(0, 10) ?? '',
        dataFim:
          initialObra.dataFimObra?.slice(0, 10) ??
          initialObra.expectedEndDate?.slice(0, 10) ?? '',
      };
    }
    return { dataInicio: '', dataFim: '' };
  })();

  const [form, setForm] = useState({
    recurso: editAlocacao
      ? recursoSelectKey(editAlocacao)
      : prefillRecurso ?? '',
    obraId: initialObraId,
    cargoNaAlocacao: (editAlocacao?.cargoNaAlocacao ?? 'gestor') as
      | 'coordenador'
      | 'gestor'
      | 'mestre'
      | 'ajudante',
    fase: initialFase,
    dedicacaoPct: editAlocacao?.dedicacaoPct ?? 100,
    dataInicio: initialDates.dataInicio,
    dataFim: initialDates.dataFim,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showNewExterno, setShowNewExterno] = useState(false);
  const [newExterno, setNewExterno] = useState({
    nome: '',
    cargo: 'mestre' as 'coordenador' | 'gestor' | 'mestre' | 'ajudante',
  });
  const [savingExterno, setSavingExterno] = useState(false);

  const selectedObra = obras.find(o => o.id === form.obraId) ?? null;
  const hasProjeto = !!selectedObra?.dataInicioProjeto;

  /* Auto-fill dates when obra or fase changes */
  function getDatesForFase(
    obra: ObraInfo | null,
    fase: 'obra' | 'projeto' | 'ambas',
  ): { dataInicio: string; dataFim: string } {
    if (!obra) return { dataInicio: '', dataFim: '' };
    if (fase === 'projeto') {
      return {
        dataInicio: obra.dataInicioProjeto?.slice(0, 10) ?? '',
        dataFim: obra.dataFimProjeto?.slice(0, 10) ?? '',
      };
    }
    if (fase === 'obra') {
      return {
        dataInicio:
          obra.dataInicioObra?.slice(0, 10) ?? obra.startDate?.slice(0, 10) ?? '',
        dataFim:
          obra.dataFimObra?.slice(0, 10) ?? obra.expectedEndDate?.slice(0, 10) ?? '',
      };
    }
    // ambas: from inicio_projeto to fim_obra
    return {
      dataInicio:
        obra.dataInicioProjeto?.slice(0, 10) ??
        obra.dataInicioObra?.slice(0, 10) ??
        obra.startDate?.slice(0, 10) ??
        '',
      dataFim:
        obra.dataFimObra?.slice(0, 10) ??
        obra.expectedEndDate?.slice(0, 10) ??
        '',
    };
  }

  function handleObraChange(obraId: string) {
    const obra = obras.find(o => o.id === obraId) ?? null;
    const hasP = !!obra?.dataInicioProjeto;
    const newFase = !hasP && form.fase !== 'obra' ? 'obra' : form.fase;
    const dates = getDatesForFase(obra, newFase as 'obra' | 'projeto' | 'ambas');
    setForm(f => ({ ...f, obraId, fase: newFase as typeof f.fase, ...dates }));
  }

  function handleFaseChange(fase: 'obra' | 'projeto' | 'ambas') {
    const dates = getDatesForFase(selectedObra, fase);
    setForm(f => ({ ...f, fase, ...dates }));
  }

  /* Capacidade restante */
  const totalAllocated = previewConflict(alocacoes, {
    excludeId: editAlocacao?.id,
    recursoSelectKey: form.recurso,
    fase: form.fase,
    dataInicio: form.dataInicio,
    dataFim: form.dataFim,
    dedicacaoPct: 0,
  });
  const restante = 100 - totalAllocated;

  /* Conflict warning */
  const previewTotal = previewConflict(alocacoes, {
    excludeId: editAlocacao?.id,
    recursoSelectKey: form.recurso,
    fase: form.fase,
    dataInicio: form.dataInicio,
    dataFim: form.dataFim,
    dedicacaoPct: form.dedicacaoPct,
  });
  const willConflict = previewTotal > 100;

  async function handleSaveNewExterno() {
    if (!newExterno.nome.trim()) return;
    setSavingExterno(true);
    const funcaoMap: Record<string, RecursoExterno['funcao']> = {
      coordenador: 'gestor',
      gestor: 'gestor',
      mestre: 'mestre',
      ajudante: 'ajudante',
    };
    try {
      const res = await api.post('/recursos-externos', {
        nome: newExterno.nome,
        funcao: funcaoMap[newExterno.cargo],
      });
      const criado: RecursoExterno = res.data.data;
      onNewRecursoExterno(criado);
      setForm(f => ({
        ...f,
        recurso: `externo:${criado.id}`,
        cargoNaAlocacao: newExterno.cargo,
      }));
      setShowNewExterno(false);
      setNewExterno({ nome: '', cargo: 'mestre' });
    } catch {
      /* silently ignore */
    } finally {
      setSavingExterno(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.recurso || !form.obraId) {
      setError('Selecione recurso e obra');
      return;
    }
    const [tipo, id] = form.recurso.split(':');
    setSaving(true);
    setError('');
    try {
      const payload = {
        userId: tipo === 'user' ? id : null,
        recursoExternoId: tipo === 'externo' ? id : null,
        obraId: form.obraId,
        cargoNaAlocacao: form.cargoNaAlocacao,
        fase: form.fase,
        dedicacaoPct: form.dedicacaoPct,
        dataInicio: form.dataInicio || null,
        dataFim: form.dataFim || null,
      };

      if (editAlocacao) {
        const res = await api.put(`/alocacoes/${editAlocacao.id}`, payload);
        onUpdated(res.data.data);
      } else {
        const res = await api.post('/alocacoes', payload);
        onSaved(res.data.data);
      }
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
          <h2 className="text-base font-semibold text-gray-900">
            {editAlocacao ? 'Editar Alocação' : 'Nova Alocação'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-4 overflow-y-auto p-6">
          {/* Recurso */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Recurso</label>
            <select
              value={form.recurso}
              onChange={e => setForm(f => ({ ...f, recurso: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecionar recurso…</option>
              <optgroup label="Equipe BÈR">
                {users.map(u => (
                  <option key={u.id} value={`user:${u.id}`}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </optgroup>
              {recursosExternos.length > 0 && (
                <optgroup label="Recursos Externos">
                  {recursosExternos.map(r => (
                    <option key={r.id} value={`externo:${r.id}`}>
                      {r.nome} — {FUNCAO_LABELS[r.funcao] ?? r.funcao}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {!showNewExterno && (
              <button
                type="button"
                onClick={() => setShowNewExterno(true)}
                className="mt-1.5 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
              >
                <UserPlus size={11} /> Novo recurso externo
              </button>
            )}

            {showNewExterno && (
              <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="mb-2 text-xs font-semibold text-blue-800">Novo recurso externo</p>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Nome completo"
                    value={newExterno.nome}
                    onChange={e => setNewExterno(n => ({ ...n, nome: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={newExterno.cargo}
                    onChange={e =>
                      setNewExterno(n => ({
                        ...n,
                        cargo: e.target.value as typeof n.cargo,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="coordenador">Coordenador</option>
                    <option value="gestor">Gestor de Obras</option>
                    <option value="mestre">Mestre de Obras</option>
                    <option value="ajudante">Ajudante</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewExterno(false);
                        setNewExterno({ nome: '', cargo: 'mestre' });
                      }}
                      className="flex-1 rounded-lg border border-gray-200 bg-white py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNewExterno}
                      disabled={savingExterno || !newExterno.nome.trim()}
                      className="flex-1 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingExterno ? 'Salvando…' : 'Salvar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Obra */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Obra</label>
            <select
              value={form.obraId}
              onChange={e => handleObraChange(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecionar obra…</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>

          </div>

          {/* Cargo na alocação */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Cargo na Alocação
            </label>
            <select
              value={form.cargoNaAlocacao}
              onChange={e =>
                setForm(f => ({
                  ...f,
                  cargoNaAlocacao: e.target.value as typeof f.cargoNaAlocacao,
                }))
              }
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="coordenador">Coordenador</option>
              <option value="gestor">Gestor de Obras</option>
              <option value="mestre">Mestre</option>
              <option value="ajudante">Ajudante</option>
            </select>
          </div>

          {/* Fase */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Fase</label>
            <select
              value={form.fase}
              onChange={e => handleFaseChange(e.target.value as typeof form.fase)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="obra">Somente Obra</option>
              {hasProjeto && <option value="projeto">Somente Projeto</option>}
              {hasProjeto && <option value="ambas">Ambas (Projeto + Obra)</option>}
            </select>
            {!hasProjeto && form.obraId && (
              <p className="mt-1 text-[10px] text-gray-400">
                Obra sem fase de projeto cadastrada — configure datas de projeto na obra para habilitar.
              </p>
            )}
          </div>

          {/* Dedicação */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-600">
                Dedicação:{' '}
                <span className="font-semibold text-gray-800">{form.dedicacaoPct}%</span>
              </label>
              {form.recurso && form.dataInicio && form.dataFim && (
                <span
                  className={`text-[10px] font-medium ${
                    restante >= 20
                      ? 'text-green-600'
                      : restante >= 0
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }`}
                >
                  {restante > 0 ? `${restante}% disponível` : 'sem capacidade'}
                </span>
              )}
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={form.dedicacaoPct}
              onChange={e => setForm(f => ({ ...f, dedicacaoPct: Number(e.target.value) }))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>1%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Início</label>
              <input
                type="date"
                value={form.dataInicio}
                onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Fim</label>
              <input
                type="date"
                value={form.dataFim}
                onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Aviso de conflito */}
          {willConflict && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-600" />
              <p className="text-xs text-amber-700">
                Esta alocação vai resultar em{' '}
                <span className="font-bold">{previewTotal}% de dedicação</span> no período,
                acima do limite de 100%.
              </p>
            </div>
          )}

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
              {saving ? 'Salvando…' : editAlocacao ? 'Atualizar' : 'Salvar'}
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
  cargo: string;
  obraName: string;
  fase: string;
  dedicacao: number;
  dataInicio: string;
  dataFim: string;
}

interface GanttBar {
  id: string;
  alocacaoId: string;
  left: number;
  width: number;
  color: string;
  label: string;
  tooltip: Omit<TooltipData, 'x' | 'y'>;
}

interface GanttRow {
  id: string;
  label: string;
  subLabel: string;
  recursoSelectKey: string;
  bars: GanttBar[];
}

function buildGanttRows(
  alocacoes: Alocacao[],
  viewMode: ViewMode,
  zoom: Zoom,
  obras: ObraInfo[],
  today: Date,
): { rows: GanttRow[]; totalWidth: number; todayLeft: number } {
  const obraMap = new Map(obras.map(o => [o.id, o]));
  const pxPerDay = PX_PER_DAY[zoom];
  const chartDays = CHART_DAYS[zoom];
  const chartStart = addDays(today, -CHART_OFFSET[zoom]);
  const totalWidth = chartDays * pxPerDay;
  const todayLeft = diffDays(today, chartStart) * pxPerDay;
  const rowMap = new Map<string, GanttRow>();

  for (const aloc of alocacoes) {
    const obra = obraMap.get(aloc.obraId);

    type BarDef = { phase: 'projeto' | 'obra'; start: Date | null; end: Date | null };
    const barsToCreate: BarDef[] = [];

    if (aloc.fase === 'projeto') {
      const start = parseDate(aloc.dataInicio) ?? parseDate(obra?.dataInicioProjeto ?? null);
      const end = parseDate(aloc.dataFim) ?? parseDate(obra?.dataFimProjeto ?? null);
      barsToCreate.push({ phase: 'projeto', start, end });
    } else if (aloc.fase === 'obra') {
      const start =
        parseDate(aloc.dataInicio) ??
        parseDate(obra?.dataInicioObra ?? null) ??
        parseDate(aloc.obra.startDate);
      const end =
        parseDate(aloc.dataFim) ??
        parseDate(obra?.dataFimObra ?? null) ??
        parseDate(aloc.obra.expectedEndDate);
      barsToCreate.push({ phase: 'obra', start, end });
    } else {
      // ambas
      if (obra?.dataInicioProjeto) {
        const projStart =
          parseDate(aloc.dataInicio) ?? parseDate(obra.dataInicioProjeto);
        const projEnd =
          parseDate(aloc.dataFim) ?? parseDate(obra.dataFimProjeto ?? null);
        barsToCreate.push({ phase: 'projeto', start: projStart, end: projEnd });
        const obraStart = parseDate(obra.dataInicioObra ?? null) ?? parseDate(aloc.obra.startDate);
        const obraEnd =
          parseDate(obra.dataFimObra ?? null) ?? parseDate(aloc.obra.expectedEndDate);
        barsToCreate.push({ phase: 'obra', start: obraStart, end: obraEnd });
      } else {
        const start =
          parseDate(aloc.dataInicio) ??
          parseDate(obra?.dataInicioObra ?? null) ??
          parseDate(aloc.obra.startDate);
        const end =
          parseDate(aloc.dataFim) ??
          parseDate(obra?.dataFimObra ?? null) ??
          parseDate(aloc.obra.expectedEndDate);
        barsToCreate.push({ phase: 'obra', start, end });
      }
    }

    const rowKey =
      viewMode === 'recurso'
        ? (aloc.userId ?? aloc.recursoExternoId ?? aloc.id)
        : aloc.obraId;

    const rowLabel = viewMode === 'recurso' ? recursoNome(aloc) : aloc.obra.name;
    const rowSubLabel = viewMode === 'recurso' ? recursoRole(aloc) : aloc.obra.status;

    if (!rowMap.has(rowKey)) {
      rowMap.set(rowKey, {
        id: rowKey,
        label: rowLabel,
        subLabel: rowSubLabel,
        recursoSelectKey: viewMode === 'obra' ? `obra:${aloc.obraId}` : recursoSelectKey(aloc),
        bars: [],
      });
    }

    const barLabel =
      viewMode === 'recurso'
        ? `${aloc.obra.name.slice(0, 14)} · ${aloc.dedicacaoPct}%`
        : `${recursoNome(aloc).split(' ')[0]} · ${CARGO_SHORT[aloc.cargoNaAlocacao] ?? aloc.cargoNaAlocacao} · ${aloc.dedicacaoPct}%`;

    for (const barDef of barsToCreate) {
      const { phase, start, end } = barDef;
      const s = start ?? today;
      const e = end ?? addDays(today, 30);
      const left = Math.max(0, diffDays(s, chartStart)) * pxPerDay;
      const rawRight = diffDays(e, chartStart) * pxPerDay;
      const width = Math.max(8, rawRight - left);
      if (rawRight < 0 || left > totalWidth) continue;

      const color = phase === 'projeto' ? '#1D4ED8' : '#60A5FA';

      rowMap.get(rowKey)!.bars.push({
        id: `${aloc.id}:${phase}`,
        alocacaoId: aloc.id,
        left,
        width,
        color,
        label: barLabel,
        tooltip: {
          userName: recursoNome(aloc),
          cargo: CARGO_LABELS[aloc.cargoNaAlocacao] ?? aloc.cargoNaAlocacao,
          obraName: aloc.obra.name,
          fase: phase === 'projeto' ? 'Projeto' : 'Obra',
          dedicacao: aloc.dedicacaoPct,
          dataInicio: fmtDate(s),
          dataFim: fmtDate(e),
        },
      });
    }
  }

  // Em modo obra, adicionar linhas para obras sem alocação
  if (viewMode === 'obra') {
    for (const obra of obras) {
      if (!rowMap.has(obra.id)) {
        rowMap.set(obra.id, {
          id: obra.id,
          label: obra.name,
          subLabel: obra.status,
          recursoSelectKey: `obra:${obra.id}`,
          bars: [],
        });
      }
    }
  }

  return { rows: [...rowMap.values()], totalWidth, todayLeft };
}

function generateTicks(
  chartStart: Date,
  chartDays: number,
  zoom: Zoom,
  pxPerDay: number,
) {
  const ticks: { left: number; label: string }[] = [];
  if (zoom === 'semana') {
    for (let d = 0; d < chartDays; d += 7) {
      ticks.push({ left: d * pxPerDay, label: fmtShort(addDays(chartStart, d)) });
    }
  } else {
    let cur = new Date(chartStart.getFullYear(), chartStart.getMonth(), 1);
    const end = addDays(chartStart, chartDays);
    while (cur < end) {
      const dayOffset = diffDays(cur, chartStart);
      if (dayOffset >= 0)
        ticks.push({
          left: dayOffset * pxPerDay,
          label: cur.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }),
        });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }
  return ticks;
}

function GanttChart({
  alocacoes,
  zoom,
  viewMode,
  obras,
  onBarClick,
  onRowEmptyClick,
}: {
  alocacoes: Alocacao[];
  zoom: Zoom;
  viewMode: ViewMode;
  obras: ObraInfo[];
  onBarClick: (alocacaoId: string) => void;
  onRowEmptyClick: (recursoSelectKey: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const today = new Date();
  const pxPerDay = PX_PER_DAY[zoom];
  const chartStart = addDays(today, -CHART_OFFSET[zoom]);
  const { rows, totalWidth, todayLeft } = buildGanttRows(
    alocacoes,
    viewMode,
    zoom,
    obras,
    today,
  );
  const ticks = generateTicks(chartStart, CHART_DAYS[zoom], zoom, pxPerDay);
  const totalH = HEADER_H + rows.length * ROW_H;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Calendar size={48} className="mb-3 opacity-40" />
        <p className="text-sm">Nenhuma alocação encontrada.</p>
        <p className="text-xs">Clique em &quot;Nova Alocação&quot; para começar.</p>
      </div>
    );
  }

  return (
    <div className="relative flex overflow-hidden rounded-lg border border-gray-200 bg-white">
      {/* Left fixed panel */}
      <div className="flex-shrink-0 border-r border-gray-200" style={{ width: LEFT_W }}>
        <div
          className="flex items-center border-b border-gray-200 bg-gray-50 px-4"
          style={{ height: HEADER_H }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {viewMode === 'recurso' ? 'Recurso' : 'Obra'}
          </span>
        </div>
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
                <span className="ml-1 mt-1 block text-[10px] text-gray-500">
                  {tick.label}
                </span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {rows.map((row, ri) => (
            <div
              key={row.id}
              className="absolute w-full cursor-pointer border-b border-gray-100 hover:bg-blue-50/30"
              style={{
                top: HEADER_H + ri * ROW_H,
                height: ROW_H,
                width: totalWidth,
              }}
              onClick={() => onRowEmptyClick(row.recursoSelectKey)}
            >
              {ticks.map((tick, i) => (
                <div
                  key={i}
                  className="absolute h-full border-l border-gray-100"
                  style={{ left: tick.left }}
                />
              ))}
              {row.bars.map(bar => (
                <div
                  key={bar.id}
                  className="absolute cursor-pointer rounded shadow-sm transition-opacity hover:opacity-100"
                  style={{
                    left: bar.left,
                    width: bar.width,
                    top: 8,
                    height: ROW_H - 16,
                    backgroundColor: bar.color,
                    opacity: 0.9,
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    onBarClick(bar.alocacaoId);
                  }}
                  onMouseEnter={e =>
                    setTooltip({ x: e.clientX, y: e.clientY, ...bar.tooltip })
                  }
                  onMouseMove={e =>
                    setTooltip(t => (t ? { ...t, x: e.clientX, y: e.clientY } : null))
                  }
                  onMouseLeave={() => setTooltip(null)}
                >
                  <span className="block truncate px-1.5 text-[10px] font-semibold leading-[32px] text-white">
                    {bar.label}
                  </span>
                </div>
              ))}
            </div>
          ))}

          {/* Today line */}
          {todayLeft >= 0 && todayLeft <= totalWidth && (
            <div
              className="pointer-events-none absolute z-20"
              style={{
                left: todayLeft,
                top: HEADER_H,
                height: rows.length * ROW_H,
                width: 2,
                backgroundColor: '#EF4444',
              }}
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
            <p>Cargo: {tooltip.cargo}</p>
            <p>Fase: {tooltip.fase}</p>
            <p>
              Dedicação: <span className="font-semibold">{tooltip.dedicacao}%</span>
            </p>
            <p>Início: {tooltip.dataInicio}</p>
            <p>Fim: {tooltip.dataFim}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Nova Obra Modal ─── */

function addDaysToDate(dateStr: string, days: number): string {
  if (!dateStr || days < 1) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days - 1);
  return d.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
}

interface PhaseState { inicio: string; fim: string; dias: string }

function PhaseFields({
  label,
  value,
  onChange,
  naoAplicavel,
  onToggleNaoAplicavel,
}: {
  label: string;
  value: PhaseState;
  onChange: (v: PhaseState) => void;
  naoAplicavel?: boolean;
  onToggleNaoAplicavel?: () => void;
}) {
  function handleInicio(inicio: string) {
    const dias = value.dias ? value.dias : '';
    const fim = dias && inicio ? addDaysToDate(inicio, Number(dias)) : value.fim;
    const newDias = !dias && fim && inicio ? String(daysBetween(inicio, fim)) : dias;
    onChange({ inicio, fim, dias: newDias });
  }

  function handleFim(fim: string) {
    const dias = value.inicio && fim ? String(daysBetween(value.inicio, fim)) : value.dias;
    onChange({ ...value, fim, dias });
  }

  function handleDias(raw: string) {
    const dias = raw.replace(/\D/g, '');
    const fim = value.inicio && dias ? addDaysToDate(value.inicio, Number(dias)) : value.fim;
    onChange({ ...value, dias, fim });
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        {onToggleNaoAplicavel && (
          <button
            type="button"
            onClick={onToggleNaoAplicavel}
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
              naoAplicavel
                ? 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
            }`}
          >
            {naoAplicavel ? 'Não aplicável ×' : 'Não aplicável'}
          </button>
        )}
      </div>
      {naoAplicavel ? (
        <p className="rounded-lg border border-dashed border-gray-200 py-3 text-center text-xs text-gray-400">
          Fase não aplicável a esta obra
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="mb-1 block text-[10px] font-medium text-gray-500">Início</label>
            <input type="date" value={value.inicio} onChange={e => handleInicio(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-gray-500">Fim</label>
            <input type="date" value={value.fim} onChange={e => handleFim(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium text-gray-500">Dias</label>
            <input type="text" inputMode="numeric" placeholder="—" value={value.dias}
              onChange={e => handleDias(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      )}
    </div>
  );
}

function NovaObraModal({ onClose, onSaved }: { onClose: () => void; onSaved: (o: ObraInfo) => void }) {
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [projeto, setProjeto] = useState<PhaseState>({ inicio: '', fim: '', dias: '' });
  const [projetoNA, setProjetoNA] = useState(false);
  const [obra, setObra] = useState<PhaseState>({ inicio: '', fim: '', dias: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, string> = { name: name.trim(), status: 'planejamento' };
      if (client) payload.client = client.trim();
      if (obra.inicio) { payload.startDate = new Date(obra.inicio).toISOString(); payload.dataInicioObra = obra.inicio; }
      if (obra.fim) { payload.expectedEndDate = new Date(obra.fim).toISOString(); payload.dataFimObra = obra.fim; }
      if (!projetoNA && projeto.inicio) payload.dataInicioProjeto = projeto.inicio;
      if (!projetoNA && projeto.fim) payload.dataFimProjeto = projeto.fim;
      const res = await api.post('/obras', payload);
      onSaved(res.data.data ?? res.data);
    } catch {
      setError('Erro ao criar obra');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">Nova Obra</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="max-h-[80vh] space-y-4 overflow-y-auto p-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Nome da obra *</label>
            <input type="text" placeholder="Ex: Residência São Paulo" value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Cliente</label>
            <input type="text" placeholder="Nome do cliente" value={client}
              onChange={e => setClient(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <PhaseFields
            label="Fase de Projeto"
            value={projeto}
            onChange={setProjeto}
            naoAplicavel={projetoNA}
            onToggleNaoAplicavel={() => { setProjetoNA(v => !v); setProjeto({ inicio: '', fim: '', dias: '' }); }}
          />
          <PhaseFields label="Fase de Obra" value={obra} onChange={setObra} />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !name.trim()}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Salvando…' : 'Criar Obra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Obras Tab ─── */

function ObrasTab({
  obras,
  alocacoes,
  onAddedObra,
  onAlocar,
  onDeletedObra,
}: {
  obras: ObraInfo[];
  alocacoes: Alocacao[];
  onAddedObra: (o: ObraInfo) => void;
  onAlocar: (obraId: string) => void;
  onDeletedObra: (obraId: string) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const today = new Date();

  async function handleDelete(obraId: string) {
    setDeletingId(obraId);
    try {
      await api.delete(`/obras/${obraId}`);
      onDeletedObra(obraId);
    } catch {
      // silently reset
    } finally {
      setDeletingId(null);
    }
  }

  const STATUS_LABEL: Record<string, string> = {
    planejamento: 'Planejamento',
    em_andamento: 'Em andamento',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  };

  const STATUS_COLOR: Record<string, string> = {
    planejamento: 'bg-amber-100 text-amber-700',
    em_andamento: 'bg-green-100 text-green-700',
    concluida: 'bg-blue-100 text-blue-700',
    cancelada: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">{obras.length} obras cadastradas</p>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={13} /> Nova Obra
        </button>
      </div>

      {showModal && (
        <NovaObraModal
          onClose={() => setShowModal(false)}
          onSaved={o => { onAddedObra(o); setShowModal(false); }}
        />
      )}

      {/* Lista de obras */}
      <div className="space-y-2">
        {obras.map(o => {
          const obraAlocs = alocacoes.filter(a => {
            if (a.obraId !== o.id) return false;
            const end = resolveEnd(a);
            return !end || end >= today;
          });
          const totalPct = obraAlocs.reduce((s, a) => s + a.dedicacaoPct, 0);
          const recursos = new Set(obraAlocs.map(a => a.userId ?? a.recursoExternoId)).size;

          return (
            <div key={o.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-gray-900">{o.name}</p>
                  <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLOR[o.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-3 text-[10px] text-gray-400">
                  {o.dataInicioProjeto && (
                    <span>Projeto: {fmtDate(parseDate(o.dataInicioProjeto))} → {fmtDate(parseDate(o.dataFimProjeto ?? null))}</span>
                  )}
                  {(o.dataInicioObra ?? o.startDate) && (
                    <span>Obra: {fmtDate(parseDate(o.dataInicioObra ?? o.startDate))} → {fmtDate(parseDate(o.dataFimObra ?? o.expectedEndDate))}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-3 text-xs text-gray-500">
                <span>{recursos} recurso{recursos !== 1 ? 's' : ''}</span>
                <span className={`font-semibold ${totalPct > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{totalPct}%</span>
                <button
                  onClick={() => onAlocar(o.id)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                >
                  <Plus size={11} /> Alocar
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Excluir "${o.name}"? Esta ação não pode ser desfeita.`)) {
                      handleDelete(o.id);
                    }
                  }}
                  disabled={deletingId === o.id}
                  className="rounded-lg border border-gray-200 bg-white p-1 text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
        {obras.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">Nenhuma obra cadastrada.</p>
        )}
      </div>
    </div>
  );
}

/* ─── Recursos Tab ─── */

interface RecursoStat {
  id: string;
  key: string;
  nome: string;
  cargoPadrao: string;
  totalPct: number;
  alocacoesAtivas: Alocacao[];
  tipo: 'interno' | 'externo';
}

function RecursosTab({
  users,
  recursosExternos,
  alocacoes,
  onNovoExterno,
  onOpenModal,
}: {
  users: UserInfo[];
  recursosExternos: RecursoExterno[];
  alocacoes: Alocacao[];
  onNovoExterno: () => void;
  onOpenModal: (prefillRecurso: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const today = new Date();

  const activeAlocs = alocacoes.filter(a => {
    const end = resolveEnd(a);
    const start = resolveStart(a);
    return (!start || start <= today) && (!end || end >= today);
  });

  const stats: RecursoStat[] = [
    ...users.map(u => {
      const userAlocs = activeAlocs.filter(a => a.userId === u.id);
      return {
        id: u.id,
        key: `user:${u.id}`,
        nome: u.name,
        cargoPadrao: u.role,
        totalPct: userAlocs.reduce((s, a) => s + a.dedicacaoPct, 0),
        alocacoesAtivas: userAlocs,
        tipo: 'interno' as const,
      };
    }),
    ...recursosExternos.map(r => {
      const rAlocs = activeAlocs.filter(a => a.recursoExternoId === r.id);
      return {
        id: r.id,
        key: `externo:${r.id}`,
        nome: r.nome,
        cargoPadrao: FUNCAO_LABELS[r.funcao] ?? r.funcao,
        totalPct: rAlocs.reduce((s, a) => s + a.dedicacaoPct, 0),
        alocacoesAtivas: rAlocs,
        tipo: 'externo' as const,
      };
    }),
  ].sort((a, b) => b.totalPct - a.totalPct);

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function pctColor(pct: number) {
    if (pct > 100) return 'bg-red-500';
    if (pct >= 80) return 'bg-amber-400';
    return 'bg-green-500';
  }

  function pctTextColor(pct: number) {
    if (pct > 100) return 'text-red-700 bg-red-100';
    if (pct >= 80) return 'text-amber-700 bg-amber-100';
    return 'text-green-700 bg-green-100';
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">
          {stats.length} recursos ({users.length} internos · {recursosExternos.length} externos)
        </p>
        <button
          onClick={onNovoExterno}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <UserPlus size={12} /> Novo Recurso Externo
        </button>
      </div>

      {stats.map(s => {
        const isExpanded = expanded.has(s.key);
        return (
          <div key={s.key} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div
              className="flex cursor-pointer items-center gap-3 px-4 py-3"
              onClick={() => toggleExpand(s.key)}
            >
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                  s.tipo === 'interno' ? 'bg-blue-500' : 'bg-orange-400'
                }`}
              >
                {s.nome.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{s.nome}</p>
                <p className="text-[10px] text-gray-400">{s.cargoPadrao}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24">
                  <div className="mb-0.5 flex justify-between text-[10px] text-gray-500">
                    <span>{s.totalPct}%</span>
                    <span>{s.alocacoesAtivas.length} obras</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className={`h-1.5 rounded-full transition-all ${pctColor(s.totalPct)}`}
                      style={{ width: `${Math.min(100, s.totalPct)}%` }}
                    />
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pctTextColor(s.totalPct)}`}
                >
                  {s.totalPct}%
                </span>
                {isExpanded ? (
                  <ChevronUp size={14} className="text-gray-400" />
                ) : (
                  <ChevronDown size={14} className="text-gray-400" />
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                {s.alocacoesAtivas.length === 0 ? (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">Sem alocações ativas</p>
                    <button
                      onClick={() => onOpenModal(s.key)}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      + Alocar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {s.alocacoesAtivas.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs shadow-sm"
                      >
                        <div>
                          <p className="font-medium text-gray-800">{a.obra.name}</p>
                          <p className="text-gray-400">
                            {CARGO_LABELS[a.cargoNaAlocacao] ?? a.cargoNaAlocacao} ·{' '}
                            {a.fase === 'ambas'
                              ? 'Projeto + Obra'
                              : a.fase === 'projeto'
                              ? 'Projeto'
                              : 'Obra'}
                          </p>
                        </div>
                        <span className="font-bold text-gray-700">{a.dedicacaoPct}%</span>
                      </div>
                    ))}
                    <button
                      onClick={() => onOpenModal(s.key)}
                      className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      + Nova alocação para este recurso
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
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
  const [recursosExternos, setRecursosExternos] = useState<RecursoExterno[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [showNovoExternoModal, setShowNovoExternoModal] = useState(false);
  const [showNovaObraModal, setShowNovaObraModal] = useState(false);

  useEffect(() => {
    if (user && !perms.configuracoes) router.replace('/dashboard');
  }, [user, perms, router]);

  useEffect(() => {
    if (!perms.configuracoes) return;
    setLoading(true);
    Promise.allSettled([
      api.get('/alocacoes'),
      api.get('/obras', { params: { limit: 200 } }),
      api.get('/users', { params: { limit: 200 } }),
      api.get('/recursos-externos'),
    ]).then(([alRes, obRes, usRes, reRes]) => {
      if (alRes.status === 'fulfilled') setAlocacoes(alRes.value.data.data ?? []);
      if (obRes.status === 'fulfilled')
        setObras(
          (obRes.value.data.data ?? []).filter((o: ObraInfo) => o.status !== 'cancelada'),
        );
      if (usRes.status === 'fulfilled') setUsers(usRes.value.data.data ?? []);
      if (reRes.status === 'fulfilled') setRecursosExternos(reRes.value.data.data ?? []);
    }).finally(() => setLoading(false));
  }, [perms.configuracoes]);

  const conflicts = detectConflicts(alocacoes);

  function handleSaved(a: Alocacao) {
    setAlocacoes(prev => [a, ...prev]);
    setModal({ type: 'none' });
  }

  function handleUpdated(a: Alocacao) {
    setAlocacoes(prev => prev.map(x => (x.id === a.id ? a : x)));
    setModal({ type: 'none' });
  }

  function handleNewRecursoExterno(r: RecursoExterno) {
    setRecursosExternos(prev => [...prev, r]);
  }

  function openEdit(alocacaoId: string) {
    const a = alocacoes.find(x => x.id === alocacaoId);
    if (a) setModal({ type: 'edit', alocacao: a });
  }

  function openCreate(prefillRecurso?: string, prefillObraId?: string) {
    setModal({ type: 'create', prefillRecurso, prefillObraId });
  }

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
          onClick={() => openCreate()}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Plus size={16} /> Nova Alocação
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-6">
        {(
          [
            { key: 'timeline', label: 'Timeline' },
            { key: 'obras', label: 'Obras' },
            { key: 'recursos', label: 'Recursos' },
            { key: 'conflitos', label: 'Conflitos', badge: conflicts.length },
          ] as { key: Tab; label: string; badge?: number }[]
        ).map(tab => (
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
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            Carregando…
          </div>
        ) : (
          <>
            {/* ── TIMELINE ── */}
            {activeTab === 'timeline' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* View mode toggle */}
                  <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
                    {(['recurso', 'obra'] as ViewMode[]).map(m => (
                      <button
                        key={m}
                        onClick={() => setViewMode(m)}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          viewMode === m
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {m === 'recurso' ? <Users size={12} /> : <HardHat size={12} />}
                        {m === 'recurso' ? 'Por Recurso' : 'Por Obra'}
                      </button>
                    ))}
                  </div>

                  {/* Zoom */}
                  <div className="flex rounded-lg border border-gray-200 bg-white p-0.5">
                    {(
                      [
                        { key: 'semana', label: 'Semana' },
                        { key: 'mes', label: 'Mês' },
                        { key: 'trimestre', label: 'Trimestre' },
                      ] as { key: Zoom; label: string }[]
                    ).map(z => (
                      <button
                        key={z.key}
                        onClick={() => setZoom(z.key)}
                        className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          zoom === z.key
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {z.label}
                      </button>
                    ))}
                  </div>

                  {/* Quick-add buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowNovaObraModal(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <HardHat size={12} /> Nova Obra
                    </button>
                    <button
                      onClick={() => setShowNovoExternoModal(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <UserPlus size={12} /> Novo Recurso
                    </button>
                  </div>

                  {/* Legend */}
                  <div className="ml-auto flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1 text-[10px] text-gray-600">
                      <span className="inline-block h-2.5 w-4 rounded-sm bg-[#1D4ED8]" />
                      Projeto
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-gray-600">
                      <span className="inline-block h-2.5 w-4 rounded-sm bg-[#60A5FA]" />
                      Obra
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-gray-400">
                      <span className="inline-block h-2.5 w-0.5 bg-red-500" />
                      Hoje
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Clique em linha vazia para alocar · Clique na barra para editar
                    </span>
                  </div>
                </div>

                <GanttChart
                  alocacoes={alocacoes}
                  zoom={zoom}
                  viewMode={viewMode}
                  obras={obras}
                  onBarClick={openEdit}
                  onRowEmptyClick={key =>
                    key.startsWith('obra:')
                      ? openCreate(undefined, key.slice(5))
                      : openCreate(key)
                  }
                />
              </div>
            )}

            {/* ── OBRAS ── */}
            {activeTab === 'obras' && (
              <ObrasTab
                obras={obras}
                alocacoes={alocacoes}
                onAddedObra={o => setObras(prev => [...prev, o])}
                onAlocar={obraId => openCreate(undefined, obraId)}
                onDeletedObra={obraId => setObras(prev => prev.filter(o => o.id !== obraId))}
              />
            )}

            {/* ── RECURSOS ── */}
            {activeTab === 'recursos' && (
              <RecursosTab
                users={users}
                recursosExternos={recursosExternos}
                alocacoes={alocacoes}
                onNovoExterno={() => openCreate()}
                onOpenModal={prefillRecurso => openCreate(prefillRecurso)}
              />
            )}

            {/* ── CONFLITOS ── */}
            {activeTab === 'conflitos' && (
              <div className="space-y-3">
                {conflicts.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-gray-400">
                    <div className="mb-3 rounded-full bg-green-100 p-4">
                      <Calendar size={28} className="text-green-500" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">
                      Sem conflitos de alocação
                    </p>
                    <p className="text-xs">
                      Todos os recursos estão com dedicação dentro do limite.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-500">
                      {conflicts.length} conflito{conflicts.length !== 1 ? 's' : ''} detectado
                      {conflicts.length !== 1 ? 's' : ''}
                    </p>
                    {conflicts.map((c, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-red-100 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-full bg-red-100 p-1.5">
                            <AlertTriangle size={14} className="text-red-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-900">
                                {c.recursoName}
                              </p>
                              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                                {c.maxPct}% alocado
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">
                              Sobreposição: {fmtDate(c.overlapStart)} →{' '}
                              {fmtDate(c.overlapEnd)}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {c.allocations.map(a => (
                                <span
                                  key={a.id}
                                  className="rounded-md bg-red-50 px-2 py-1 text-[10px] font-medium text-red-700"
                                >
                                  {a.obra.name} ·{' '}
                                  {CARGO_SHORT[a.cargoNaAlocacao] ?? a.cargoNaAlocacao} ·{' '}
                                  {a.dedicacaoPct}%
                                </span>
                              ))}
                            </div>
                            <button
                              onClick={() => openEdit(c.allocations[0].id)}
                              className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                            >
                              Resolver
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {modal.type !== 'none' && (
        <AlocacaoModal
          obras={obras}
          users={users}
          recursosExternos={recursosExternos}
          alocacoes={alocacoes}
          modalState={modal}
          onClose={() => setModal({ type: 'none' })}
          onSaved={handleSaved}
          onUpdated={handleUpdated}
          onNewRecursoExterno={handleNewRecursoExterno}
        />
      )}

      {/* Novo externo standalone (aba Recursos) */}
      {showNovoExternoModal && (
        <AlocacaoModal
          obras={obras}
          users={users}
          recursosExternos={recursosExternos}
          alocacoes={alocacoes}
          modalState={{ type: 'create' }}
          onClose={() => setShowNovoExternoModal(false)}
          onSaved={handleSaved}
          onUpdated={handleUpdated}
          onNewRecursoExterno={handleNewRecursoExterno}
        />
      )}

      {/* Nova obra (quick-add na toolbar da timeline) */}
      {showNovaObraModal && (
        <NovaObraModal
          onClose={() => setShowNovaObraModal(false)}
          onSaved={o => { setObras(prev => [...prev, o]); setShowNovaObraModal(false); }}
        />
      )}
    </div>
  );
}
