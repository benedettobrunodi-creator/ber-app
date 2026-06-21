'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useBackToObra } from '@/hooks/useBackToObra';
import Link from 'next/link';
import { ArrowLeft, Plus, Users, Trash2, X, Pencil, Mail, Phone } from 'lucide-react';
import api from '@/lib/api';

interface Stakeholder {
  id: string;
  empresa: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  funcao: string | null;
  ordem: number;
}

const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

export default function StakeholdersPage() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;
  const backHref = useBackToObra();
  const [obraName, setObraName] = useState('');
  const [items, setItems] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<Stakeholder | true | null>(null);

  async function fetchAll() {
    setLoading(true);
    try {
      const [list, obraRes] = await Promise.all([
        api.get<{ data: Stakeholder[] }>(`/obras/${obraId}/stakeholders`),
        api.get(`/obras/${obraId}`),
      ]);
      setItems(list.data.data);
      setObraName(obraRes.data.data.name);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchAll(); }, [obraId]);

  async function handleDelete(id: string) {
    if (!confirm('Remover este stakeholder?')) return;
    try { await api.delete(`/stakeholders/${id}`); fetchAll(); }
    catch (err) { alert(errMsg(err, 'Erro ao excluir')); }
  }

  // group by empresa for visualization
  const groups = items.reduce((acc, s) => {
    (acc[s.empresa] ||= []).push(s);
    return acc;
  }, {} as Record<string, Stakeholder[]>);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={backHref} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> {obraName || 'Obra'}
        </Link>
        <span>/</span><span className="text-ber-carbon font-medium">Stakeholders</span>
      </div>

      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-ber-teal" />
          <h1 className="text-xl font-black text-ber-carbon">Stakeholders</h1>
          <span className="text-sm text-ber-gray">· {items.length} contatos</span>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-2 text-sm font-medium text-white hover:bg-ber-black">
          <Plus size={14} /> Novo contato
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center text-sm text-ber-gray">Carregando…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center">
          <Users size={28} className="mx-auto mb-2 text-ber-gray/40" />
          <p className="text-sm font-medium text-ber-gray">Nenhum stakeholder cadastrado</p>
          <p className="mt-1 text-xs text-ber-gray/60">Adicione cliente, arquiteto, gerenciadora, fornecedores-chave…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(groups).map(([empresa, list]) => (
            <div key={empresa} className="rounded-xl border border-ber-gray/15 bg-white shadow-sm overflow-hidden">
              <div className="bg-ber-carbon px-4 py-2 text-xs font-bold text-white uppercase tracking-wide">{empresa}</div>
              <ul className="divide-y divide-ber-gray/10">
                {list.map(s => (
                  <li key={s.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ber-carbon">{s.nome}</p>
                      {(s.cargo || s.funcao) && (
                        <p className="text-xs text-ber-gray">{[s.cargo, s.funcao].filter(Boolean).join(' · ')}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-ber-gray">
                        {s.email && <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 text-ber-teal hover:underline"><Mail size={10} /> {s.email}</a>}
                        {s.telefone && <a href={`tel:${s.telefone}`} className="inline-flex items-center gap-1 text-ber-teal hover:underline"><Phone size={10} /> {s.telefone}</a>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setShowForm(s)} title="Editar" className="rounded p-1 text-ber-gray hover:bg-ber-bg hover:text-ber-carbon"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(s.id)} title="Excluir" className="rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {showForm !== null && (
        <StakeForm obraId={obraId} edit={showForm === true ? null : showForm} onClose={() => setShowForm(null)} onSaved={() => { setShowForm(null); fetchAll(); }} />
      )}
    </div>
  );
}

function StakeForm({ obraId, edit, onClose, onSaved }: { obraId: string; edit: Stakeholder | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    empresa: edit?.empresa || '',
    nome: edit?.nome || '',
    cargo: edit?.cargo || '',
    funcao: edit?.funcao || '',
    email: edit?.email || '',
    telefone: edit?.telefone || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.empresa.trim() || !f.nome.trim()) { setError('Empresa e nome são obrigatórios.'); return; }
    setSaving(true);
    try {
      const body = {
        empresa: f.empresa.trim(),
        nome: f.nome.trim(),
        cargo: f.cargo.trim() || null,
        funcao: f.funcao.trim() || null,
        email: f.email.trim() || null,
        telefone: f.telefone.trim() || null,
      };
      if (edit) await api.patch(`/stakeholders/${edit.id}`, body);
      else await api.post(`/obras/${obraId}/stakeholders`, body);
      onSaved();
    } catch (err) { setError(errMsg(err, 'Erro ao salvar')); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-t-2xl md:rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
          <h2 className="text-lg font-black text-ber-carbon">{edit ? 'Editar Stakeholder' : 'Novo Stakeholder'}</h2>
          <button onClick={onClose} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite hover:text-ber-carbon"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Empresa *"><input value={f.empresa} onChange={e => setF(p => ({ ...p, empresa: e.target.value }))} className={inputCls} required /></Field>
            <Field label="Nome *"><input value={f.nome} onChange={e => setF(p => ({ ...p, nome: e.target.value }))} className={inputCls} required /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cargo"><input value={f.cargo} onChange={e => setF(p => ({ ...p, cargo: e.target.value }))} className={inputCls} placeholder="Ex: Diretor, Arquiteto…" /></Field>
            <Field label="Função no projeto"><input value={f.funcao} onChange={e => setF(p => ({ ...p, funcao: e.target.value }))} className={inputCls} placeholder="Ex: Decision maker, Aprovador…" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email"><input type="email" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} className={inputCls} /></Field>
            <Field label="Telefone"><input value={f.telefone} onChange={e => setF(p => ({ ...p, telefone: e.target.value }))} className={inputCls} /></Field>
          </div>
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
