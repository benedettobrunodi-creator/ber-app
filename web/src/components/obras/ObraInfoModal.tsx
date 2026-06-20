'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';

interface ObraInfoPayload {
  client: string | null;
  address: string | null;
  arquiteturaEscritorio: string | null;
  gerenciadora: string | null;
  areaM2: number | null;
  valorContrato: number | null;
  startDate: string | null;
  expectedEndDate: string | null;
  dataInicioObra: string | null;
  dataFimObra: string | null;
}

interface ObraInfoModalProps {
  obraId: string;
  onClose: () => void;
  onSaved: () => void;
}

const isoToDateInput = (iso: string | null): string =>
  iso ? new Date(iso).toISOString().slice(0, 10) : '';

const dateInputToIso = (s: string): string | null =>
  s ? new Date(s + 'T00:00:00').toISOString() : null;

export default function ObraInfoModal({ obraId, onClose, onSaved }: ObraInfoModalProps) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get(`/obras/${obraId}`)
      .then(r => {
        if (cancelled) return;
        const o = r.data.data as Partial<ObraInfoPayload>;
        setForm({
          client: o.client ?? '',
          address: o.address ?? '',
          arquiteturaEscritorio: o.arquiteturaEscritorio ?? '',
          gerenciadora: o.gerenciadora ?? '',
          areaM2: o.areaM2 != null ? String(o.areaM2) : '',
          valorContrato: o.valorContrato != null ? String(o.valorContrato) : '',
          startDate: isoToDateInput(o.startDate ?? null),
          expectedEndDate: isoToDateInput(o.expectedEndDate ?? null),
          dataInicioObra: isoToDateInput(o.dataInicioObra ?? null),
          dataFimObra: isoToDateInput(o.dataFimObra ?? null),
        });
      })
      .catch(err => {
        if (cancelled) return;
        const msg = err?.response?.data?.error;
        setError(typeof msg === 'string' ? msg : msg?.message || 'Erro ao carregar obra');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [obraId]);

  function update<K extends string>(key: K, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        client: form.client || null,
        address: form.address || null,
        arquiteturaEscritorio: form.arquiteturaEscritorio || null,
        gerenciadora: form.gerenciadora || null,
        startDate: dateInputToIso(form.startDate),
        expectedEndDate: dateInputToIso(form.expectedEndDate),
        dataInicioObra: form.dataInicioObra || null,
        dataFimObra: form.dataFimObra || null,
      };
      const area = Number(form.areaM2?.replace(',', '.'));
      body.areaM2 = !isNaN(area) && area > 0 ? area : null;
      const vc = Number(form.valorContrato?.replace(',', '.'));
      body.valorContrato = !isNaN(vc) && vc > 0 ? vc : null;

      await api.put(`/obras/${obraId}`, body);
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
      setError(typeof msg === 'string' ? msg : msg?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-t-2xl md:rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4 sticky top-0 bg-white">
          <h2 className="text-lg font-black text-ber-carbon">Informações da Obra</h2>
          <button onClick={onClose} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite hover:text-ber-carbon">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-ber-gray">Carregando…</div>
        ) : (
          <div className="space-y-4 px-6 py-5">
            {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Cliente">
                <input value={form.client} onChange={e => update('client', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Endereço">
                <input value={form.address} onChange={e => update('address', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Arquitetura (escritório)">
                <input value={form.arquiteturaEscritorio} onChange={e => update('arquiteturaEscritorio', e.target.value)} className={inputCls} placeholder="Ex: Studio XYZ" />
              </Field>
              <Field label="Gerenciadora">
                <input value={form.gerenciadora} onChange={e => update('gerenciadora', e.target.value)} className={inputCls} placeholder="Ex: CBRE" />
              </Field>
              <Field label="Área (m²)">
                <input value={form.areaM2} onChange={e => update('areaM2', e.target.value)} className={inputCls} placeholder="Ex: 850" inputMode="decimal" />
              </Field>
              <Field label="Valor do contrato (R$)">
                <input value={form.valorContrato} onChange={e => update('valorContrato', e.target.value)} className={inputCls} placeholder="Ex: 1500000" inputMode="decimal" />
              </Field>
              <Field label="Data início do projeto">
                <input type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Previsão de entrega">
                <input type="date" value={form.expectedEndDate} onChange={e => update('expectedEndDate', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Data início da obra">
                <input type="date" value={form.dataInicioObra} onChange={e => update('dataInicioObra', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Data fim da obra">
                <input type="date" value={form.dataFimObra} onChange={e => update('dataFimObra', e.target.value)} className={inputCls} />
              </Field>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
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
