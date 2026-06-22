'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';

export interface Contratacao {
  id: string;
  fornecedor: string;
  disciplina: string | null;
  valor: string | number;
  dataAssinatura: string | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  status: string;
  observacoes: string | null;
  _count?: { ocs: number };
}

export interface Oc {
  id: string;
  numero: string;
  fornecedor: string;
  descricao: string;
  valor: string | number;
  dataEmissao?: string;
  dataPrevistaEntrega: string | null;
  dataEntregaReal?: string | null;
  status?: string;
  observacoes: string | null;
  contratacao: { id: string; fornecedor: string; disciplina: string | null } | null;
}

const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

const inputCls = 'mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ber-gray uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function FormShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-t-2xl md:rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-black text-ber-carbon">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite hover:text-ber-carbon">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function FormActions({ onClose, saving }: { onClose: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
      <button type="submit" disabled={saving} className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">
        {saving ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  );
}

interface ContratacaoProps {
  obraId: string;
  edit: Contratacao | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ContratacaoFormModal({ obraId, edit, onClose, onSaved }: ContratacaoProps) {
  const [form, setForm] = useState(() => {
    if (edit) {
      return {
        fornecedor:     edit.fornecedor,
        disciplina:     edit.disciplina ?? '',
        valor:          String(typeof edit.valor === 'string' ? parseFloat(edit.valor) : edit.valor),
        dataAssinatura: edit.dataAssinatura ? edit.dataAssinatura.slice(0, 10) : '',
        vigenciaInicio: edit.vigenciaInicio ? edit.vigenciaInicio.slice(0, 10) : '',
        vigenciaFim:    edit.vigenciaFim ? edit.vigenciaFim.slice(0, 10) : '',
        observacoes:    edit.observacoes ?? '',
      };
    }
    return { fornecedor: '', disciplina: '', valor: '', dataAssinatura: '', vigenciaInicio: '', vigenciaFim: '', observacoes: '' };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valor = Number(form.valor.replace(',', '.'));
    if (!form.fornecedor.trim() || isNaN(valor) || valor <= 0) {
      setError('Preencha fornecedor e valor.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        fornecedor:     form.fornecedor.trim(),
        disciplina:     form.disciplina.trim() || null,
        valor,
        dataAssinatura: form.dataAssinatura || null,
        vigenciaInicio: form.vigenciaInicio || null,
        vigenciaFim:    form.vigenciaFim || null,
        observacoes:    form.observacoes.trim() || null,
      };
      if (edit) await api.patch(`/contratacoes/${edit.id}`, body);
      else await api.post(`/obras/${obraId}/contratacoes`, body);
      onSaved();
    } catch (err) {
      setError(errMsg(err, 'Erro ao salvar'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormShell title={edit ? 'Editar Contratação' : 'Nova Contratação'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <Field label="Fornecedor *"><input value={form.fornecedor} onChange={e => setForm(p => ({ ...p, fornecedor: e.target.value }))} className={inputCls} required /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Disciplina"><input value={form.disciplina} onChange={e => setForm(p => ({ ...p, disciplina: e.target.value }))} className={inputCls} placeholder="Ex: Civil, Elétrica…" /></Field>
          <Field label="Valor (R$) *"><input value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} className={inputCls} inputMode="decimal" required /></Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Assinatura"><input type="date" value={form.dataAssinatura} onChange={e => setForm(p => ({ ...p, dataAssinatura: e.target.value }))} className={inputCls} /></Field>
          <Field label="Vigência início"><input type="date" value={form.vigenciaInicio} onChange={e => setForm(p => ({ ...p, vigenciaInicio: e.target.value }))} className={inputCls} /></Field>
          <Field label="Vigência fim"><input type="date" value={form.vigenciaFim} onChange={e => setForm(p => ({ ...p, vigenciaFim: e.target.value }))} className={inputCls} /></Field>
        </div>
        <Field label="Observações"><textarea rows={2} value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} className={inputCls} /></Field>
        <FormActions onClose={onClose} saving={saving} />
      </form>
    </FormShell>
  );
}

interface OcProps {
  obraId: string;
  contratacoes: Contratacao[];
  edit: Oc | null;
  onClose: () => void;
  onSaved: () => void;
}

export function OcFormModal({ obraId, contratacoes, edit, onClose, onSaved }: OcProps) {
  const [form, setForm] = useState(() => {
    if (edit) {
      return {
        numero: edit.numero,
        fornecedor: edit.fornecedor,
        descricao: edit.descricao,
        valor: String(typeof edit.valor === 'string' ? parseFloat(edit.valor) : edit.valor),
        contratacaoId: edit.contratacao?.id ?? '',
        dataPrevistaEntrega: edit.dataPrevistaEntrega ? edit.dataPrevistaEntrega.slice(0, 10) : '',
        observacoes: edit.observacoes ?? '',
      };
    }
    return { numero: '', fornecedor: '', descricao: '', valor: '', contratacaoId: '', dataPrevistaEntrega: '', observacoes: '' };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valor = Number(form.valor.replace(',', '.'));
    if (!form.numero.trim() || !form.descricao.trim() || !form.fornecedor.trim() || isNaN(valor) || valor <= 0) {
      setError('Preencha número, descrição, fornecedor e valor.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        numero: form.numero.trim(),
        fornecedor: form.fornecedor.trim(),
        descricao: form.descricao.trim(),
        valor,
        contratacaoId: form.contratacaoId || null,
        dataPrevistaEntrega: form.dataPrevistaEntrega || null,
        observacoes: form.observacoes.trim() || null,
      };
      if (edit) await api.patch(`/ordens-compra/${edit.id}`, body);
      else await api.post(`/obras/${obraId}/ordens-compra`, body);
      onSaved();
    } catch (err) {
      setError(errMsg(err, 'Erro ao salvar OC'));
    } finally {
      setSaving(false);
    }
  }

  function handleContratacaoChange(id: string) {
    const c = contratacoes.find(x => x.id === id);
    setForm(prev => ({ ...prev, contratacaoId: id, fornecedor: prev.fornecedor || c?.fornecedor || '' }));
  }

  return (
    <FormShell title={edit ? 'Editar OC' : 'Nova OC'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nº OC *"><input value={form.numero} onChange={e => setForm(p => ({ ...p, numero: e.target.value }))} placeholder="Ex: OC-001" className={inputCls} required /></Field>
          <Field label="Valor (R$) *"><input value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} inputMode="decimal" className={inputCls} required /></Field>
        </div>
        <Field label="Vincular a contratação (opcional)">
          <select value={form.contratacaoId} onChange={e => handleContratacaoChange(e.target.value)} className={inputCls}>
            <option value="">— Sem vínculo —</option>
            {contratacoes.map(c => (
              <option key={c.id} value={c.id}>{c.fornecedor}{c.disciplina ? ` · ${c.disciplina}` : ''}</option>
            ))}
          </select>
        </Field>
        <Field label="Fornecedor *"><input value={form.fornecedor} onChange={e => setForm(p => ({ ...p, fornecedor: e.target.value }))} className={inputCls} required /></Field>
        <Field label="Descrição *"><textarea rows={2} value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} className={inputCls} required /></Field>
        <Field label="Data prevista de entrega"><input type="date" value={form.dataPrevistaEntrega} onChange={e => setForm(p => ({ ...p, dataPrevistaEntrega: e.target.value }))} className={inputCls} /></Field>
        <Field label="Observações"><textarea rows={2} value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} className={inputCls} /></Field>
        <FormActions onClose={onClose} saving={saving} />
      </form>
    </FormShell>
  );
}
