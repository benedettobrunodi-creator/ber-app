'use client';

import { useState, useCallback, Component } from 'react';
import type { ReactNode } from 'react';
import api from '@/lib/api';
import { Plus, Clock, X, AlertCircle, Trash2, LayoutGrid, LayoutList } from 'lucide-react';
import { ETAPAS, ETAPA_MAP, ORIGENS, PROBABILIDADES, SEGMENTOS, Oportunidade, User, fmt, fmtDate, diasAtras } from '../types';

class DrawerBoundary extends Component<{ children: ReactNode; onClose: () => void }, { err: string | null }> {
  state = { err: null };
  static getDerivedStateFromError(e: Error) { return { err: e.message }; }
  render() {
    if (this.state.err) {
      return (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={this.props.onClose} />
          <div className="relative z-10 w-full max-w-md bg-white shadow-xl p-6 flex flex-col gap-4">
            <p className="font-bold text-red-600">Erro ao abrir</p>
            <p className="text-sm text-red-500 font-mono break-all">{this.state.err}</p>
            <button onClick={this.props.onClose} className="self-start px-4 py-2 bg-gray-100 rounded-lg text-sm">Fechar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const TERMINAL_ETAPAS = ['ganho', 'perdido', 'declinado', 'cancelado'];
const KANBAN_ETAPAS = ETAPAS.filter((e) => !TERMINAL_ETAPAS.includes(e.value));

interface Props {
  oportunidades: Oportunidade[];
  users: User[];
  onRefresh: () => void;
}

function CardOportunidade({
  op,
  onClick,
}: {
  op: Oportunidade;
  onClick: () => void;
}) {
  const proximaAtividade = op.atividades?.[0];
  const vencida = proximaAtividade && new Date(proximaAtividade.dataHora) < new Date();

  return (
    <div
      onClick={onClick}
      className="bg-white border border-ber-border rounded-lg p-3 cursor-pointer hover:shadow-md hover:border-ber-teal/40 transition-all group"
    >
      <p className="text-sm font-semibold text-ber-carbon leading-tight line-clamp-2 group-hover:text-ber-teal">
        {op.titulo}
      </p>
      {op.empresa && (
        <p className="mt-1 text-xs text-ber-gray truncate">{op.empresa.razaoSocial}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-bold text-ber-carbon">{fmt(op.valor)}</span>
        {op.origem && (
          <span className="text-[10px] bg-ber-surface text-ber-gray px-1.5 py-0.5 rounded capitalize">
            {ORIGENS.find((o) => o.value === op.origem)?.label ?? op.origem}
          </span>
        )}
      </div>
      {proximaAtividade && (
        <div className={`mt-2 flex items-center gap-1 text-[11px] ${vencida ? 'text-ber-red' : 'text-ber-gray'}`}>
          {vencida ? <AlertCircle size={11} /> : <Clock size={11} />}
          <span className="truncate">{proximaAtividade.notas ?? proximaAtividade.tipo}</span>
          <span className="ml-auto shrink-0">{fmtDate(proximaAtividade.dataHora)}</span>
        </div>
      )}
      {op.responsavel && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-ber-teal/20 flex items-center justify-center text-[9px] font-bold text-ber-teal shrink-0">
            {op.responsavel.name.charAt(0)}
          </div>
          <span className="text-[10px] text-ber-gray truncate">{op.responsavel.name}</span>
        </div>
      )}
    </div>
  );
}

function OportunidadeDrawer({
  op,
  users,
  onClose,
  onSave,
}: {
  op: Oportunidade | null;
  users: User[];
  onClose: () => void;
  onSave: () => void;
}) {
  const isNew = !op?.id;
  const [form, setForm] = useState({
    titulo: op?.titulo ?? '',
    valor: op?.valor?.toString() ?? '',
    etapa: op?.etapa ?? 'lead',
    origem: op?.origem ?? '',
    probabilidade: op?.probabilidade ?? '',
    responsavelId: op?.responsavel?.id ?? '',
    dataFechamentoPrevisto: op?.dataFechamentoPrevisto?.slice(0, 10) ?? '',
    observacoes: op?.observacoes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState('');

  const handleDelete = async () => {
    if (!op?.id) return;
    setDeleting(true);
    try {
      await api.delete(`/crm/oportunidades/${op.id}`);
      onSave();
    } catch {
      setErr('Erro ao excluir');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) { setErr('Título obrigatório'); return; }
    setSaving(true);
    try {
      const valorNum = form.valor ? Number(form.valor) : null;
      const payload = {
        titulo: form.titulo,
        etapa: form.etapa,
        valor: valorNum && valorNum > 0 ? valorNum : null,
        origem: form.origem || null,
        probabilidade: form.probabilidade || null,
        responsavelId: form.responsavelId || null,
        dataFechamentoPrevisto: form.dataFechamentoPrevisto || null,
        observacoes: form.observacoes || null,
      };
      if (isNew) {
        await api.post('/crm/oportunidades', payload);
      } else {
        await api.patch(`/crm/oportunidades/${op!.id}`, payload);
      }
      onSave();
    } catch (e: any) {
      const details = e?.response?.data?.error?.details;
      if (details?.length) {
        setErr(details.map((d: any) => `${d.field}: ${d.message}`).join(' · '));
      } else {
        setErr(e?.response?.data?.error?.message ?? e?.message ?? 'Erro ao salvar');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white shadow-xl flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-ber-border">
          <h2 className="font-bold text-ber-carbon">{isNew ? 'Nova Oportunidade' : 'Editar Oportunidade'}</h2>
          <button onClick={onClose} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button>
        </div>
        <div className="flex-1 p-4 space-y-4">
          {err && <p className="text-xs text-ber-red">{err}</p>}
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Título *</label>
            <input
              className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
              value={form.titulo}
              onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Valor</label>
              <input
                type="number"
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                placeholder="R$"
                value={form.valor}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Fechamento</label>
              <input
                type="date"
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                value={form.dataFechamentoPrevisto}
                onChange={(e) => setForm((f) => ({ ...f, dataFechamentoPrevisto: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Etapa</label>
              <select
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                value={form.etapa}
                onChange={(e) => setForm((f) => ({ ...f, etapa: e.target.value }))}
              >
                {ETAPAS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Origem</label>
              <select
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                value={form.origem}
                onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value }))}
              >
                <option value="">--</option>
                {ORIGENS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Probabilidade</label>
              <select
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                value={form.probabilidade}
                onChange={(e) => setForm((f) => ({ ...f, probabilidade: e.target.value }))}
              >
                <option value="">--</option>
                {PROBABILIDADES.map((p) => <option key={p.value} value={p.value}>{p.label} ({p.pct}%)</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Responsável</label>
              <select
                className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal"
                value={form.responsavelId}
                onChange={(e) => setForm((f) => ({ ...f, responsavelId: e.target.value }))}
              >
                <option value="">--</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Observações</label>
            <textarea
              className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal resize-none"
              rows={3}
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            />
          </div>
          {op?.orcamento && (
            <div className="rounded-lg border border-ber-border bg-ber-surface p-3">
              <p className="text-xs font-semibold text-ber-gray uppercase tracking-wide mb-1">Orçamento Vinculado</p>
              <p className="text-sm font-bold text-ber-carbon">{op.orcamento.numero}</p>
              <p className="text-xs text-ber-gray">{op.orcamento.status}</p>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-ber-border space-y-2">
          {confirmDelete ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              <p className="font-semibold mb-2">Confirmar exclusão?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 py-1.5 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100">Cancelar</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50">
                  {deleting ? 'Excluindo...' : 'Excluir definitivamente'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {!isNew && (
                <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg text-ber-gray hover:text-red-600 hover:bg-red-50 border border-ber-border transition-colors">
                  <Trash2 size={15} />
                </button>
              )}
              <button onClick={onClose} className="flex-1 py-2 border border-ber-border rounded-lg text-sm text-ber-gray hover:bg-ber-surface">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-ber-teal text-white rounded-lg text-sm font-semibold hover:bg-ber-teal/80 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type SortMode = 'etapa' | 'az' | 'recente';

function sortOportunidades(ops: Oportunidade[], mode: SortMode): Oportunidade[] {
  const sorted = [...ops];
  if (mode === 'az') {
    sorted.sort((a, b) => (a.titulo ?? '').localeCompare(b.titulo ?? '', 'pt-BR'));
  } else if (mode === 'recente') {
    sorted.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  } else {
    const order: string[] = ETAPAS.map((e) => e.value);
    sorted.sort((a, b) => order.indexOf(a.etapa) - order.indexOf(b.etapa));
  }
  return sorted;
}

export default function TabPipeline({ oportunidades, users, onRefresh }: Props) {
  const [drawerOp, setDrawerOp] = useState<Oportunidade | null | 'new'>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'lista'>('kanban');
  const [sortMode, setSortMode] = useState<SortMode>('etapa');

  const grouped = useCallback(() => {
    const map: Record<string, Oportunidade[]> = {};
    for (const e of KANBAN_ETAPAS) map[e.value] = [];
    for (const op of oportunidades) {
      if (map[op.etapa]) map[op.etapa].push(op);
      else if (!TERMINAL_ETAPAS.includes(op.etapa)) map['lead'].push(op);
    }
    return map;
  }, [oportunidades]);

  const byEtapa = grouped();

  const handleMoveEtapa = async (opId: string, etapa: string) => {
    await api.patch(`/crm/oportunidades/${opId}`, { etapa });
    onRefresh();
  };

  return (
    <div className="flex-1 min-h-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-ber-carbon">Pipeline</h2>
          <span className="text-xs text-ber-gray bg-ber-surface px-2 py-0.5 rounded-full">
            {oportunidades.filter((o) => !TERMINAL_ETAPAS.includes(o.etapa)).length} ativos
          </span>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'lista' && (
            <div className="flex items-center rounded-lg border border-ber-border bg-white p-0.5">
              {([['etapa', 'Etapa'], ['az', 'A–Z'], ['recente', 'Recente']] as [SortMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setSortMode(mode)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${sortMode === mode ? 'bg-ber-carbon text-white' : 'text-ber-gray hover:text-ber-carbon'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center rounded-lg border border-ber-border bg-white p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              title="Kanban"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${viewMode === 'kanban' ? 'bg-ber-teal text-white' : 'text-ber-gray hover:text-ber-carbon'}`}
            >
              <LayoutGrid size={12} /> Kanban
            </button>
            <button
              onClick={() => setViewMode('lista')}
              title="Lista"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${viewMode === 'lista' ? 'bg-ber-teal text-white' : 'text-ber-gray hover:text-ber-carbon'}`}
            >
              <LayoutList size={12} /> Lista
            </button>
          </div>
          <button
            onClick={() => setDrawerOp('new')}
            className="flex items-center gap-1.5 bg-ber-teal text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-ber-teal/80"
          >
            <Plus size={14} /> Nova Oportunidade
          </button>
        </div>
      </div>

      {viewMode === 'lista' && (
        <div className="rounded-xl border border-ber-border bg-white overflow-hidden mb-4">
          <div className="grid grid-cols-[1fr_130px_110px_90px_90px_80px] gap-3 px-4 py-2.5 bg-ber-surface border-b border-ber-border text-[10px] font-bold uppercase tracking-wide text-ber-gray">
            <span>Oportunidade</span>
            <span>Etapa</span>
            <span>Empresa</span>
            <span>Responsável</span>
            <span>Probabilidade</span>
            <span className="text-right">Valor</span>
          </div>
          {oportunidades.length === 0 && (
            <p className="text-center text-xs text-ber-gray py-10">Nenhuma oportunidade.</p>
          )}
          {sortOportunidades(oportunidades, sortMode).map((op, idx) => {
              const etapaCfg = ETAPA_MAP[op.etapa];
              const probCfg = PROBABILIDADES.find((p) => p.value === op.probabilidade);
              return (
                <div
                  key={op.id}
                  onClick={() => setDrawerOp(op)}
                  className="cursor-pointer grid grid-cols-[1fr_130px_110px_90px_90px_80px] gap-3 px-4 py-2.5 items-center text-xs hover:bg-ber-surface transition-colors border-b border-ber-border/50 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ber-carbon truncate">{op.titulo}</p>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: etapaCfg?.color ?? '#aaa' }} />
                    <span className="text-ber-gray truncate">{etapaCfg?.label ?? op.etapa}</span>
                  </div>
                  <span className="text-ber-gray truncate">{op.empresa?.razaoSocial ?? '—'}</span>
                  <span className="text-ber-gray truncate">{op.responsavel?.name ?? '—'}</span>
                  <span>
                    {probCfg
                      ? <span className="rounded-full bg-ber-surface px-2 py-0.5 text-[10px] font-semibold text-ber-carbon">{probCfg.label} ({probCfg.pct}%)</span>
                      : <span className="text-ber-gray/40">—</span>}
                  </span>
                  <span className="text-right font-bold text-ber-carbon">{fmt(op.valor)}</span>
                </div>
              );
            })}
          <div className="grid grid-cols-[1fr_130px_110px_90px_90px_80px] gap-3 px-4 py-2.5 border-t border-ber-border bg-ber-surface text-xs font-bold text-ber-carbon">
            <span>{oportunidades.length} itens</span>
            <span /><span /><span /><span />
            <span className="text-right">{fmt(oportunidades.reduce((s, o) => s + (o.valor ?? 0), 0))}</span>
          </div>
        </div>
      )}

      <div className={`flex gap-3 overflow-x-auto pb-4 ${viewMode === 'lista' ? 'hidden' : ''}`} style={{ minHeight: '70vh' }}>
        {KANBAN_ETAPAS.map((etapa) => {
          const cards = byEtapa[etapa.value] ?? [];
          const totalValor = cards.reduce((s, c) => s + (c.valor ?? 0), 0);
          return (
            <div key={etapa.value} className="flex-shrink-0 w-64 flex flex-col">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: etapa.color }} />
                <span className="text-xs font-bold text-ber-carbon uppercase tracking-wide">{etapa.label}</span>
                <span className="ml-auto text-xs text-ber-gray bg-ber-surface rounded-full px-1.5">{cards.length}</span>
              </div>
              {totalValor > 0 && (
                <p className="text-[11px] text-ber-gray px-1 mb-2">{fmt(totalValor)}</p>
              )}
              <div className="flex-1 bg-ber-surface rounded-xl p-2 space-y-2 overflow-y-auto">
                {cards.map((op) => (
                  <CardOportunidade key={op.id} op={op} onClick={() => setDrawerOp(op)} />
                ))}
                {cards.length === 0 && (
                  <p className="text-center text-xs text-ber-gray/50 py-4">Vazio</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {drawerOp !== null && (
        <DrawerBoundary onClose={() => setDrawerOp(null)}>
          <OportunidadeDrawer
            op={drawerOp === 'new' ? null : drawerOp}
            users={users}
            onClose={() => setDrawerOp(null)}
            onSave={() => { setDrawerOp(null); onRefresh(); }}
          />
        </DrawerBoundary>
      )}
    </div>
  );
}
