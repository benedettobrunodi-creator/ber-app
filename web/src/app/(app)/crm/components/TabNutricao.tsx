'use client';

import { useState, useMemo } from 'react';
import api from '@/lib/api';
import {
  Phone, Mail, Linkedin, MessageCircle, Plus, X, Thermometer, ChevronDown,
  Calendar, Clock, Check, Pencil, Trash2, LayoutGrid, List, Tag, Users2,
  ChevronRight, AlertCircle,
} from 'lucide-react';
import { Contato, Campanha, CampanhaDetalhe, CAMPANHA_STATUSES, NUTRICAO_TAGS, User, TIPOS_ATIVIDADE } from '../types';

// ── Temperature ───────────────────────────────────────────────────────────────

function getTemperatura(ultimoContato: string | null): 'quente' | 'morno' | 'frio' | 'gelado' | 'novo' {
  if (!ultimoContato) return 'novo';
  const dias = Math.floor((Date.now() - new Date(ultimoContato).getTime()) / 86_400_000);
  if (dias <= 15) return 'quente';
  if (dias <= 30) return 'morno';
  if (dias <= 45) return 'frio';
  return 'gelado';
}

const TEMP_CONFIG = {
  quente: { label: 'Quente', color: 'bg-green-100 text-green-700', dot: 'bg-green-400' },
  morno:  { label: 'Morno',  color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
  frio:   { label: 'Frio',   color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
  gelado: { label: 'Gelado', color: 'bg-red-100 text-red-700', dot: 'bg-red-400' },
  novo:   { label: 'Novo',   color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
};

function diasAtras(iso: string | null) {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return 'hoje';
  if (d === 1) return '1 dia';
  return `${d} dias`;
}

// ── ContatarModal ─────────────────────────────────────────────────────────────

function ContatarModal({ contato, onClose, onSave }: { contato: Contato; onClose: () => void; onSave: () => void }) {
  const [tipo, setTipo] = useState('ligacao');
  const [notas, setNotas] = useState('');
  const [proximoContato, setProximoContato] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/crm/contatos/${contato.id}/contatar`, { tipo, notas: notas || null });
      if (proximoContato) {
        await api.patch(`/crm/contatos/${contato.id}`, { proximoContato: proximoContato || null });
      }
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm bg-white rounded-t-2xl md:rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-ber-carbon text-sm">Registrar contato</h2>
            <p className="text-xs text-ber-gray mt-0.5">{contato.nome} · {contato.empresa?.razaoSocial ?? '—'}</p>
          </div>
          <button onClick={onClose}><X size={16} className="text-ber-gray" /></button>
        </div>
        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Tipo</label>
          <select className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={tipo} onChange={e => setTipo(e.target.value)}>
            {TIPOS_ATIVIDADE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Notas</label>
          <textarea className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal resize-none" rows={2} value={notas} onChange={e => setNotas(e.target.value)} placeholder="O que foi discutido?" />
        </div>
        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Próximo contato</label>
          <input type="date" className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={proximoContato} onChange={e => setProximoContato(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-ber-border rounded-lg text-sm text-ber-gray hover:bg-ber-surface">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-ber-teal text-white rounded-lg text-sm font-semibold hover:bg-ber-teal/80 disabled:opacity-50">
            {saving ? '...' : '✓ Contatei'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EditContatoNutricaoDrawer ──────────────────────────────────────────────────

function EditNutricaoDrawer({ contato, onClose, onSave }: { contato: Contato; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    proximoContato: contato.proximoContato?.slice(0, 10) ?? '',
    notasRelacionamento: contato.notasRelacionamento ?? '',
    tags: [...contato.tags],
  });
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag: string) => {
    setForm(f => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/crm/contatos/${contato.id}`, {
        proximoContato: form.proximoContato || null,
        notasRelacionamento: form.notasRelacionamento || null,
        tags: form.tags,
      });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm bg-white rounded-t-2xl md:rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-ber-carbon text-sm">{contato.nome}</h2>
          <button onClick={onClose}><X size={16} className="text-ber-gray" /></button>
        </div>
        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Próximo contato</label>
          <input type="date" className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.proximoContato} onChange={e => setForm(f => ({ ...f, proximoContato: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Tags</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {NUTRICAO_TAGS.map(tag => (
              <button key={tag} onClick={() => toggleTag(tag)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${form.tags.includes(tag) ? 'bg-ber-teal text-white border-ber-teal' : 'border-ber-border text-ber-gray hover:border-ber-teal'}`}>
                {tag}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Notas de relacionamento</label>
          <textarea className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal resize-none" rows={3} placeholder="Contexto do relacionamento, preferências, histórico..." value={form.notasRelacionamento} onChange={e => setForm(f => ({ ...f, notasRelacionamento: e.target.value }))} />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-ber-border rounded-lg text-sm text-ber-gray">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-ber-teal text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {saving ? '...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ContactCard ───────────────────────────────────────────────────────────────

function ContactCard({ contato, onRefresh }: { contato: Contato; onRefresh: () => void }) {
  const temp = getTemperatura(contato.ultimoContato);
  const cfg = TEMP_CONFIG[temp];
  const [showContatar, setShowContatar] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [removingNutricao, setRemovingNutricao] = useState(false);

  const hoje = new Date().toISOString().slice(0, 10);
  const proximoVencido = contato.proximoContato && contato.proximoContato.slice(0, 10) <= hoje;

  const removeFromNutricao = async () => {
    if (!confirm(`Remover ${contato.nome} da nutrição?`)) return;
    setRemovingNutricao(true);
    try {
      await api.patch(`/crm/contatos/${contato.id}`, { nutricao: false });
      onRefresh();
    } finally {
      setRemovingNutricao(false);
    }
  };

  return (
    <>
      <div className={`bg-white border rounded-xl p-3.5 ${proximoVencido ? 'border-amber-200 bg-amber-50/30' : 'border-ber-border'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-ber-carbon truncate">{contato.nome}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-ber-gray mt-0.5 truncate">
              {contato.cargo ?? '—'} · {contato.empresa?.razaoSocial ?? '—'}
            </p>
            {contato.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {contato.tags.map(tag => (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-ber-teal/10 text-ber-teal font-medium">{tag}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setShowEdit(true)} className="p-1.5 rounded-lg text-ber-gray hover:text-ber-teal hover:bg-ber-teal/5">
              <Pencil size={12} />
            </button>
            <button onClick={removeFromNutricao} disabled={removingNutricao} className="p-1.5 rounded-lg text-ber-gray hover:text-ber-red hover:bg-red-50">
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Datas */}
        <div className="mt-2.5 flex items-center gap-4 text-xs text-ber-gray">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {contato.ultimoContato ? `Último: ${diasAtras(contato.ultimoContato)}` : 'Nunca contactado'}
          </span>
          {contato.proximoContato && (
            <span className={`flex items-center gap-1 font-medium ${proximoVencido ? 'text-amber-600' : 'text-ber-carbon'}`}>
              <Calendar size={11} />
              {proximoVencido ? '⚠ ' : ''}Próximo: {new Date(contato.proximoContato).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>

        {contato.notasRelacionamento && (
          <p className="mt-2 text-xs text-ber-gray italic line-clamp-2 bg-ber-surface rounded-lg px-2 py-1.5">
            {contato.notasRelacionamento}
          </p>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-1.5">
          <button onClick={() => setShowContatar(true)}
            className="flex items-center gap-1.5 bg-ber-teal text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-ber-teal/80">
            <Check size={12} /> Contatei hoje
          </button>
          <div className="flex items-center gap-1 ml-auto">
            {contato.whatsapp && (
              <a href={`https://wa.me/55${contato.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100" title="WhatsApp">
                <MessageCircle size={13} />
              </a>
            )}
            {contato.email && (
              <a href={`mailto:${contato.email}`} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" title="E-mail">
                <Mail size={13} />
              </a>
            )}
            {contato.linkedin && (
              <a href={contato.linkedin.startsWith('http') ? contato.linkedin : `https://linkedin.com/in/${contato.linkedin}`}
                target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-[#0077b5]/10 text-[#0077b5] hover:bg-[#0077b5]/20" title="LinkedIn">
                <Linkedin size={13} />
              </a>
            )}
            {contato.telefone && (
              <a href={`tel:${contato.telefone}`} className="p-1.5 rounded-lg bg-gray-100 text-ber-gray hover:bg-gray-200" title="Ligar">
                <Phone size={13} />
              </a>
            )}
          </div>
        </div>
      </div>

      {showContatar && <ContatarModal contato={contato} onClose={() => setShowContatar(false)} onSave={() => { setShowContatar(false); onRefresh(); }} />}
      {showEdit && <EditNutricaoDrawer contato={contato} onClose={() => setShowEdit(false)} onSave={() => { setShowEdit(false); onRefresh(); }} />}
    </>
  );
}

// ── AdicionarContatoDrawer ─────────────────────────────────────────────────────

function AdicionarContatoDrawer({ todos, jaNaNutricao, onClose, onSave }: {
  todos: Contato[];
  jaNaNutricao: string[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const disponiveis = todos.filter(c =>
    !jaNaNutricao.includes(c.id) &&
    (c.nome.toLowerCase().includes(search.toLowerCase()) ||
     (c.empresa?.razaoSocial ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(selected.map(id => api.patch(`/crm/contatos/${id}`, { nutricao: true })));
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md bg-white rounded-t-2xl md:rounded-xl p-5 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-ber-carbon text-sm">Adicionar à nutrição</h2>
          <button onClick={onClose}><X size={16} className="text-ber-gray" /></button>
        </div>
        <input className="w-full border border-ber-border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-ber-teal" placeholder="Buscar contato ou empresa..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {disponiveis.map(c => (
            <button key={c.id} onClick={() => toggle(c.id)}
              className={`w-full text-left px-3 py-2 rounded-xl border transition-colors ${selected.includes(c.id) ? 'border-ber-teal bg-ber-teal/5' : 'border-ber-border hover:border-ber-teal/50'}`}>
              <p className="text-sm font-medium text-ber-carbon">{c.nome}</p>
              <p className="text-xs text-ber-gray">{c.cargo ?? '—'} · {c.empresa?.razaoSocial ?? '—'}</p>
            </button>
          ))}
          {disponiveis.length === 0 && <p className="text-center py-6 text-sm text-ber-gray">Nenhum contato disponível</p>}
        </div>
        <div className="flex gap-2 mt-3 pt-3 border-t border-ber-border">
          <button onClick={onClose} className="flex-1 py-2 border border-ber-border rounded-lg text-sm text-ber-gray">Cancelar</button>
          <button onClick={handleSave} disabled={saving || selected.length === 0} className="flex-1 py-2 bg-ber-teal text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {saving ? '...' : `Adicionar ${selected.length > 0 ? `(${selected.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CampanhaView ──────────────────────────────────────────────────────────────

function CampanhaView({ campanhas, contatos, users, onRefresh }: {
  campanhas: Campanha[];
  contatos: Contato[];
  users: User[];
  onRefresh: () => void;
}) {
  const [selectedCampanha, setSelectedCampanha] = useState<CampanhaDetalhe | null>(null);
  const [showNovaCampanha, setShowNovaCampanha] = useState(false);
  const [novaForm, setNovaForm] = useState({ nome: '', descricao: '', responsavelId: '' });
  const [saving, setSaving] = useState(false);
  const [loadingCampanha, setLoadingCampanha] = useState(false);
  const [showAddContatos, setShowAddContatos] = useState(false);
  const [addingContatos, setAddingContatos] = useState<string[]>([]);

  const openCampanha = async (id: string) => {
    setLoadingCampanha(true);
    try {
      const res = await api.get(`/crm/campanhas/${id}`);
      setSelectedCampanha(res.data);
    } finally {
      setLoadingCampanha(false);
    }
  };

  const handleCreateCampanha = async () => {
    setSaving(true);
    try {
      await api.post('/crm/campanhas', { ...novaForm, responsavelId: novaForm.responsavelId || null });
      setShowNovaCampanha(false);
      setNovaForm({ nome: '', descricao: '', responsavelId: '' });
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCampanha = async (id: string) => {
    if (!confirm('Excluir campanha?')) return;
    await api.delete(`/crm/campanhas/${id}`);
    if (selectedCampanha?.id === id) setSelectedCampanha(null);
    onRefresh();
  };

  const updateStatus = async (campanhaId: string, contatoId: string, status: string) => {
    await api.patch(`/crm/campanhas/${campanhaId}/contatos/${contatoId}`, { status });
    if (selectedCampanha) {
      const res = await api.get(`/crm/campanhas/${campanhaId}`);
      setSelectedCampanha(res.data);
    }
  };

  const addContatosToCampanha = async () => {
    if (!selectedCampanha || addingContatos.length === 0) return;
    setSaving(true);
    try {
      await api.post(`/crm/campanhas/${selectedCampanha.id}/contatos`, { contatoIds: addingContatos });
      const res = await api.get(`/crm/campanhas/${selectedCampanha.id}`);
      setSelectedCampanha(res.data);
      setShowAddContatos(false);
      setAddingContatos([]);
    } finally {
      setSaving(false);
    }
  };

  const removeContatoCampanha = async (contatoId: string) => {
    if (!selectedCampanha) return;
    await api.delete(`/crm/campanhas/${selectedCampanha.id}/contatos/${contatoId}`);
    const res = await api.get(`/crm/campanhas/${selectedCampanha.id}`);
    setSelectedCampanha(res.data);
  };

  const statusBreakdown = (c: CampanhaDetalhe) => {
    const counts: Record<string, number> = {};
    for (const cc of c.contatos) counts[cc.status] = (counts[cc.status] ?? 0) + 1;
    return counts;
  };

  if (selectedCampanha) {
    const breakdown = statusBreakdown(selectedCampanha);
    const jaAdicionados = selectedCampanha.contatos.map(cc => cc.contato.id);
    return (
      <div>
        <button onClick={() => setSelectedCampanha(null)} className="flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-teal mb-4">
          ← Campanhas
        </button>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-ber-carbon">{selectedCampanha.nome}</h2>
            {selectedCampanha.descricao && <p className="text-xs text-ber-gray mt-0.5">{selectedCampanha.descricao}</p>}
          </div>
          <button onClick={() => setShowAddContatos(true)} className="flex items-center gap-1.5 bg-ber-teal text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-ber-teal/80">
            <Plus size={14} /> Contatos
          </button>
        </div>

        {/* Breakdown */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {CAMPANHA_STATUSES.map(s => (
            <div key={s.value} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.color}`}>
              {s.label}: {breakdown[s.value] ?? 0}
            </div>
          ))}
        </div>

        {/* Contact table */}
        <div className="space-y-2">
          {selectedCampanha.contatos.map(cc => {
            const statusCfg = CAMPANHA_STATUSES.find(s => s.value === cc.status) ?? CAMPANHA_STATUSES[0];
            return (
              <div key={cc.contato.id} className="bg-white border border-ber-border rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ber-carbon truncate">{cc.contato.nome}</p>
                  <p className="text-xs text-ber-gray truncate">{cc.contato.cargo ?? '—'} · {cc.contato.empresa?.razaoSocial ?? '—'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {cc.contato.whatsapp && (
                    <a href={`https://wa.me/55${cc.contato.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"><MessageCircle size={12} /></a>
                  )}
                  {cc.contato.email && (
                    <a href={`mailto:${cc.contato.email}`} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"><Mail size={12} /></a>
                  )}
                  <select
                    className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ber-teal ${statusCfg.color}`}
                    value={cc.status}
                    onChange={e => updateStatus(selectedCampanha.id, cc.contato.id, e.target.value)}
                  >
                    {CAMPANHA_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <button onClick={() => removeContatoCampanha(cc.contato.id)} className="p-1 text-ber-gray hover:text-ber-red">
                    <X size={12} />
                  </button>
                </div>
              </div>
            );
          })}
          {selectedCampanha.contatos.length === 0 && (
            <div className="text-center py-10 text-ber-gray text-sm">Nenhum contato. Adicione contatos à campanha.</div>
          )}
        </div>

        {/* Add contatos modal */}
        {showAddContatos && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 px-4">
            <div className="w-full max-w-md bg-white rounded-t-2xl md:rounded-xl p-5 flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-ber-carbon text-sm">Adicionar contatos</h2>
                <button onClick={() => { setShowAddContatos(false); setAddingContatos([]); }}><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5">
                {contatos.filter(c => !jaAdicionados.includes(c.id)).map(c => (
                  <button key={c.id} onClick={() => setAddingContatos(s => s.includes(c.id) ? s.filter(x => x !== c.id) : [...s, c.id])}
                    className={`w-full text-left px-3 py-2 rounded-xl border transition-colors ${addingContatos.includes(c.id) ? 'border-ber-teal bg-ber-teal/5' : 'border-ber-border'}`}>
                    <p className="text-sm font-medium">{c.nome}</p>
                    <p className="text-xs text-ber-gray">{c.empresa?.razaoSocial ?? '—'}</p>
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-ber-border">
                <button onClick={() => { setShowAddContatos(false); setAddingContatos([]); }} className="flex-1 py-2 border border-ber-border rounded-lg text-sm text-ber-gray">Cancelar</button>
                <button onClick={addContatosToCampanha} disabled={saving || addingContatos.length === 0} className="flex-1 py-2 bg-ber-teal text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                  {saving ? '...' : `Adicionar (${addingContatos.length})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-ber-carbon">{campanhas.length} campanha{campanhas.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowNovaCampanha(true)} className="flex items-center gap-1.5 bg-ber-teal text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-ber-teal/80">
          <Plus size={14} /> Nova campanha
        </button>
      </div>

      <div className="space-y-3">
        {campanhas.map(c => (
          <div key={c.id} className="bg-white border border-ber-border rounded-xl p-4 flex items-center gap-3 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => openCampanha(c.id)}>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-ber-carbon">{c.nome}</p>
              {c.descricao && <p className="text-xs text-ber-gray mt-0.5 truncate">{c.descricao}</p>}
              <div className="flex items-center gap-3 mt-1 text-xs text-ber-gray">
                <span><Users2 size={11} className="inline mr-1" />{c._count.contatos} contatos</span>
                {c.responsavel && <span>{c.responsavel.name}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={e => { e.stopPropagation(); handleDeleteCampanha(c.id); }} className="p-1.5 text-ber-gray hover:text-ber-red"><Trash2 size={13} /></button>
              <ChevronRight size={16} className="text-ber-gray" />
            </div>
          </div>
        ))}
        {campanhas.length === 0 && (
          <div className="text-center py-12 text-ber-gray text-sm">Nenhuma campanha criada ainda.</div>
        )}
      </div>

      {showNovaCampanha && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm bg-white rounded-t-2xl md:rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-ber-carbon text-sm">Nova campanha</h2>
              <button onClick={() => setShowNovaCampanha(false)}><X size={16} /></button>
            </div>
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Nome *</label>
              <input className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={novaForm.nome} onChange={e => setNovaForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Campanha Maio 2026" />
            </div>
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Descrição</label>
              <textarea className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal resize-none" rows={2} value={novaForm.descricao} onChange={e => setNovaForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Responsável</label>
              <select className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={novaForm.responsavelId} onChange={e => setNovaForm(f => ({ ...f, responsavelId: e.target.value }))}>
                <option value="">— nenhum —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowNovaCampanha(false)} className="flex-1 py-2 border border-ber-border rounded-lg text-sm text-ber-gray">Cancelar</button>
              <button onClick={handleCreateCampanha} disabled={saving || !novaForm.nome.trim()} className="flex-1 py-2 bg-ber-teal text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                {saving ? '...' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  contatos: Contato[];
  campanhas: Campanha[];
  users: User[];
  onRefresh: () => void;
}

export default function TabNutricao({ contatos, campanhas, users, onRefresh }: Props) {
  const [subTab, setSubTab] = useState<'painel' | 'campanhas'>('painel');
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('lista');
  const [filtroTemp, setFiltroTemp] = useState('');
  const [filtroTag, setFiltroTag] = useState('');
  const [showAdicionar, setShowAdicionar] = useState(false);

  const nurturing = contatos.filter(c => c.nutricao);
  const outros = contatos.filter(c => !c.nutricao);

  const hoje = new Date().toISOString().slice(0, 10);
  const paraHoje = nurturing.filter(c => c.proximoContato && c.proximoContato.slice(0, 10) <= hoje);

  const filtered = useMemo(() => {
    return nurturing.filter(c => {
      if (filtroTemp && getTemperatura(c.ultimoContato) !== filtroTemp) return false;
      if (filtroTag && !c.tags.includes(filtroTag)) return false;
      return true;
    });
  }, [nurturing, filtroTemp, filtroTag]);

  const byTemp = useMemo(() => ({
    quente: filtered.filter(c => getTemperatura(c.ultimoContato) === 'quente'),
    morno:  filtered.filter(c => getTemperatura(c.ultimoContato) === 'morno'),
    frio:   filtered.filter(c => getTemperatura(c.ultimoContato) === 'frio'),
    gelado: filtered.filter(c => getTemperatura(c.ultimoContato) === 'gelado'),
    novo:   filtered.filter(c => getTemperatura(c.ultimoContato) === 'novo'),
  }), [filtered]);

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-5 bg-ber-surface rounded-xl p-1 w-fit">
        <button onClick={() => setSubTab('painel')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${subTab === 'painel' ? 'bg-white shadow-sm text-ber-carbon' : 'text-ber-gray hover:text-ber-carbon'}`}>
          <Thermometer size={13} className="inline mr-1.5" />Painel
        </button>
        <button onClick={() => setSubTab('campanhas')} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${subTab === 'campanhas' ? 'bg-white shadow-sm text-ber-carbon' : 'text-ber-gray hover:text-ber-carbon'}`}>
          <Users2 size={13} className="inline mr-1.5" />Campanhas {campanhas.length > 0 && <span className="ml-1 bg-ber-teal text-white text-[10px] rounded-full px-1.5">{campanhas.length}</span>}
        </button>
      </div>

      {subTab === 'campanhas' && <CampanhaView campanhas={campanhas} contatos={contatos} users={users} onRefresh={onRefresh} />}

      {subTab === 'painel' && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <select className="border border-ber-border rounded-lg px-2.5 py-1.5 text-sm text-ber-gray focus:outline-none focus:border-ber-teal" value={filtroTemp} onChange={e => setFiltroTemp(e.target.value)}>
              <option value="">Todas temperaturas</option>
              {Object.entries(TEMP_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="border border-ber-border rounded-lg px-2.5 py-1.5 text-sm text-ber-gray focus:outline-none focus:border-ber-teal" value={filtroTag} onChange={e => setFiltroTag(e.target.value)}>
              <option value="">Todas as tags</option>
              {NUTRICAO_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex rounded-lg border border-ber-border overflow-hidden">
                <button onClick={() => setViewMode('lista')} className={`p-1.5 ${viewMode === 'lista' ? 'bg-ber-teal text-white' : 'text-ber-gray hover:bg-ber-surface'}`}><List size={14} /></button>
                <button onClick={() => setViewMode('kanban')} className={`p-1.5 ${viewMode === 'kanban' ? 'bg-ber-teal text-white' : 'text-ber-gray hover:bg-ber-surface'}`}><LayoutGrid size={14} /></button>
              </div>
              <button onClick={() => setShowAdicionar(true)} className="flex items-center gap-1.5 bg-ber-teal text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-ber-teal/80">
                <Plus size={14} /> Adicionar
              </button>
            </div>
          </div>

          {/* Hoje */}
          {paraHoje.length > 0 && (
            <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5 mb-2">
                <AlertCircle size={13} /> {paraHoje.length} contato{paraHoje.length > 1 ? 's' : ''} para hoje
              </p>
              <div className="space-y-2">
                {paraHoje.map(c => <ContactCard key={c.id} contato={c} onRefresh={onRefresh} />)}
              </div>
            </div>
          )}

          {/* Lista ou Kanban */}
          {nurturing.length === 0 ? (
            <div className="text-center py-16 text-ber-gray">
              <Thermometer size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum contato em nutrição ainda.</p>
              <button onClick={() => setShowAdicionar(true)} className="mt-3 text-ber-teal text-sm font-semibold hover:underline">Adicionar contatos →</button>
            </div>
          ) : viewMode === 'lista' ? (
            <div className="space-y-2">
              {filtered.map(c => <ContactCard key={c.id} contato={c} onRefresh={onRefresh} />)}
              {filtered.length === 0 && <p className="text-center py-8 text-sm text-ber-gray">Nenhum contato com esses filtros.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 overflow-x-auto">
              {(['quente', 'morno', 'frio', 'gelado'] as const).map(temp => {
                const cfg = TEMP_CONFIG[temp];
                const group = byTemp[temp];
                return (
                  <div key={temp} className="min-w-[220px]">
                    <div className={`flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg ${cfg.color}`}>
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className="text-xs font-bold">{cfg.label}</span>
                      <span className="ml-auto text-xs font-semibold">{group.length}</span>
                    </div>
                    <div className="space-y-2">
                      {group.map(c => <ContactCard key={c.id} contato={c} onRefresh={onRefresh} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showAdicionar && (
        <AdicionarContatoDrawer
          todos={outros}
          jaNaNutricao={nurturing.map(c => c.id)}
          onClose={() => setShowAdicionar(false)}
          onSave={() => { setShowAdicionar(false); onRefresh(); }}
        />
      )}
    </div>
  );
}
