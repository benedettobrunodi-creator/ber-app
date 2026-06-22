'use client';

import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import api from '@/lib/api';

interface Participante { nome: string; papel?: string | null }

export interface Kickoff {
  id?: string;
  dataRealizada: string | null;
  participantes: Participante[];
  pautaCoberta?: string | null;
  decisoes: string | null;
  premissas?: string | null;
  riscosIniciais?: string | null;
}

const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

interface Props {
  obraId: string;
  initial: Kickoff | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function KickoffFormModal({ obraId, initial, onClose, onSaved }: Props) {
  const [data, setData] = useState({
    dataRealizada: initial?.dataRealizada ? initial.dataRealizada.slice(0, 10) : '',
    pautaCoberta: initial?.pautaCoberta ?? '',
    decisoes: initial?.decisoes ?? '',
    premissas: initial?.premissas ?? '',
    riscosIniciais: initial?.riscosIniciais ?? '',
  });
  const [participantes, setParticipantes] = useState<Participante[]>(initial?.participantes ?? []);
  const [novoPart, setNovoPart] = useState({ nome: '', papel: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initial) return;
    setData({
      dataRealizada: initial.dataRealizada ? initial.dataRealizada.slice(0, 10) : '',
      pautaCoberta: initial.pautaCoberta ?? '',
      decisoes: initial.decisoes ?? '',
      premissas: initial.premissas ?? '',
      riscosIniciais: initial.riscosIniciais ?? '',
    });
    setParticipantes(initial.participantes ?? []);
  }, [initial]);

  function addParticipante() {
    if (!novoPart.nome.trim()) return;
    setParticipantes(p => [...p, { nome: novoPart.nome.trim(), papel: novoPart.papel.trim() || null }]);
    setNovoPart({ nome: '', papel: '' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.put(`/obras/${obraId}/kickoff`, {
        dataRealizada: data.dataRealizada || null,
        participantes,
        pautaCoberta: data.pautaCoberta || null,
        decisoes: data.decisoes || null,
        premissas: data.premissas || null,
        riscosIniciais: data.riscosIniciais || null,
      });
      onSaved();
    } catch (err) {
      setError(errMsg(err, 'Erro ao salvar kick-off'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl rounded-t-2xl md:rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-black text-ber-carbon">Kick-Off da obra</h2>
          <button onClick={onClose} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite hover:text-ber-carbon"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className={labelCls}>Data realizada</label>
            <input type="date" value={data.dataRealizada} onChange={e => setData(p => ({ ...p, dataRealizada: e.target.value }))} className={`${inputCls} max-w-xs`} />
          </div>

          <div>
            <label className={labelCls}>Participantes</label>
            {participantes.length > 0 && (
              <ul className="mb-2 space-y-1">
                {participantes.map((p, i) => (
                  <li key={i} className="flex items-center justify-between text-xs bg-ber-bg/40 rounded border border-ber-gray/15 px-2 py-1">
                    <span><strong>{p.nome}</strong>{p.papel ? ` · ${p.papel}` : ''}</span>
                    <button type="button" onClick={() => setParticipantes(arr => arr.filter((_, j) => j !== i))} className="text-ber-gray hover:text-red-600"><X size={11} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-5 gap-2">
              <input value={novoPart.nome} onChange={e => setNovoPart(p => ({ ...p, nome: e.target.value }))} placeholder="Nome" className={`${inputCls} col-span-2`} />
              <input value={novoPart.papel} onChange={e => setNovoPart(p => ({ ...p, papel: e.target.value }))} placeholder="Papel" className={`${inputCls} col-span-2`} />
              <button type="button" onClick={addParticipante} className="inline-flex items-center justify-center gap-1 rounded-md border border-ber-gray/30 text-sm text-ber-carbon hover:bg-ber-offwhite"><Plus size={12} /> Add</button>
            </div>
          </div>

          {[
            { key: 'pautaCoberta',   label: 'Pauta coberta',   placeholder: 'O que foi discutido no kick-off.' },
            { key: 'decisoes',       label: 'Decisões',        placeholder: 'Decisões tomadas com cliente / gerenciadora.' },
            { key: 'premissas',      label: 'Premissas',       placeholder: 'Premissas combinadas que sustentam o plano.' },
            { key: 'riscosIniciais', label: 'Riscos iniciais', placeholder: 'Riscos mapeados no início, com mitigação se houver.' },
          ].map(f => (
            <div key={f.key}>
              <label className={labelCls}>{f.label}</label>
              <textarea rows={3} value={(data as Record<string, string>)[f.key]}
                onChange={e => setData(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder} className={inputCls} />
            </div>
          ))}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = 'mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none';
const labelCls = 'block text-xs font-medium text-ber-gray uppercase tracking-wide';
