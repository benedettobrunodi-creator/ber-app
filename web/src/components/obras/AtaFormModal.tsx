'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';

export interface Participante { nome: string; papel?: string | null }

export interface PendenciaInline {
  id: string;
  descricao: string;
  status: string;
  prazo: string | null;
  responsible: { id: string; name: string } | null;
}

export interface Ata {
  id: string;
  tipo: 'interna' | 'externa';
  numero: string;
  data: string;
  local: string | null;
  participantes: Participante[];
  pauta: string;
  decisoes: string | null;
  pendencias: PendenciaInline[];
}

export interface UserOption { id: string; name: string }

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

interface Props {
  obraId: string;
  users: UserOption[];
  edit: Ata | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function AtaFormModal({ obraId, users, edit, onClose, onSaved }: Props) {
  const [tipo, setTipo] = useState<'interna' | 'externa'>(edit?.tipo || 'interna');
  const [numero, setNumero] = useState(edit?.numero || '');
  const [data, setData] = useState(edit?.data ? edit.data.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [local, setLocal] = useState(edit?.local || '');
  const [participantes, setParticipantes] = useState<Participante[]>(edit?.participantes || []);
  const [novoPart, setNovoPart] = useState({ nome: '', papel: '' });
  const [pauta, setPauta] = useState(edit?.pauta || '');
  const [decisoes, setDecisoes] = useState(edit?.decisoes || '');
  const [pendencias, setPendencias] = useState<{ descricao: string; responsibleId: string; prazo: string }[]>([]);
  const [novaPend, setNovaPend] = useState({ descricao: '', responsibleId: '', prazo: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addParticipante() {
    if (!novoPart.nome.trim()) return;
    setParticipantes(p => [...p, { nome: novoPart.nome.trim(), papel: novoPart.papel.trim() || null }]);
    setNovoPart({ nome: '', papel: '' });
  }

  function addPendencia() {
    if (!novaPend.descricao.trim()) return;
    setPendencias(p => [...p, { ...novaPend, descricao: novaPend.descricao.trim() }]);
    setNovaPend({ descricao: '', responsibleId: '', prazo: '' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!numero.trim() || !pauta.trim()) {
      setError('Número e pauta são obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = {
        tipo,
        numero: numero.trim(),
        data,
        local: local.trim() || null,
        participantes,
        pauta: pauta.trim(),
        decisoes: decisoes.trim() || null,
        pendencias: edit ? [] : pendencias.map(p => ({
          descricao: p.descricao,
          responsibleId: p.responsibleId || null,
          prazo: p.prazo || null,
        })),
      };
      if (edit) {
        await api.patch(`/atas/${edit.id}`, body);
      } else {
        await api.post(`/obras/${obraId}/atas`, body);
      }
      onSaved();
    } catch (err) {
      setError(errMsg(err, 'Erro ao salvar ata'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl rounded-t-2xl md:rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-black text-ber-carbon">{edit ? 'Editar Ata' : 'Nova Ata'}</h2>
          <button onClick={onClose} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite hover:text-ber-carbon"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="grid grid-cols-3 gap-4">
            <Field label="Tipo *">
              <select value={tipo} onChange={e => setTipo(e.target.value as 'interna' | 'externa')} className={inputCls}>
                <option value="interna">Interna</option>
                <option value="externa">Externa (cliente / gerenciadora)</option>
              </select>
            </Field>
            <Field label="Número *"><input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex: AR-01" className={inputCls} required /></Field>
            <Field label="Data *"><input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} required /></Field>
          </div>

          <Field label="Local"><input value={local} onChange={e => setLocal(e.target.value)} placeholder="Ex: Canteiro, escritório do cliente, online…" className={inputCls} /></Field>

          <div>
            <label className="block text-xs font-medium text-ber-gray uppercase tracking-wide mb-1">Participantes</label>
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
              <input value={novoPart.papel} onChange={e => setNovoPart(p => ({ ...p, papel: e.target.value }))} placeholder="Papel (cliente, arq…)" className={`${inputCls} col-span-2`} />
              <button type="button" onClick={addParticipante} className="rounded-md border border-ber-gray/30 text-sm text-ber-carbon hover:bg-ber-offwhite">+ Add</button>
            </div>
          </div>

          <Field label="Pauta *"><textarea rows={3} value={pauta} onChange={e => setPauta(e.target.value)} className={inputCls} required /></Field>
          <Field label="Decisões"><textarea rows={3} value={decisoes} onChange={e => setDecisoes(e.target.value)} className={inputCls} placeholder="O que foi decidido na reunião." /></Field>

          {!edit && (
            <div>
              <label className="block text-xs font-medium text-ber-gray uppercase tracking-wide mb-1">Pendências geradas (opcional)</label>
              {pendencias.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {pendencias.map((p, i) => (
                    <li key={i} className="flex items-center justify-between text-xs bg-ber-bg/40 rounded border border-ber-gray/15 px-2 py-1">
                      <span>
                        <strong>{p.descricao}</strong>
                        {p.responsibleId && <span className="text-ber-gray"> · {users.find(u => u.id === p.responsibleId)?.name || '?'}</span>}
                        {p.prazo && <span className="text-ber-gray"> · prazo {fmtDate(p.prazo)}</span>}
                      </span>
                      <button type="button" onClick={() => setPendencias(arr => arr.filter((_, j) => j !== i))} className="text-ber-gray hover:text-red-600"><X size={11} /></button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid grid-cols-7 gap-2">
                <input value={novaPend.descricao} onChange={e => setNovaPend(p => ({ ...p, descricao: e.target.value }))} placeholder="Descrição da pendência" className={`${inputCls} col-span-3`} />
                <select value={novaPend.responsibleId} onChange={e => setNovaPend(p => ({ ...p, responsibleId: e.target.value }))} className={`${inputCls} col-span-2`}>
                  <option value="">Responsável (opc.)</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <input type="date" value={novaPend.prazo} onChange={e => setNovaPend(p => ({ ...p, prazo: e.target.value }))} className={inputCls} />
                <button type="button" onClick={addPendencia} className="rounded-md border border-ber-gray/30 text-sm text-ber-carbon hover:bg-ber-offwhite">+ Add</button>
              </div>
              <p className="mt-1 text-[10px] text-ber-gray/70">As pendências geradas vão pro PunchList "Geral" da obra e ficam vinculadas a esta ata.</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">
              {saving ? 'Salvando…' : edit ? 'Salvar' : 'Criar Ata'}
            </button>
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
