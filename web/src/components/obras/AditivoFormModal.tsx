'use client';

import { useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import api from '@/lib/api';
import { parseValorBRL } from '@/lib/valor-brl';

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
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const valor = parseValorBRL(form.valor);
      if (!form.numero.trim() || !form.descricao.trim()) {
        setError('Preencha número e descrição.');
        setSaving(false);
        return;
      }
      if (isNaN(valor) || valor <= 0) {
        setError('Valor inválido — informe como 15.000,00 ou 15000,00.');
        setSaving(false);
        return;
      }
      const created = await api.post(`/obras/${obraId}/aditivos`, {
        numero: form.numero.trim(),
        descricao: form.descricao.trim(),
        valor,
        tipo: form.tipo,
        motivo: form.motivo.trim() || null,
      });
      // Anexos opcionais (aprovação, ata...) — sobem após criar o aditivo.
      const aditivoId = created.data?.data?.id;
      const files = Array.from(fileRef.current?.files ?? []);
      if (aditivoId && files.length) {
        for (const f of files) {
          const fd = new FormData();
          fd.append('file', f);
          fd.append('entityType', 'aditivo');
          fd.append('entityId', aditivoId);
          try {
            await api.post('/attachments', fd);
          } catch {
            alert(`Aditivo criado, mas o anexo "${f.name}" falhou — reenvie pela lista (expandir o aditivo → Anexos).`);
          }
        }
      }
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
          <h2 className="text-lg font-black text-ber-carbon">Novo Change Order</h2>
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
            <input value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} inputMode="decimal" placeholder="Ex: 15.000,00" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Anexos (opcional)</label>
            <input
              ref={fileRef}
              type="file"
              multiple
              onChange={e => setFileNames(Array.from(e.target.files ?? []).map(f => f.name))}
              className="mt-1 block w-full text-sm text-ber-gray file:mr-3 file:rounded-md file:border-0 file:bg-ber-offwhite file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ber-carbon hover:file:bg-ber-gray/10"
            />
            {fileNames.length > 0 && (
              <p className="mt-1 flex items-center gap-1 text-xs text-ber-gray"><Paperclip size={11} /> {fileNames.length} arquivo(s): {fileNames.join(', ').slice(0, 80)}</p>
            )}
            <p className="mt-1 text-[11px] text-ber-gray/60">E-mail de aprovação, ata, planilha… (até 20MB cada)</p>
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
