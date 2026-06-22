'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';

const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

interface Props {
  obraId: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function AditivoFormModal({ obraId, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ numero: '', descricao: '', valor: '', tipo: 'credito' as 'credito' | 'debito', motivo: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const valor = Number(form.valor.replace(',', '.'));
      if (!form.numero.trim() || !form.descricao.trim() || isNaN(valor) || valor <= 0) {
        setError('Preencha número, descrição e valor (> 0).');
        setSaving(false);
        return;
      }
      await api.post(`/obras/${obraId}/aditivos`, {
        numero: form.numero.trim(),
        descricao: form.descricao.trim(),
        valor,
        tipo: form.tipo,
        motivo: form.motivo.trim() || null,
      });
      onCreated();
    } catch (err) {
      setError(errMsg(err, 'Erro ao criar aditivo'));
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none';
  const labelCls = 'block text-xs font-medium text-ber-gray uppercase tracking-wide';

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-t-2xl md:rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
          <h2 className="text-lg font-black text-ber-carbon">Novo Aditivo</h2>
          <button onClick={onClose} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite hover:text-ber-carbon">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Número *</label>
              <input value={form.numero} onChange={e => setForm(p => ({ ...p, numero: e.target.value }))} placeholder="Ex: AD-01" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as 'credito' | 'debito' }))} className={inputCls}>
                <option value="credito">Crédito (a receber)</option>
                <option value="debito">Débito (a deduzir)</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Descrição *</label>
            <textarea rows={2} value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Valor (R$) *</label>
            <input value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} inputMode="decimal" placeholder="Ex: 15000.00" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Motivo (opcional)</label>
            <textarea rows={2} value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} placeholder="Justificativa, número da ata de origem, etc." className={inputCls} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">
              {saving ? 'Criando…' : 'Criar Aditivo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
