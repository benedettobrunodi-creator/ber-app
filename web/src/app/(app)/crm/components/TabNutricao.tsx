'use client';

import { useState, useMemo } from 'react';
import api from '@/lib/api';
import {
  Phone, Mail, Linkedin, MessageCircle, Plus, X, Thermometer,
  Calendar, Clock, Check, Pencil, Trash2, Users2,
  ChevronRight, AlertCircle, TrendingUp, DollarSign, MapPin, Cake,
} from 'lucide-react';
import { Contato, Campanha, CampanhaDetalhe, CAMPANHA_STATUSES, NUTRICAO_TAGS, User, TIPOS_ATIVIDADE, ETAPAS } from '../types';

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
  quente: { label: 'Quente', color: 'bg-green-100 text-green-700',  dot: 'bg-green-400' },
  morno:  { label: 'Morno',  color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
  frio:   { label: 'Frio',   color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
  gelado: { label: 'Gelado', color: 'bg-red-100 text-red-700',      dot: 'bg-red-400' },
  novo:   { label: 'Novo',   color: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400' },
};

function fmtDias(iso: string | null) {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return 'hoje';
  if (d === 1) return '1d';
  return `${d}d`;
}

function fmtProximo(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

// ── ContatarModal ─────────────────────────────────────────────────────────────

function ContatarModal({ contato, onClose, onSave }: { contato: Contato; onClose: () => void; onSave: () => void }) {
  const [tipo, setTipo] = useState('ligacao');
  const [notas, setNotas] = useState('');
  const [retornou, setRetornou] = useState(false);
  const [resultado, setResultado] = useState('');
  const [proximoContato, setProximoContato] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/crm/contatos/${contato.id}/interacao`, {
        tipo,
        notas: notas || null,
        resultado: retornou ? (resultado || 'Retornou') : null,
        proximoContato: proximoContato || null,
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
          <button
            type="button"
            onClick={() => setRetornou(r => !r)}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${retornou ? 'border-green-400 bg-green-50 text-green-700' : 'border-ber-border text-ber-gray hover:border-ber-teal/50'}`}
          >
            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${retornou ? 'border-green-500 bg-green-500' : 'border-ber-border'}`}>
              {retornou && <Check size={10} className="text-white" />}
            </span>
            Houve retorno do contato
          </button>
          {retornou && (
            <textarea
              className="mt-2 w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-none bg-green-50/50"
              rows={2}
              value={resultado}
              onChange={e => setResultado(e.target.value)}
              placeholder="O que ele respondeu / próximos passos..."
            />
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Próximo contato</label>
          <input type="date" className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={proximoContato} onChange={e => setProximoContato(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-ber-border rounded-lg text-sm text-ber-gray hover:bg-ber-surface">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-ber-teal text-white rounded-lg text-sm font-semibold hover:bg-ber-teal/80 disabled:opacity-50">
            {saving ? '...' : '✓ Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EditNutricaoDrawer ────────────────────────────────────────────────────────

function EditNutricaoDrawer({ contato, onClose, onSave }: { contato: Contato; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    proximoContato: contato.proximoContato?.slice(0, 10) ?? '',
    notasRelacionamento: contato.notasRelacionamento ?? '',
    tags: [...contato.tags],
    aniversario: contato.aniversario?.slice(0, 10) ?? '',
    endereco: contato.endereco ?? '',
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
        aniversario: form.aniversario || null,
        endereco: form.endereco || null,
      });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm bg-white rounded-t-2xl md:rounded-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-ber-carbon text-sm">{contato.nome}</h2>
          <button onClick={onClose}><X size={16} className="text-ber-gray" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide flex items-center gap-1"><Calendar size={10} /> Próximo contato</label>
            <input type="date" className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.proximoContato} onChange={e => setForm(f => ({ ...f, proximoContato: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide flex items-center gap-1"><Cake size={10} /> Aniversário</label>
            <input type="date" className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.aniversario} onChange={e => setForm(f => ({ ...f, aniversario: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide flex items-center gap-1"><MapPin size={10} /> Endereço</label>
          <input type="text" className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" placeholder="Rua, nº, bairro, cidade" value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
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

// ── NovaOportunidadeDrawer ────────────────────────────────────────────────────

function NovaOportunidadeDrawer({ contato, onClose, onSave }: { contato: Contato; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({ titulo: '', valor: '', origem: 'networking', etapa: 'qualificacao', observacoes: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.titulo.trim()) return;
    setSaving(true);
    try {
      await api.post('/crm/oportunidades', {
        titulo: form.titulo,
        contatoId: contato.id,
        empresaId: contato.empresaId ?? null,
        valor: form.valor ? Number(form.valor) : null,
        origem: form.origem || null,
        etapa: form.etapa,
        observacoes: form.observacoes || null,
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
          <div>
            <h2 className="font-bold text-ber-carbon text-sm flex items-center gap-1.5"><TrendingUp size={14} className="text-ber-teal" /> Nova oportunidade</h2>
            <p className="text-xs text-ber-gray mt-0.5">{contato.nome} · {contato.empresa?.razaoSocial ?? '—'}</p>
          </div>
          <button onClick={onClose}><X size={16} className="text-ber-gray" /></button>
        </div>
        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Título *</label>
          <input className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" placeholder="Ex: Reforma sede corporativa" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Etapa</label>
            <select className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" value={form.etapa} onChange={e => setForm(f => ({ ...f, etapa: e.target.value }))}>
              {ETAPAS.filter(e => !['ganho','perdido','declinado','cancelado'].includes(e.value)).map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide flex items-center gap-1"><DollarSign size={10} /> Valor (R$)</label>
            <input type="number" className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal" placeholder="0" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Observações</label>
          <textarea className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ber-teal resize-none" rows={2} placeholder="O que surgiu nessa conversa..." value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-ber-border rounded-lg text-sm text-ber-gray">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.titulo.trim()} className="flex-1 py-2 bg-ber-teal text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {saving ? '...' : 'Criar oportunidade'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── HistoricoModal ────────────────────────────────────────────────────────────

type HistoricoData = {
  atividades: { id: string; tipo: string; dataHora: string; notas: string | null; resultado: string | null; concluida: boolean; usuario?: { name: string } | null }[];
  oportunidades: { id: string; titulo: string; etapa: string; valor: number | null; dataFechamentoPrevisto: string | null; createdAt: string; responsavel?: { name: string } | null }[];
};

const TIPO_LABEL: Record<string, string> = { reuniao: 'Reunião', ligacao: 'Ligação', email: 'E-mail', visita: 'Visita', outro: 'Outro' };
const ETAPA_LABEL: Record<string, string> = Object.fromEntries(ETAPAS.map(e => [e.value, e.label]));
const ETAPA_COLOR: Record<string, string> = Object.fromEntries(ETAPAS.map(e => [e.value, e.color]));

function HistoricoModal({ contato, onClose, onRefresh }: { contato: Contato; onClose: () => void; onRefresh: () => void }) {
  const [data, setData] = useState<HistoricoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNovaOp, setShowNovaOp] = useState(false);
  const [showContatar, setShowContatar] = useState(false);

  useState(() => {
    api.get(`/crm/contatos/${contato.id}/historico`)
      .then(res => setData(res.data))
      .finally(() => setLoading(false));
  });

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
  const fmtMoney = (v: number | null) => v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v) : null;
  const temp = getTemperatura(contato.ultimoContato);
  const cfg = TEMP_CONFIG[temp];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-lg bg-white rounded-t-2xl md:rounded-xl flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-ber-border">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-ber-carbon">{contato.nome}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${cfg.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
                </span>
                {contato.tags.map(tag => (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-ber-teal/10 text-ber-teal font-medium">{tag}</span>
                ))}
              </div>
              <p className="text-xs text-ber-gray mt-0.5">{contato.cargo ?? '—'} · {contato.empresa?.razaoSocial ?? '—'}</p>
              {(contato.aniversario || contato.endereco) && (
                <div className="flex items-center gap-3 mt-1 text-xs text-ber-gray">
                  {contato.aniversario && <span className="flex items-center gap-1"><Cake size={10} /> {new Date(contato.aniversario).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>}
                  {contato.endereco && <span className="flex items-center gap-1 truncate"><MapPin size={10} /> {contato.endereco}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-3">
              <button onClick={() => setShowContatar(true)} className="flex items-center gap-1.5 bg-ber-teal text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-ber-teal/80">
                <Check size={12} /> Contatar
              </button>
              <button onClick={onClose}><X size={16} className="text-ber-gray" /></button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {loading ? (
              <p className="text-sm text-ber-gray text-center py-6">Carregando...</p>
            ) : !data ? null : (
              <>
                {/* Oportunidades */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-ber-carbon uppercase tracking-wide flex items-center gap-1.5"><TrendingUp size={12} /> Oportunidades abertas ({data.oportunidades.length})</h3>
                    <button onClick={() => setShowNovaOp(true)} className="flex items-center gap-1 text-xs text-ber-teal font-semibold hover:underline">
                      <Plus size={11} /> Nova
                    </button>
                  </div>
                  {data.oportunidades.length === 0 ? (
                    <p className="text-xs text-ber-gray italic">Nenhuma oportunidade aberta.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.oportunidades.map(op => (
                        <div key={op.id} className="flex items-center gap-2 text-sm bg-ber-surface rounded-lg px-3 py-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ETAPA_COLOR[op.etapa] ?? '#868686' }} />
                          <span className="font-medium text-ber-carbon truncate flex-1">{op.titulo}</span>
                          <span className="text-ber-gray text-xs shrink-0">{ETAPA_LABEL[op.etapa] ?? op.etapa}</span>
                          {op.valor && <span className="text-green-700 text-xs font-semibold shrink-0">{fmtMoney(op.valor)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Histórico */}
                <div>
                  <h3 className="text-xs font-bold text-ber-carbon uppercase tracking-wide flex items-center gap-1.5 mb-3"><Clock size={12} /> Histórico ({data.atividades.length})</h3>
                  {data.atividades.length === 0 ? (
                    <p className="text-xs text-ber-gray italic">Sem atividades registradas.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.atividades.slice(0, 10).map(atv => (
                        <div key={atv.id} className="text-xs border-l-2 border-ber-border pl-3 py-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-ber-gray shrink-0">{fmt(atv.dataHora)}</span>
                            <span className="bg-ber-surface border border-ber-border rounded px-1.5 py-0.5 font-medium text-ber-carbon shrink-0">{TIPO_LABEL[atv.tipo] ?? atv.tipo}</span>
                            {atv.notas && <span className="text-ber-gray truncate">{atv.notas}</span>}
                          </div>
                          {atv.resultado && (
                            <div className="mt-1 flex items-start gap-1">
                              <Check size={10} className="text-green-600 mt-0.5 shrink-0" />
                              <span className="text-green-700 font-medium">{atv.resultado}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showNovaOp && <NovaOportunidadeDrawer contato={contato} onClose={() => setShowNovaOp(false)} onSave={() => { setShowNovaOp(false); setData(null); onRefresh(); }} />}
      {showContatar && <ContatarModal contato={contato} onClose={() => setShowContatar(false)} onSave={() => { setShowContatar(false); onRefresh(); onClose(); }} />}
    </>
  );
}

// ── TableRow ──────────────────────────────────────────────────────────────────

function TableRow({ contato, rowBg, onRefresh }: { contato: Contato; rowBg?: string; onRefresh: () => void }) {
  const temp = getTemperatura(contato.ultimoContato);
  const cfg = TEMP_CONFIG[temp];
  const [showContatar, setShowContatar] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const vencido = contato.proximoContato && contato.proximoContato.slice(0, 10) < todayStr;
  const isToday = contato.proximoContato && contato.proximoContato.slice(0, 10) === todayStr;

  const removeFromNutricao = async () => {
    if (!confirm(`Remover ${contato.nome} da nutrição?`)) return;
    await api.patch(`/crm/contatos/${contato.id}`, { nutricao: false });
    onRefresh();
  };

  return (
    <>
      <div className={`group flex items-center gap-3 px-4 py-2.5 border-b border-ber-border/50 hover:bg-ber-surface/60 transition-colors ${rowBg ?? ''}`}>
        {/* Temp dot */}
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} title={cfg.label} />

        {/* Contato */}
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setShowHistorico(true)}
            className="text-sm font-medium text-ber-carbon hover:text-ber-teal hover:underline truncate block text-left"
          >
            {contato.nome}
          </button>
          <p className="text-xs text-ber-gray truncate">
            {contato.empresa?.razaoSocial ?? '—'}{contato.cargo ? ` · ${contato.cargo}` : ''}
          </p>
        </div>

        {/* Tag */}
        <div className="hidden md:block w-24 shrink-0">
          {contato.tags[0] && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ber-teal/10 text-ber-teal font-medium truncate block text-center">
              {contato.tags[0]}
            </span>
          )}
          {contato.empresa?.classificacao && !contato.tags[0] && (
            <span className="text-[10px] text-ber-gray truncate block text-center">{contato.empresa.classificacao}</span>
          )}
        </div>

        {/* Último */}
        <div className="hidden md:block w-14 shrink-0 text-right">
          <span className="text-xs text-ber-gray flex items-center justify-end gap-1">
            <Clock size={10} />
            {fmtDias(contato.ultimoContato) ?? 'nunca'}
          </span>
        </div>

        {/* Próximo */}
        <div className="hidden md:block w-20 shrink-0 text-right">
          {contato.proximoContato ? (
            <span className={`text-xs font-medium flex items-center justify-end gap-1 ${vencido ? 'text-red-600' : isToday ? 'text-amber-600' : 'text-ber-carbon'}`}>
              <Calendar size={10} />
              {fmtProximo(contato.proximoContato)}
            </span>
          ) : (
            <span className="text-xs text-ber-gray/50">—</span>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Contatar — sempre visível */}
          <button
            onClick={() => setShowContatar(true)}
            className="flex items-center gap-1 text-[11px] font-semibold text-ber-teal bg-ber-teal/10 hover:bg-ber-teal hover:text-white px-2 py-1 rounded-md transition-colors"
          >
            <Check size={11} /> Contatar
          </button>
          {/* Canais — visíveis no hover */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
            {contato.whatsapp && (
              <a href={`https://wa.me/55${contato.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded text-green-600 hover:bg-green-50" title="WhatsApp">
                <MessageCircle size={13} />
              </a>
            )}
            {contato.email && (
              <a href={`mailto:${contato.email}`} className="p-1.5 rounded text-blue-600 hover:bg-blue-50" title="E-mail">
                <Mail size={13} />
              </a>
            )}
            {contato.linkedin && (
              <a href={contato.linkedin.startsWith('http') ? contato.linkedin : `https://linkedin.com/in/${contato.linkedin}`}
                target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded text-[#0077b5] hover:bg-[#0077b5]/10" title="LinkedIn">
                <Linkedin size={13} />
              </a>
            )}
            {contato.telefone && (
              <a href={`tel:${contato.telefone}`} className="p-1.5 rounded text-ber-gray hover:bg-gray-100" title="Ligar">
                <Phone size={13} />
              </a>
            )}
            <button onClick={() => setShowEdit(true)} className="p-1.5 rounded text-ber-gray hover:text-ber-teal hover:bg-ber-teal/5" title="Editar">
              <Pencil size={12} />
            </button>
            <button onClick={removeFromNutricao} className="p-1.5 rounded text-ber-gray hover:text-red-500 hover:bg-red-50" title="Remover">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {showContatar && <ContatarModal contato={contato} onClose={() => setShowContatar(false)} onSave={() => { setShowContatar(false); onRefresh(); }} />}
      {showEdit && <EditNutricaoDrawer contato={contato} onClose={() => setShowEdit(false)} onSave={() => { setShowEdit(false); onRefresh(); }} />}
      {showHistorico && <HistoricoModal contato={contato} onClose={() => setShowHistorico(false)} onRefresh={onRefresh} />}
    </>
  );
}

// ── GroupDivider ──────────────────────────────────────────────────────────────

function GroupDivider({ icon, label, count, colorClass }: { icon: React.ReactNode; label: string; count: number; colorClass: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide ${colorClass}`}>
      {icon}
      <span>{label}</span>
      <span className="font-semibold opacity-70">({count})</span>
    </div>
  );
}

// ── AdicionarContatoDrawer ────────────────────────────────────────────────────

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
        <div className="flex gap-2 mb-4 flex-wrap">
          {CAMPANHA_STATUSES.map(s => (
            <div key={s.value} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.color}`}>
              {s.label}: {breakdown[s.value] ?? 0}
            </div>
          ))}
        </div>
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
                  {cc.contato.whatsapp && <a href={`https://wa.me/55${cc.contato.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded bg-green-50 text-green-600 hover:bg-green-100"><MessageCircle size={12} /></a>}
                  {cc.contato.email && <a href={`mailto:${cc.contato.email}`} className="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"><Mail size={12} /></a>}
                  <select
                    className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ber-teal ${statusCfg.color}`}
                    value={cc.status}
                    onChange={e => updateStatus(selectedCampanha.id, cc.contato.id, e.target.value)}
                  >
                    {CAMPANHA_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <button onClick={() => removeContatoCampanha(cc.contato.id)} className="p-1 text-ber-gray hover:text-red-500"><X size={12} /></button>
                </div>
              </div>
            );
          })}
          {selectedCampanha.contatos.length === 0 && (
            <div className="text-center py-10 text-ber-gray text-sm">Nenhum contato. Adicione contatos à campanha.</div>
          )}
        </div>
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
              <button onClick={e => { e.stopPropagation(); handleDeleteCampanha(c.id); }} className="p-1.5 text-ber-gray hover:text-red-500"><Trash2 size={13} /></button>
              <ChevronRight size={16} className="text-ber-gray" />
            </div>
          </div>
        ))}
        {campanhas.length === 0 && <div className="text-center py-12 text-ber-gray text-sm">Nenhuma campanha criada ainda.</div>}
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
      {loadingCampanha && <div className="fixed inset-0 z-40 bg-black/10 flex items-center justify-center"><div className="bg-white rounded-xl px-6 py-4 text-sm text-ber-gray">Carregando...</div></div>}
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
  const [filtroTemp, setFiltroTemp] = useState('');
  const [filtroTag, setFiltroTag] = useState('');
  const [showAdicionar, setShowAdicionar] = useState(false);

  const nurturing = contatos.filter(c => c.nutricao);
  const outros = contatos.filter(c => !c.nutricao);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const endOf7Days = new Date(now.getTime() + 7 * 86_400_000);

  const vencidos  = nurturing.filter(c => c.proximoContato && c.proximoContato.slice(0, 10) < todayStr);
  const hoje      = nurturing.filter(c => c.proximoContato && c.proximoContato.slice(0, 10) === todayStr);
  const quentes   = nurturing.filter(c => getTemperatura(c.ultimoContato) === 'quente').length;
  const gelados   = nurturing.filter(c => getTemperatura(c.ultimoContato) === 'gelado').length;

  const filtered = useMemo(() => {
    return nurturing.filter(c => {
      if (filtroTemp && getTemperatura(c.ultimoContato) !== filtroTemp) return false;
      if (filtroTag && !c.tags.includes(filtroTag)) return false;
      return true;
    });
  }, [nurturing, filtroTemp, filtroTag]);

  const filteredVencidos  = filtered.filter(c => c.proximoContato && c.proximoContato.slice(0, 10) < todayStr);
  const filteredHoje      = filtered.filter(c => c.proximoContato && c.proximoContato.slice(0, 10) === todayStr);
  const filteredProximos7 = filtered.filter(c => {
    if (!c.proximoContato) return false;
    const d = new Date(c.proximoContato);
    return d > now && d <= endOf7Days;
  });
  const filteredSemData   = filtered.filter(c => !c.proximoContato);

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
          {/* Metrics bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
            <div className="bg-white border border-ber-border rounded-xl px-3 py-2.5 col-span-2 sm:col-span-1">
              <p className="text-xs text-ber-gray">Total</p>
              <p className="text-xl font-bold text-ber-carbon mt-0.5">{nurturing.length}</p>
            </div>
            <div className={`border rounded-xl px-3 py-2.5 ${vencidos.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-ber-border'}`}>
              <p className={`text-xs font-medium ${vencidos.length > 0 ? 'text-red-600' : 'text-ber-gray'}`}>⚠ Vencidos</p>
              <p className={`text-xl font-bold mt-0.5 ${vencidos.length > 0 ? 'text-red-600' : 'text-ber-carbon'}`}>{vencidos.length}</p>
            </div>
            <div className={`border rounded-xl px-3 py-2.5 ${hoje.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-ber-border'}`}>
              <p className={`text-xs font-medium ${hoje.length > 0 ? 'text-amber-700' : 'text-ber-gray'}`}>Hoje</p>
              <p className={`text-xl font-bold mt-0.5 ${hoje.length > 0 ? 'text-amber-700' : 'text-ber-carbon'}`}>{hoje.length}</p>
            </div>
            <div className="bg-white border border-ber-border rounded-xl px-3 py-2.5">
              <p className="text-xs text-green-700">🔥 Quentes</p>
              <p className="text-xl font-bold text-green-700 mt-0.5">{quentes}</p>
            </div>
            <div className="bg-white border border-ber-border rounded-xl px-3 py-2.5">
              <p className="text-xs text-red-500">🧊 Gelados</p>
              <p className="text-xl font-bold text-red-500 mt-0.5">{gelados}</p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <select className="border border-ber-border rounded-lg px-2.5 py-1.5 text-sm text-ber-gray focus:outline-none focus:border-ber-teal" value={filtroTemp} onChange={e => setFiltroTemp(e.target.value)}>
              <option value="">Todas temperaturas</option>
              {Object.entries(TEMP_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="border border-ber-border rounded-lg px-2.5 py-1.5 text-sm text-ber-gray focus:outline-none focus:border-ber-teal" value={filtroTag} onChange={e => setFiltroTag(e.target.value)}>
              <option value="">Todas as tags</option>
              {NUTRICAO_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => setShowAdicionar(true)} className="ml-auto flex items-center gap-1.5 bg-ber-teal text-white text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-ber-teal/80">
              <Plus size={14} /> Adicionar
            </button>
          </div>

          {nurturing.length === 0 ? (
            <div className="text-center py-16 text-ber-gray">
              <Thermometer size={36} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum contato em nutrição ainda.</p>
              <button onClick={() => setShowAdicionar(true)} className="mt-3 text-ber-teal text-sm font-semibold hover:underline">Adicionar contatos →</button>
            </div>
          ) : (
            <div className="bg-white border border-ber-border rounded-xl overflow-hidden">
              {/* Table header */}
              <div className="hidden md:grid px-4 py-2 border-b border-ber-border bg-ber-surface"
                style={{ gridTemplateColumns: '12px 1fr 96px 56px 80px auto' }}>
                <span />
                <span className="text-[11px] font-semibold text-ber-gray uppercase tracking-wide">Contato</span>
                <span className="text-[11px] font-semibold text-ber-gray uppercase tracking-wide text-center">Tag</span>
                <span className="text-[11px] font-semibold text-ber-gray uppercase tracking-wide text-right">Último</span>
                <span className="text-[11px] font-semibold text-ber-gray uppercase tracking-wide text-right">Próximo</span>
                <span className="text-[11px] font-semibold text-ber-gray uppercase tracking-wide text-right pr-1">Ações</span>
              </div>

              {/* Groups */}
              {filteredVencidos.length > 0 && (
                <>
                  <GroupDivider icon={<AlertCircle size={11} />} label="Vencidos" count={filteredVencidos.length} colorClass="bg-red-50 text-red-700 border-b border-red-100" />
                  {filteredVencidos.map(c => <TableRow key={c.id} contato={c} rowBg="bg-red-50/30" onRefresh={onRefresh} />)}
                </>
              )}

              {filteredHoje.length > 0 && (
                <>
                  <GroupDivider icon={<Calendar size={11} />} label="Hoje" count={filteredHoje.length} colorClass="bg-amber-50 text-amber-700 border-b border-amber-100" />
                  {filteredHoje.map(c => <TableRow key={c.id} contato={c} rowBg="bg-amber-50/30" onRefresh={onRefresh} />)}
                </>
              )}

              {filteredProximos7.length > 0 && (
                <>
                  <GroupDivider icon={<Clock size={11} />} label="Próximos 7 dias" count={filteredProximos7.length} colorClass="bg-blue-50 text-blue-700 border-b border-blue-100" />
                  {filteredProximos7.map(c => <TableRow key={c.id} contato={c} onRefresh={onRefresh} />)}
                </>
              )}

              {filteredSemData.length > 0 && (
                <>
                  <GroupDivider icon={<Clock size={11} />} label="Sem data agendada" count={filteredSemData.length} colorClass="bg-gray-50 text-ber-gray border-b border-gray-100" />
                  {filteredSemData.map(c => <TableRow key={c.id} contato={c} onRefresh={onRefresh} />)}
                </>
              )}

              {filtered.length === 0 && (
                <p className="text-center py-8 text-sm text-ber-gray">Nenhum contato com esses filtros.</p>
              )}
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
