'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';

export interface Stakeholder {
  id: string;
  empresa: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  funcao: string | null;
  ordem?: number;
}

const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

interface Props {
  obraId: string;
  edit: Stakeholder | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function StakeholderFormModal({ obraId, edit, onClose, onSaved }: Props) {
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
    if (!f.empresa.trim() || !f.nome.trim()) {
      setError('Empresa e nome são obrigatórios.');
      return;
    }
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
    } catch (err) {
      setError(errMsg(err, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-t-2xl md:rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
          <h2 className="text-lg font-black text-ber-carbon">{edit ? 'Editar contato' : 'Novo contato'}</h2>
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
  return (
    <div>
      <label className="block text-xs font-medium text-ber-gray uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
