'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useBackToObra } from '@/hooks/useBackToObra';
import Link from 'next/link';
import { ArrowLeft, Plus, CalendarClock, Trash2, X, AlertTriangle, CheckCircle2, Pencil } from 'lucide-react';
import api from '@/lib/api';

const STATUS_META: Record<string, { label: string; color: string }> = {
  a_contratar: { label: 'A contratar',  color: 'bg-gray-200 text-gray-700' },
  em_cotacao:  { label: 'Em cotação',   color: 'bg-amber-100 text-amber-700' },
  contratado:  { label: 'Contratado',   color: 'bg-green-100 text-green-700' },
  atrasado:    { label: 'Atrasado ⚠',  color: 'bg-red-100 text-red-700' },
};

interface Plano {
  id: string;
  pacote: string;
  dataIdeal: string | null;
  dataLimite: string | null;
  contratacaoId: string | null;
  status: keyof typeof STATUS_META;
  statusEfetivo: keyof typeof STATUS_META;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  responsavel: string | null;
  empresaContratada: string | null;
  tempoEntrega: string | null;
  dataEmissaoPedido: string | null;
  inicioMobilizacao: string | null;
  observacoes: string | null;
  contratacao: { id: string; fornecedor: string; valor: string | number; status: string } | null;
}

interface Contratacao { id: string; fornecedor: string; disciplina: string | null }

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

export default function CronogramaContratacoesPage() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;
  const backHref = useBackToObra();
  const [obraName, setObraName] = useState('');
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [comprasPeople, setComprasPeople] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<Plano | true | null>(null);

  async function fetchAll() {
    setLoading(true);
    try {
      const [p, u, obraRes] = await Promise.all([
        api.get<{ data: Plano[] }>(`/obras/${obraId}/contratacao-plano`),
        api.get<{ data: { id: string; name: string; role: string }[] }>(`/users/responsaveis`),
        api.get(`/obras/${obraId}`),
      ]);
      setPlanos(p.data.data);
      setComprasPeople(u.data.data.filter(x => x.role === 'compras').map(x => x.name));
      setObraName(obraRes.data.data.name);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchAll(); }, [obraId]);

  async function updateStatus(id: string, status: string) {
    try { await api.patch(`/contratacao-plano/${id}`, { status }); fetchAll(); }
    catch (err) { alert(errMsg(err, 'Erro ao atualizar')); }
  }

  async function saveField(id: string, patch: Record<string, string | null>) {
    // Atualiza local otimista (sem refetch pra não perder o foco) e persiste.
    setPlanos(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
    try { await api.patch(`/contratacao-plano/${id}`, patch); }
    catch (err) { alert(errMsg(err, 'Erro ao salvar')); fetchAll(); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este pacote do cronograma?')) return;
    try { await api.delete(`/contratacao-plano/${id}`); fetchAll(); }
    catch (err) { alert(errMsg(err, 'Erro ao excluir')); }
  }

  const counts = planos.reduce((acc, p) => {
    acc[p.statusEfetivo] = (acc[p.statusEfetivo] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const atrasados = counts['atrasado'] ?? 0;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={backHref} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> {obraName || 'Obra'}
        </Link>
        <span>/</span><span className="text-ber-carbon font-medium">Cronograma de Contratações</span>
      </div>

      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock size={20} className="text-ber-teal" />
          <h1 className="text-xl font-black text-ber-carbon">Cronograma de Contratações</h1>
          {atrasados > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[11px] font-semibold">
              <AlertTriangle size={11} /> {atrasados} atrasado{atrasados > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-2 text-sm font-medium text-white hover:bg-ber-black">
          <Plus size={14} /> Novo pacote
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(STATUS_META).map(([k, m]) => (
          <div key={k} className="rounded-xl bg-white border border-ber-gray/15 p-3 shadow-sm">
            <p className="text-[10px] font-medium text-ber-gray uppercase tracking-wide">{m.label}</p>
            <p className="mt-1 text-xl font-bold text-ber-carbon">{counts[k] ?? 0}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center text-sm text-ber-gray">Carregando…</div>
      ) : planos.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center">
          <CalendarClock size={28} className="mx-auto mb-2 text-ber-gray/40" />
          <p className="text-sm font-medium text-ber-gray">Nenhum pacote no cronograma</p>
          <p className="mt-1 text-xs text-ber-gray/60">Cadastre pacotes (disciplinas/etapas) com data ideal e prazo limite pra contratar</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ber-gray/10 bg-white shadow-sm">
          <table className="w-max min-w-full text-sm">
            <thead className="bg-ber-carbon text-xs text-white">
              <tr>
                <th className="px-3 py-3 text-left w-64">Disciplina / Serviço</th>
                <th className="px-3 py-3 text-left w-52">Responsável</th>
                <th className="px-3 py-3 text-center w-44">Tempo entrega / mob.</th>
                <th className="px-3 py-3 text-center w-44">Data ideal</th>
                <th className="px-3 py-3 text-center w-44">Data limite</th>
                <th className="px-3 py-3 text-center w-36">Status</th>
                <th className="px-3 py-3 text-center w-44">Data emissão pedido</th>
                <th className="px-3 py-3 text-left w-60">Empresa contratada</th>
                <th className="px-3 py-3 text-left w-52">Contato</th>
                <th className="px-3 py-3 text-left w-44">WhatsApp</th>
                <th className="px-3 py-3 text-left w-64">E-mail</th>
                <th className="px-3 py-3 text-center w-44">Início mobilização</th>
                <th className="px-3 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {planos.map(p => {
                const meta = STATUS_META[p.statusEfetivo] || STATUS_META.a_contratar;
                const limitePassed = p.dataLimite && new Date(p.dataLimite).getTime() < Date.now() && p.statusEfetivo !== 'contratado';
                return (
                  <tr key={p.id} className={`border-t border-ber-gray/10 hover:bg-ber-bg/40 ${limitePassed ? 'bg-red-50/30' : ''}`}>
                    <td className="px-3 py-2.5 font-medium text-ber-carbon">{p.pacote}</td>
                    <td className="px-2 py-1.5">
                      <InlineResponsavel value={p.responsavel} options={comprasPeople} onSave={v => saveField(p.id, { responsavel: v })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <InlineDate value={p.tempoEntrega} onSave={v => saveField(p.id, { tempoEntrega: v })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <InlineDate value={p.dataIdeal} onSave={v => saveField(p.id, { dataIdeal: v })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <InlineDate value={p.dataLimite} onSave={v => saveField(p.id, { dataLimite: v })} highlight={!!limitePassed} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {p.contratacaoId ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.color}`}>
                          <CheckCircle2 size={10} /> Contratado
                        </span>
                      ) : (
                        <select value={p.status} onChange={e => updateStatus(p.id, e.target.value)}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium border-0 focus:outline-none focus:ring-1 focus:ring-ber-teal ${meta.color}`}>
                          {(['a_contratar', 'em_cotacao', 'contratado'] as const).map(k => (<option key={k} value={k}>{STATUS_META[k].label}</option>))}
                        </select>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <InlineDate value={p.dataEmissaoPedido} onSave={v => saveField(p.id, { dataEmissaoPedido: v })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <InlineText value={p.empresaContratada} placeholder="Empresa…" onSave={v => saveField(p.id, { empresaContratada: v })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <InlineText value={p.contato} placeholder="Nome…" onSave={v => saveField(p.id, { contato: v })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <InlineText value={p.telefone} placeholder="WhatsApp…" type="tel" onSave={v => saveField(p.id, { telefone: v })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <InlineText value={p.email} placeholder="E-mail…" type="email" onSave={v => saveField(p.id, { email: v })} />
                    </td>
                    <td className="px-2 py-1.5">
                      <InlineDate value={p.inicioMobilizacao} onSave={v => saveField(p.id, { inicioMobilizacao: v })} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setShowForm(p)} title="Editar" className="rounded p-1 text-ber-gray hover:bg-ber-bg hover:text-ber-carbon"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(p.id)} title="Excluir" className="rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm !== null && (
        <PlanoForm obraId={obraId} edit={showForm === true ? null : showForm} comprasPeople={comprasPeople} onClose={() => setShowForm(null)} onSaved={() => { setShowForm(null); fetchAll(); }} />
      )}
    </div>
  );
}

function PlanoForm({ obraId, edit, comprasPeople, onClose, onSaved }: { obraId: string; edit: Plano | null; comprasPeople: string[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    pacote: edit?.pacote || '',
    responsavel: edit?.responsavel || '',
    tempoEntrega: edit?.tempoEntrega ? edit.tempoEntrega.slice(0, 10) : '',
    dataIdeal: edit?.dataIdeal ? edit.dataIdeal.slice(0, 10) : '',
    dataLimite: edit?.dataLimite ? edit.dataLimite.slice(0, 10) : '',
    dataEmissaoPedido: edit?.dataEmissaoPedido ? edit.dataEmissaoPedido.slice(0, 10) : '',
    empresaContratada: edit?.empresaContratada || '',
    inicioMobilizacao: edit?.inicioMobilizacao ? edit.inicioMobilizacao.slice(0, 10) : '',
    contato: edit?.contato || '',
    telefone: edit?.telefone || '',
    email: edit?.email || '',
    observacoes: edit?.observacoes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.pacote.trim()) { setError('Informe o pacote (disciplina ou etapa).'); return; }
    setSaving(true);
    try {
      const body = {
        pacote: f.pacote.trim(),
        responsavel: f.responsavel.trim() || null,
        tempoEntrega: f.tempoEntrega || null,
        dataIdeal: f.dataIdeal || null,
        dataLimite: f.dataLimite || null,
        dataEmissaoPedido: f.dataEmissaoPedido || null,
        empresaContratada: f.empresaContratada.trim() || null,
        inicioMobilizacao: f.inicioMobilizacao || null,
        contato: f.contato.trim() || null,
        telefone: f.telefone.trim() || null,
        email: f.email.trim() || null,
        observacoes: f.observacoes.trim() || null,
      };
      if (edit) await api.patch(`/contratacao-plano/${edit.id}`, body);
      else await api.post(`/obras/${obraId}/contratacao-plano`, body);
      onSaved();
    } catch (err) { setError(errMsg(err, 'Erro ao salvar')); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-t-2xl md:rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
          <h2 className="text-lg font-black text-ber-carbon">{edit ? 'Editar Pacote' : 'Novo Pacote'}</h2>
          <button onClick={onClose} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite hover:text-ber-carbon"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <Field label="Disciplina / Serviço *"><input value={f.pacote} onChange={e => setF(p => ({ ...p, pacote: e.target.value }))} placeholder="Ex: Civil, Elétrica, Marmoraria…" className={inputCls} required /></Field>
          <Field label="Responsável pela contratação">
            <select value={f.responsavel} onChange={e => setF(p => ({ ...p, responsavel: e.target.value }))} className={inputCls}>
              <option value="">—</option>
              {(f.responsavel && !comprasPeople.includes(f.responsavel) ? [f.responsavel, ...comprasPeople] : comprasPeople).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tempo de entrega / mobilização"><input type="date" value={f.tempoEntrega} onChange={e => setF(p => ({ ...p, tempoEntrega: e.target.value }))} className={inputCls} /></Field>
            <Field label="Início da mobilização"><input type="date" value={f.inicioMobilizacao} onChange={e => setF(p => ({ ...p, inicioMobilizacao: e.target.value }))} className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data ideal de contratação"><input type="date" value={f.dataIdeal} onChange={e => setF(p => ({ ...p, dataIdeal: e.target.value }))} className={inputCls} /></Field>
            <Field label="Data limite"><input type="date" value={f.dataLimite} onChange={e => setF(p => ({ ...p, dataLimite: e.target.value }))} className={inputCls} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data emissão do pedido"><input type="date" value={f.dataEmissaoPedido} onChange={e => setF(p => ({ ...p, dataEmissaoPedido: e.target.value }))} className={inputCls} /></Field>
            <Field label="Empresa contratada"><input value={f.empresaContratada} onChange={e => setF(p => ({ ...p, empresaContratada: e.target.value }))} placeholder="Ex: LM Empreiteira" className={inputCls} /></Field>
          </div>
          <Field label="Contato (fornecedor)"><input value={f.contato} onChange={e => setF(p => ({ ...p, contato: e.target.value }))} placeholder="Nome do contato" className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="WhatsApp"><input type="tel" value={f.telefone} onChange={e => setF(p => ({ ...p, telefone: e.target.value }))} placeholder="(11) 90000-0000" className={inputCls} /></Field>
            <Field label="E-mail"><input type="email" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} placeholder="contato@fornecedor.com" className={inputCls} /></Field>
          </div>
          <Field label="Observações"><textarea rows={2} value={f.observacoes} onChange={e => setF(p => ({ ...p, observacoes: e.target.value }))} className={inputCls} /></Field>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = 'mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-ber-gray uppercase tracking-wide">{label}</label>{children}</div>;
}

// Célula editável inline — salva no blur (só se mudou), não controlada pra não perder foco.
function InlineText({ value, placeholder, type, onSave }: { value: string | null; placeholder?: string; type?: string; onSave: (v: string | null) => void }) {
  return (
    <input
      key={value ?? ''}
      defaultValue={value ?? ''}
      type={type || 'text'}
      placeholder={placeholder}
      onBlur={e => { const v = e.target.value.trim(); if (v !== (value ?? '')) onSave(v || null); }}
      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs text-ber-carbon placeholder:text-ber-gray/40 hover:border-ber-gray/20 focus:border-ber-teal focus:outline-none"
    />
  );
}

// Célula de data editável inline (salva no change).
function InlineDate({ value, onSave, highlight }: { value: string | null; onSave: (v: string | null) => void; highlight?: boolean }) {
  const iso = value ? value.slice(0, 10) : '';
  return (
    <input
      key={iso}
      type="date"
      defaultValue={iso}
      onChange={e => { const v = e.target.value || null; if ((v ?? '') !== iso) onSave(v); }}
      className={`w-full rounded border bg-transparent px-1 py-1 text-xs tabular-nums focus:border-ber-teal focus:outline-none ${highlight ? 'border-red-300 text-red-700 font-semibold' : 'border-transparent text-ber-carbon hover:border-ber-gray/20'}`}
    />
  );
}

// Dropdown do responsável — pessoal de compras. Mantém valor legado fora da lista.
function InlineResponsavel({ value, options, onSave }: { value: string | null; options: string[]; onSave: (v: string | null) => void }) {
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select value={value ?? ''} onChange={e => onSave(e.target.value || null)}
      className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-xs text-ber-carbon hover:border-ber-gray/20 focus:border-ber-teal focus:outline-none">
      <option value="">—</option>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
