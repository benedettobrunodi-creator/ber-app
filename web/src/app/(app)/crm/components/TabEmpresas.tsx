'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { Plus, Search, Building2, X, AlertCircle, ArrowRight, UserPlus } from 'lucide-react';
import { SEGMENTOS, CLASSIFICACOES, Empresa, Contato, diasAtras } from '../types';

function ContatosSection({ empresaId, contatos }: { empresaId: string; contatos: Contato[] }) {
  const [lista, setLista] = useState<Contato[]>(contatos);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ nome: '', cargo: '', email: '', telefone: '' });
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      const res = await api.post('/crm/contatos', { ...form, empresaId, principal: lista.length === 0 });
      setLista((prev) => [...prev, res.data]);
      setForm({ nome: '', cargo: '', email: '', telefone: '' });
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Contatos</p>
        {!adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-ber-teal hover:underline">
            <UserPlus size={12} /> Adicionar
          </button>
        )}
      </div>
      {lista.map((c) => (
        <div key={c.id} className="flex items-start gap-2 py-2 border-b border-ber-border last:border-0">
          <div className="w-7 h-7 rounded-full bg-ber-teal/15 flex items-center justify-center text-xs font-bold text-ber-teal shrink-0">{c.nome.charAt(0)}</div>
          <div>
            <p className="text-sm font-semibold text-ber-carbon">{c.nome} {c.principal && <span className="text-[10px] bg-ber-olive/20 text-ber-olive px-1 rounded">Principal</span>}</p>
            {c.cargo && <p className="text-xs text-ber-gray">{c.cargo}</p>}
            {c.email && <p className="text-xs text-ber-teal">{c.email}</p>}
            {c.telefone && <p className="text-xs text-ber-gray">{c.telefone}</p>}
          </div>
        </div>
      ))}
      {lista.length === 0 && !adding && (
        <p className="text-xs text-ber-gray/60 py-2">Nenhum contato cadastrado</p>
      )}
      {adding && (
        <div className="mt-2 p-3 bg-ber-surface border border-ber-border rounded-xl space-y-2">
          <input autoFocus className="w-full border border-ber-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-ber-teal" placeholder="Nome *" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          <div className="grid grid-cols-2 gap-2">
            <input className="border border-ber-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-ber-teal" placeholder="Cargo" value={form.cargo} onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))} />
            <input className="border border-ber-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-ber-teal" placeholder="Telefone" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
          </div>
          <input className="w-full border border-ber-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-ber-teal" placeholder="E-mail" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <div className="flex gap-2">
            <button onClick={() => setAdding(false)} className="flex-1 py-1.5 text-xs border border-ber-border rounded-lg text-ber-gray hover:bg-white">Cancelar</button>
            <button onClick={handleAdd} disabled={saving || !form.nome.trim()} className="flex-1 py-1.5 text-xs bg-ber-teal text-white rounded-lg font-semibold disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar contato'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  empresas: Empresa[];
  onRefresh: () => void;
}

function EmpresaDrawer({
  empresa,
  onClose,
  onSave,
}: {
  empresa: Empresa | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const isNew = !empresa?.id;
  const [form, setForm] = useState({
    razaoSocial: empresa?.razaoSocial ?? '',
    cnpj: empresa?.cnpj ?? '',
    segmento: empresa?.segmento ?? '',
    classificacao: empresa?.classificacao ?? '',
    cidade: empresa?.cidade ?? '',
    nutricao: empresa?.nutricao ?? false,
    observacoes: '',
  });
  const [newContato, setNewContato] = useState({ nome: '', cargo: '', email: '', telefone: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSave = async () => {
    if (!form.razaoSocial.trim()) { setErr('Razão social obrigatória'); return; }
    setSaving(true);
    try {
      const payload = { ...form, cnpj: form.cnpj || null, segmento: form.segmento || null, classificacao: form.classificacao || null, cidade: form.cidade || null };
      if (isNew) {
        const res = await api.post('/crm/empresas', payload);
        if (newContato.nome.trim()) {
          await api.post('/crm/contatos', { ...newContato, empresaId: res.data.id, principal: true });
        }
      } else {
        await api.patch(`/crm/empresas/${empresa!.id}`, payload);
      }
      onSave();
    } catch {
      setErr('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white shadow-xl flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-ber-border">
          <h2 className="font-bold text-ber-carbon">{isNew ? 'Nova Empresa' : 'Editar Empresa'}</h2>
          <button onClick={onClose} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button>
        </div>
        <div className="flex-1 p-4 space-y-4">
          {err && <p className="text-xs text-ber-red">{err}</p>}
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Razão Social *</label>
            <input className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.razaoSocial} onChange={(e) => setForm((f) => ({ ...f, razaoSocial: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">CNPJ</label>
              <input className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Cidade</label>
              <input className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Segmento</label>
              <select className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.segmento} onChange={(e) => setForm((f) => ({ ...f, segmento: e.target.value }))}>
                <option value="">--</option>
                {SEGMENTOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Classificação</label>
              <select className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.classificacao} onChange={(e) => setForm((f) => ({ ...f, classificacao: e.target.value }))}>
                <option value="">--</option>
                {CLASSIFICACOES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="nutricao" checked={form.nutricao} onChange={(e) => setForm((f) => ({ ...f, nutricao: e.target.checked }))} className="w-4 h-4" />
            <label htmlFor="nutricao" className="text-sm text-ber-carbon">Em nutrição (sem oportunidade ativa)</label>
          </div>
          {isNew && (
            <div className="border border-ber-border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Contato Principal</p>
              <input className="w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" placeholder="Nome" value={newContato.nome} onChange={(e) => setNewContato((c) => ({ ...c, nome: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <input className="border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" placeholder="Cargo" value={newContato.cargo} onChange={(e) => setNewContato((c) => ({ ...c, cargo: e.target.value }))} />
                <input className="border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" placeholder="Telefone" value={newContato.telefone} onChange={(e) => setNewContato((c) => ({ ...c, telefone: e.target.value }))} />
              </div>
              <input className="w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" placeholder="E-mail" value={newContato.email} onChange={(e) => setNewContato((c) => ({ ...c, email: e.target.value }))} />
            </div>
          )}
          {!isNew && (
            <ContatosSection empresaId={empresa!.id} contatos={empresa?.contatos ?? []} />
          )}
        </div>
        <div className="p-4 border-t border-ber-border flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-ber-border rounded-lg text-sm text-ber-gray hover:bg-ber-surface">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-ber-teal text-white rounded-lg text-sm font-semibold hover:bg-ber-teal/80 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TabEmpresas({ empresas, onRefresh }: Props) {
  const [search, setSearch] = useState('');
  const [showNutricao, setShowNutricao] = useState(false);
  const [drawer, setDrawer] = useState<Empresa | null | 'new'>(null);

  const filtered = empresas.filter((e) => {
    if (showNutricao !== e.nutricao) return false;
    if (search && !e.razaoSocial.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const hoje = new Date();
  const diasSemContato = (e: Empresa) => {
    if (!e.ultimoContato) return null;
    return Math.floor((hoje.getTime() - new Date(e.ultimoContato).getTime()) / 86_400_000);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ber-gray" />
          <input
            className="w-full pl-8 pr-3 py-2 border border-ber-border rounded-lg text-sm focus:outline-none focus:border-ber-teal"
            placeholder="Buscar empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex rounded-lg border border-ber-border overflow-hidden text-sm">
          <button onClick={() => setShowNutricao(false)} className={`px-3 py-2 ${!showNutricao ? 'bg-ber-teal text-white' : 'text-ber-gray hover:bg-ber-surface'}`}>Clientes</button>
          <button onClick={() => setShowNutricao(true)} className={`px-3 py-2 ${showNutricao ? 'bg-ber-teal text-white' : 'text-ber-gray hover:bg-ber-surface'}`}>Nutrição</button>
        </div>
        <button onClick={() => setDrawer('new')} className="flex items-center gap-1.5 bg-ber-teal text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-ber-teal/80">
          <Plus size={14} /> Nova
        </button>
      </div>

      {showNutricao && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Empresas em nutrição são prospects sem oportunidade ativa. Monitore o tempo sem contato e faça follow-up periódico.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((e) => {
          const dias = diasSemContato(e);
          const atrasada = dias !== null && dias > 30;
          return (
            <div
              key={e.id}
              className="bg-white border border-ber-border rounded-xl p-4 flex items-center gap-4 hover:shadow-sm hover:border-ber-teal/40 cursor-pointer transition-all"
              onClick={() => setDrawer(e)}
            >
              <div className="w-10 h-10 rounded-xl bg-ber-teal/10 flex items-center justify-center shrink-0">
                <Building2 size={18} className="text-ber-teal" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ber-carbon truncate">{e.razaoSocial}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {e.classificacao && <span className="text-xs font-medium text-ber-teal bg-ber-teal/10 px-1.5 py-0.5 rounded">{e.classificacao}</span>}
                  {e.segmento && <span className="text-xs text-ber-gray">{e.segmento}</span>}
                  {e.cidade && <span className="text-xs text-ber-gray">{e.cidade}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                {!showNutricao ? (
                  <>
                    <p className="text-xs font-semibold text-ber-carbon">{e._count?.oportunidades ?? 0} oport.</p>
                    <p className="text-xs text-ber-gray">Último: {diasAtras(e.ultimoContato)}</p>
                  </>
                ) : (
                  <div className={`flex items-center gap-1 ${atrasada ? 'text-ber-red' : 'text-ber-gray'}`}>
                    {atrasada && <AlertCircle size={12} />}
                    <span className="text-xs">{dias !== null ? `${dias} dias` : 'sem registro'}</span>
                  </div>
                )}
              </div>
              <ArrowRight size={14} className="text-ber-gray shrink-0" />
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-ber-gray">
            <Building2 size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{search ? 'Nenhuma empresa encontrada' : showNutricao ? 'Nenhuma empresa em nutrição' : 'Nenhuma empresa cadastrada'}</p>
          </div>
        )}
      </div>

      {drawer !== null && (
        <EmpresaDrawer
          empresa={drawer === 'new' ? null : drawer}
          onClose={() => setDrawer(null)}
          onSave={() => { setDrawer(null); onRefresh(); }}
        />
      )}
    </div>
  );
}
