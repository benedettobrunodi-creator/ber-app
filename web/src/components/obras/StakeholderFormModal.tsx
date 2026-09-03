'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '@/lib/api';

interface UsuarioBer { id: string; name: string; email: string; role: string }

/** Detecta se a empresa gravada é a própria BÈR (grafias variadas). */
const ehBer = (empresa: string) => /^b[eè]r\b/i.test(empresa.trim());
const EMPRESA_BER = 'BER';

export interface Stakeholder {
  id: string;
  empresa: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  recebeEmails?: boolean;
  recebeDiario?: boolean;
  recebeRelatorio?: boolean;
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
    recebeDiario: edit?.recebeDiario ?? false,
    recebeRelatorio: edit?.recebeRelatorio ?? false,
    telefone: edit?.telefone || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Empresa BÈR × outra (03/09, Bruno): selecionando BÈR, escolhe um usuário
  // da plataforma e nome/e-mail vêm preenchidos.
  const [tipoEmpresa, setTipoEmpresa] = useState<'ber' | 'outra'>(edit && ehBer(edit.empresa) ? 'ber' : 'outra');
  const [usuarios, setUsuarios] = useState<UsuarioBer[]>([]);
  const [usuarioSel, setUsuarioSel] = useState('');

  useEffect(() => {
    if (tipoEmpresa !== 'ber' || usuarios.length > 0) return;
    api.get(`/obras/${obraId}/stakeholders/usuarios-ber`)
      .then(r => setUsuarios(r.data.data ?? []))
      .catch(() => {});
  }, [tipoEmpresa, obraId, usuarios.length]);

  function selecionarUsuario(id: string) {
    setUsuarioSel(id);
    const u = usuarios.find(x => x.id === id);
    if (u) setF(p => ({ ...p, empresa: EMPRESA_BER, nome: u.name, email: u.email }));
  }

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
        recebeDiario: !!f.recebeDiario,
        recebeRelatorio: !!f.recebeRelatorio,
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
          <div>
            <label className="block text-xs font-medium text-ber-gray uppercase tracking-wide">Empresa *</label>
            <div className="mt-1 flex rounded-md border border-ber-gray/30 overflow-hidden">
              {([['ber', 'BÈR Engenharia'], ['outra', 'Outra empresa']] as const).map(([k, label]) => (
                <button key={k} type="button"
                  onClick={() => {
                    setTipoEmpresa(k);
                    if (k === 'ber') setF(p => ({ ...p, empresa: EMPRESA_BER }));
                    else { setUsuarioSel(''); setF(p => ({ ...p, empresa: ehBer(p.empresa) ? '' : p.empresa })); }
                  }}
                  className={`flex-1 px-3 py-2 text-sm font-semibold transition-colors ${
                    tipoEmpresa === k ? 'bg-ber-carbon text-white' : 'bg-white text-ber-gray hover:bg-ber-offwhite'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {tipoEmpresa === 'ber' && (
            <Field label="Usuário da plataforma">
              <select value={usuarioSel} onChange={e => selecionarUsuario(e.target.value)} className={inputCls}>
                <option value="">selecione pra preencher nome e e-mail…</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            {tipoEmpresa === 'outra' ? (
              <Field label="Nome da empresa *"><input value={f.empresa} onChange={e => setF(p => ({ ...p, empresa: e.target.value }))} className={inputCls} required /></Field>
            ) : (
              <Field label="Empresa"><input value={f.empresa} disabled className={`${inputCls} bg-ber-offwhite text-ber-gray`} /></Field>
            )}
            <Field label="Nome *"><input value={f.nome} onChange={e => setF(p => ({ ...p, nome: e.target.value }))} className={inputCls} required /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cargo"><input value={f.cargo} onChange={e => setF(p => ({ ...p, cargo: e.target.value }))} className={inputCls} placeholder="Ex: Diretor, Arquiteto…" /></Field>
            <Field label="Função no projeto"><input value={f.funcao} onChange={e => setF(p => ({ ...p, funcao: e.target.value }))} className={inputCls} placeholder="Ex: Decision maker, Aprovador…" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Email"><input type="email" value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))} className={inputCls} /></Field>
            <div className="flex flex-col gap-1.5 mt-1">
              <label className="flex items-center gap-2 text-sm text-ber-carbon cursor-pointer">
                <input type="checkbox" checked={!!f.recebeDiario} onChange={e => setF(p => ({ ...p, recebeDiario: e.target.checked }))} className="accent-ber-carbon" />
                Recebe diário de obra por e-mail
              </label>
              <label className="flex items-center gap-2 text-sm text-ber-carbon cursor-pointer">
                <input type="checkbox" checked={!!f.recebeRelatorio} onChange={e => setF(p => ({ ...p, recebeRelatorio: e.target.checked }))} className="accent-ber-carbon" />
                Recebe relatório semanal por e-mail
              </label>
            </div>
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
