'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Palmtree, Plus, Trash2, X, ChevronLeft, ChevronRight, Users, Pencil } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore, getUserPermissions } from '@/stores/authStore';

/* ─── Types ─── */
interface Periodo {
  id: string;
  colaboradorId: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string;    // YYYY-MM-DD
  dias: number;
  observacoes: string | null;
}
interface Colaborador {
  id: string;
  userId: string | null;
  nome: string;
  cargo: string | null;
  feriasATirarDias: number;
  ativo: boolean;
  ordem: number;
  diasUsados: number;
  saldoEmAberto: number;
  ferias: Periodo[];
}

/* ─── Date helpers ─── */
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInMonth = (y: number) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const totalDays = (y: number) => (isLeap(y) ? 366 : 365);
const fmtBR = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
};
const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

/* ─── Bar geometry for a período within a year ─── */
function barGeom(p: Periodo, year: number): { left: number; width: number } | null {
  const yStart = Date.UTC(year, 0, 1);
  const yEnd = Date.UTC(year, 11, 31);
  const s = Math.max(new Date(p.dataInicio + 'T00:00:00Z').getTime(), yStart);
  const e = Math.min(new Date(p.dataFim + 'T00:00:00Z').getTime(), yEnd);
  if (e < s) return null;
  const total = totalDays(year);
  const startDoy = Math.floor((s - yStart) / 86_400_000);
  const endDoy = Math.floor((e - yStart) / 86_400_000);
  return { left: (startDoy / total) * 100, width: ((endDoy - startDoy + 1) / total) * 100 };
}

export default function FeriasPage() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const canView = user ? getUserPermissions(user).ferias === true : false;
  useEffect(() => { if (user && !canView) router.replace('/'); }, [user, canView, router]);

  const [colabs, setColabs] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [showColabForm, setShowColabForm] = useState<Colaborador | true | null>(null);
  const [periodoForm, setPeriodoForm] = useState<{ colab: Colaborador; edit: Periodo | null; prefill?: string } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get<{ data: Colaborador[] }>('/ferias/colaboradores')
      .then(r => setColabs(r.data.data))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const dim = useMemo(() => daysInMonth(year), [year]);
  const detailColab = detailId ? colabs.find(c => c.id === detailId) ?? null : null;

  async function saveFeriasATirar(id: string, dias: number) {
    setColabs(prev => prev.map(c => c.id === id
      ? { ...c, feriasATirarDias: dias, saldoEmAberto: dias - c.diasUsados }
      : c));
    try { await api.patch(`/ferias/colaboradores/${id}`, { feriasATirarDias: dias }); }
    catch (err) { alert(errMsg(err, 'Erro ao salvar')); load(); }
  }

  async function deleteColab(c: Colaborador) {
    if (!confirm(`Remover ${c.nome} da lista de férias?`)) return;
    try { await api.delete(`/ferias/colaboradores/${c.id}`); load(); }
    catch (err) { alert(errMsg(err, 'Erro ao excluir')); }
  }

  if (!user || !canView) return null;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Palmtree size={20} className="text-ber-teal" />
          <h1 className="text-xl font-black text-ber-carbon">Controle de Férias</h1>
          <span className="text-sm text-ber-gray">· {colabs.length} colaboradores</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-ber-gray/20 bg-white px-1">
            <button onClick={() => setYear(y => y - 1)} className="rounded p-1.5 text-ber-gray hover:bg-ber-bg"><ChevronLeft size={16} /></button>
            <span className="min-w-[3rem] text-center text-sm font-bold text-ber-carbon">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="rounded p-1.5 text-ber-gray hover:bg-ber-bg"><ChevronRight size={16} /></button>
          </div>
          <button onClick={() => setShowColabForm(true)} className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-2 text-sm font-medium text-white hover:bg-ber-black">
            <Plus size={14} /> Colaborador
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center text-sm text-ber-gray">Carregando…</div>
      ) : colabs.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center">
          <Users size={28} className="mx-auto mb-2 text-ber-gray/40" />
          <p className="text-sm font-medium text-ber-gray">Nenhum colaborador cadastrado</p>
          <p className="mt-1 text-xs text-ber-gray/60">Cadastre os colaboradores e o saldo de férias de cada um</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ber-gray/10 bg-white shadow-sm">
          <div className="min-w-[900px]">
            {/* Header */}
            <div className="flex items-stretch border-b border-ber-gray/15 bg-ber-bg text-[10px] font-bold uppercase tracking-wide text-ber-gray">
              <div className="w-56 shrink-0 px-3 py-2">Colaborador</div>
              <div className="w-24 shrink-0 px-2 py-2 text-center">A tirar</div>
              <div className="w-24 shrink-0 px-2 py-2 text-center">Em aberto</div>
              <div className="flex flex-1">
                {MESES.map((m, i) => (
                  <div key={m} style={{ flexGrow: dim[i], flexBasis: 0 }} className="border-l border-ber-gray/10 px-1 py-2 text-center">{m}</div>
                ))}
              </div>
            </div>

            {/* Rows */}
            {colabs.map(c => (
              <div key={c.id} className="flex items-stretch border-b border-ber-gray/8 hover:bg-ber-bg/30">
                {/* Nome + cargo — clique abre o painel do colaborador (add período) */}
                <div className="w-56 shrink-0 px-3 py-2">
                  <button onClick={() => setDetailId(c.id)} className="block text-left w-full group">
                    <p className="text-sm font-medium text-ber-carbon leading-tight group-hover:text-ber-teal">{c.nome}</p>
                    {c.cargo && <p className="text-[11px] text-ber-gray">{c.cargo}</p>}
                  </button>
                </div>
                {/* Férias a tirar (editável) */}
                <div className="w-24 shrink-0 px-2 py-2 text-center">
                  <input type="number" min={0} max={365} defaultValue={c.feriasATirarDias}
                    key={`fat-${c.id}-${c.feriasATirarDias}`}
                    onBlur={e => { const v = Math.max(0, Number(e.target.value) || 0); if (v !== c.feriasATirarDias) saveFeriasATirar(c.id, v); }}
                    className="w-16 rounded border border-ber-gray/25 px-1 py-0.5 text-center text-xs tabular-nums focus:border-ber-teal focus:outline-none" />
                </div>
                {/* Saldo em aberto */}
                <div className="w-24 shrink-0 px-2 py-2 text-center">
                  <span className={`text-sm font-bold tabular-nums ${c.saldoEmAberto < 0 ? 'text-red-600' : c.saldoEmAberto === 0 ? 'text-ber-gray' : 'text-green-600'}`}>
                    {c.saldoEmAberto}
                  </span>
                  <span className="block text-[9px] text-ber-gray/60">dias</span>
                </div>
                {/* Timeline track */}
                <div className="relative flex flex-1">
                  {MESES.map((m, i) => (
                    <div key={m} style={{ flexGrow: dim[i], flexBasis: 0 }}
                      onClick={() => setPeriodoForm({ colab: c, edit: null, prefill: `${year}-${String(i + 1).padStart(2, '0')}-01` })}
                      className="cursor-pointer border-l border-ber-gray/10 first:border-l-0 hover:bg-ber-teal/5" title="Adicionar período" />
                  ))}
                  {/* Barras */}
                  {c.ferias.map(p => {
                    const g = barGeom(p, year);
                    if (!g) return null;
                    return (
                      <button key={p.id}
                        onClick={() => setPeriodoForm({ colab: c, edit: p })}
                        style={{ left: `${g.left}%`, width: `${g.width}%` }}
                        className="absolute top-1.5 bottom-1.5 flex items-center justify-center overflow-hidden rounded bg-ber-teal px-1 text-[9px] font-semibold text-white shadow-sm hover:bg-ber-teal/80"
                        title={`${fmtBR(p.dataInicio)} – ${fmtBR(p.dataFim)} · ${p.dias} dias${p.observacoes ? ' · ' + p.observacoes : ''}`}>
                        <span className="truncate">{p.dias}d</span>
                      </button>
                    );
                  })}
                </div>
                {/* Ações */}
                <div className="w-10 shrink-0 flex items-center justify-center">
                  <button onClick={() => deleteColab(c)} title={c.userId ? 'Inativar colaborador' : 'Remover colaborador'} className="rounded p-1 text-ber-gray/50 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-ber-gray/70">Clique num mês na linha do colaborador para adicionar um período; clique numa barra para editar. Desconto em dias corridos.</p>

      {detailColab && (
        <ColabDetail colab={detailColab}
          onClose={() => setDetailId(null)}
          onAddPeriodo={() => setPeriodoForm({ colab: detailColab, edit: null })}
          onEditPeriodo={(p) => setPeriodoForm({ colab: detailColab, edit: p })}
          onEditColab={() => setShowColabForm(detailColab)} />
      )}
      {showColabForm !== null && (
        <ColabForm edit={showColabForm === true ? null : showColabForm}
          onClose={() => setShowColabForm(null)}
          onSaved={() => { setShowColabForm(null); load(); }} />
      )}
      {periodoForm && (
        <PeriodoForm ctx={periodoForm}
          onClose={() => setPeriodoForm(null)}
          onSaved={() => { setPeriodoForm(null); load(); }} />
      )}
    </div>
  );
}

/* ─── Painel do colaborador: saldo + adicionar/editar períodos ─── */
function ColabDetail({ colab, onClose, onAddPeriodo, onEditPeriodo, onEditColab }: {
  colab: Colaborador;
  onClose: () => void;
  onAddPeriodo: () => void;
  onEditPeriodo: (p: Periodo) => void;
  onEditColab: () => void;
}) {
  return (
    <Modal title={colab.nome} onClose={onClose}>
      <div className="space-y-4 px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            {colab.cargo && <p className="text-sm text-ber-gray">{colab.cargo}</p>}
            <p className="mt-0.5 text-xs text-ber-gray/70">Férias a tirar: <b className="text-ber-carbon">{colab.feriasATirarDias}</b> · usadas: <b className="text-ber-carbon">{colab.diasUsados}</b></p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-black tabular-nums ${colab.saldoEmAberto < 0 ? 'text-red-600' : colab.saldoEmAberto === 0 ? 'text-ber-gray' : 'text-green-600'}`}>{colab.saldoEmAberto}</p>
            <p className="text-[10px] uppercase tracking-wide text-ber-gray">dias em aberto</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-ber-offwhite pt-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-ber-gray">Períodos de férias</h3>
          <button onClick={onAddPeriodo} className="flex items-center gap-1 rounded-lg bg-ber-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-ber-teal/90">
            <Plus size={13} /> Adicionar período
          </button>
        </div>

        {colab.ferias.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ber-gray/25 py-6 text-center text-xs text-ber-gray">Nenhum período lançado ainda. Clique em “Adicionar período” e informe as datas.</p>
        ) : (
          <ul className="divide-y divide-ber-gray/10 overflow-hidden rounded-lg border border-ber-gray/15">
            {colab.ferias.map(p => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2 hover:bg-ber-bg/40">
                <div>
                  <p className="text-sm font-medium text-ber-carbon">{fmtBR(p.dataInicio)} – {fmtBR(p.dataFim)}</p>
                  <p className="text-[11px] text-ber-gray">{p.dias} dias corridos{p.observacoes ? ` · ${p.observacoes}` : ''}</p>
                </div>
                <button onClick={() => onEditPeriodo(p)} title="Editar período" className="rounded p-1 text-ber-gray hover:bg-ber-bg hover:text-ber-teal"><Pencil size={14} /></button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between pt-1">
          <button onClick={onEditColab} className="text-xs font-medium text-ber-teal hover:underline">Editar dados do colaborador</button>
          <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Fechar</button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Colaborador modal ─── */
function ColabForm({ edit, onClose, onSaved }: { edit: Colaborador | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    nome: edit?.nome || '',
    cargo: edit?.cargo || '',
    feriasATirarDias: edit?.feriasATirarDias ?? 30,
    ativo: edit?.ativo ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome.trim()) { setError('Informe o nome.'); return; }
    setSaving(true);
    try {
      const body = { nome: f.nome.trim(), cargo: f.cargo.trim() || null, feriasATirarDias: Number(f.feriasATirarDias) || 0, ativo: f.ativo };
      if (edit) await api.patch(`/ferias/colaboradores/${edit.id}`, body);
      else await api.post('/ferias/colaboradores', body);
      onSaved();
    } catch (err) { setError(errMsg(err, 'Erro ao salvar')); }
    finally { setSaving(false); }
  }

  return (
    <Modal title={edit ? 'Editar Colaborador' : 'Novo Colaborador'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 px-6 py-5">
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <Field label="Nome *"><input value={f.nome} onChange={e => setF(p => ({ ...p, nome: e.target.value }))} className={inputCls} required /></Field>
        <Field label="Cargo"><input value={f.cargo} onChange={e => setF(p => ({ ...p, cargo: e.target.value }))} placeholder="Ex: Engenheiro, Mestre de obras…" className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Férias a tirar (dias)"><input type="number" min={0} max={365} value={f.feriasATirarDias} onChange={e => setF(p => ({ ...p, feriasATirarDias: Number(e.target.value) }))} className={inputCls} /></Field>
          <Field label="Situação">
            <select value={f.ativo ? '1' : '0'} onChange={e => setF(p => ({ ...p, ativo: e.target.value === '1' }))} className={inputCls}>
              <option value="1">Ativo</option>
              <option value="0">Inativo</option>
            </select>
          </Field>
        </div>
        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

/* ─── Período modal ─── */
function PeriodoForm({ ctx, onClose, onSaved }: { ctx: { colab: Colaborador; edit: Periodo | null; prefill?: string }; onClose: () => void; onSaved: () => void }) {
  const { colab, edit, prefill } = ctx;
  const [f, setF] = useState({
    dataInicio: edit?.dataInicio || prefill || '',
    dataFim: edit?.dataFim || prefill || '',
    observacoes: edit?.observacoes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dias = useMemo(() => {
    if (!f.dataInicio || !f.dataFim || f.dataFim < f.dataInicio) return 0;
    const a = new Date(f.dataInicio + 'T00:00:00Z').getTime();
    const b = new Date(f.dataFim + 'T00:00:00Z').getTime();
    return Math.floor((b - a) / 86_400_000) + 1;
  }, [f.dataInicio, f.dataFim]);

  const saldoDepois = colab.saldoEmAberto + (edit?.dias ?? 0) - dias;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.dataInicio || !f.dataFim) { setError('Informe início e fim.'); return; }
    if (f.dataFim < f.dataInicio) { setError('Data final anterior à inicial.'); return; }
    setSaving(true);
    try {
      if (edit) {
        await api.patch(`/ferias/periodos/${edit.id}`, { dataInicio: f.dataInicio, dataFim: f.dataFim, observacoes: f.observacoes.trim() || null });
      } else {
        await api.post('/ferias/periodos', { colaboradorId: colab.id, dataInicio: f.dataInicio, dataFim: f.dataFim, observacoes: f.observacoes.trim() || null });
      }
      onSaved();
    } catch (err) { setError(errMsg(err, 'Erro ao salvar')); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!edit) return;
    if (!confirm('Excluir este período de férias?')) return;
    setSaving(true);
    try { await api.delete(`/ferias/periodos/${edit.id}`); onSaved(); }
    catch (err) { setError(errMsg(err, 'Erro ao excluir')); setSaving(false); }
  }

  return (
    <Modal title={`${edit ? 'Editar' : 'Novo'} período — ${colab.nome}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 px-6 py-5">
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Início"><input type="date" value={f.dataInicio} onChange={e => setF(p => ({ ...p, dataInicio: e.target.value }))} className={inputCls} required /></Field>
          <Field label="Fim"><input type="date" value={f.dataFim} onChange={e => setF(p => ({ ...p, dataFim: e.target.value }))} className={inputCls} required /></Field>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-ber-bg px-3 py-2 text-sm">
          <span className="text-ber-gray">Dias corridos: <b className="text-ber-carbon">{dias}</b></span>
          <span className="text-ber-gray">Saldo depois: <b className={saldoDepois < 0 ? 'text-red-600' : 'text-green-600'}>{saldoDepois}</b></span>
        </div>
        <Field label="Observações"><textarea rows={2} value={f.observacoes} onChange={e => setF(p => ({ ...p, observacoes: e.target.value }))} className={inputCls} /></Field>
        <div className="flex items-center justify-between pt-2">
          <div>
            {edit && <button type="button" onClick={remove} disabled={saving} className="rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Excluir</button>}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/* ─── Shared UI ─── */
const inputCls = 'mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-ber-gray uppercase tracking-wide">{label}</label>{children}</div>;
}
function FormActions({ saving, onClose }: { saving: boolean; onClose: () => void }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
      <button type="submit" disabled={saving} className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button>
    </div>
  );
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-t-2xl md:rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
          <h2 className="text-lg font-black text-ber-carbon">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite hover:text-ber-carbon"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
