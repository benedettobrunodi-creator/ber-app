'use client';

import { useEffect, useMemo, useState, Fragment } from 'react';
import api from '@/lib/api';
import {
  Plus, X, Copy, Check, Pencil, Trash2, GripVertical,
  Filter, Search, MessageSquare, ThermometerSun, Settings2, AlertCircle, Star,
} from 'lucide-react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCorners, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Contato, User, NutricaoEtapa, NutricaoPerfil, NutricaoPotencial, NutricaoCanal, NutricaoTemplate, CampanhaNutricao, PapelContato,
  NUTRICAO_ETAPAS, NUTRICAO_PERFIS, NUTRICAO_POTENCIAIS, NUTRICAO_CANAIS, PAPEIS_CONTATO, CRM_SETORES,
} from '../types';

type Segmento = 'todos' | NutricaoPerfil;

interface Props {
  contatos: Contato[];
  users: User[];
  onRefresh: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const perfilLabel = (v: NutricaoPerfil | null) => NUTRICAO_PERFIS.find(p => p.value === v)?.label ?? '—';
const potencialConfig = (v: NutricaoPotencial | null) => NUTRICAO_POTENCIAIS.find(p => p.value === v);

function fmtDias(iso: string | null) {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return 'hoje';
  if (d === 1) return '1d';
  return `${d}d`;
}

// ── Card do contato ───────────────────────────────────────────────────────────

function CardContato({
  contato,
  onOpenTouchpoints,
  onEdit,
  onRemove,
  onToggleEstrela,
}: {
  contato: Contato;
  onOpenTouchpoints: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onToggleEstrela: () => void;
}) {
  const potCfg = potencialConfig(contato.potencial);
  const papelCfg = PAPEIS_CONTATO.find(p => p.value === contato.papel);
  return (
    <div className={`bg-white border rounded-lg p-3 shadow-sm ${contato.estrela ? 'border-amber-400 shadow-[0_0_0_1px_rgba(245,158,11,0.35)]' : 'border-ber-border'}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold text-ber-carbon leading-tight truncate">{contato.nome}</p>
          </div>
          {contato.cargo && <p className="text-[11px] text-ber-carbon truncate font-medium">{contato.cargo}</p>}
          {contato.empresa && (
            <div className="mt-0.5">
              <p className="text-[11px] text-ber-gray truncate">{contato.empresa.razaoSocial}</p>
              {contato.empresa.setor && (
                <span className="inline-block text-[9px] text-ber-teal bg-ber-teal/10 px-1 rounded mt-0.5">{contato.empresa.setor}</span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleEstrela(); }}
          className={`shrink-0 rounded p-0.5 transition-colors ${contato.estrela ? 'text-amber-500 hover:text-amber-600' : 'text-ber-gray/30 hover:text-amber-400'}`}
          title={contato.estrela ? 'Remover estrela' : 'Marcar como VIP (eventos/brindes)'}
        >
          <Star size={14} fill={contato.estrela ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-1 flex-wrap">
        {papelCfg && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${papelCfg.cls}`}>
            {papelCfg.label}
          </span>
        )}
        {contato.perfil && (
          <span className="text-[10px] bg-ber-surface text-ber-gray px-1.5 py-0.5 rounded">
            {perfilLabel(contato.perfil)}
          </span>
        )}
        {potCfg && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${potCfg.cls}`}>
            {potCfg.label}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-ber-gray/70">
        <span>último: {fmtDias(contato.ultimoContato) ?? 'nunca'}</span>
        {contato.proximoContato && <span>próximo: {fmtDias(contato.proximoContato)}</span>}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <button
          onClick={onOpenTouchpoints}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-ber-teal/10 text-ber-teal text-[11px] font-semibold py-1.5 hover:bg-ber-teal/20"
          title="Executar touchpoint (mensagem pronta)"
        >
          <MessageSquare size={11} /> Touchpoint
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="rounded-md border border-ber-border text-ber-gray hover:text-ber-carbon hover:bg-ber-surface p-1.5"
          title="Editar segmentação (perfil/potencial/etapa)"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="rounded-md border border-ber-border text-ber-gray hover:text-red-600 hover:bg-red-50 p-1.5"
          title="Excluir contato do CRM"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Card sortable ─────────────────────────────────────────────────────────────

function SortableCard(props: {
  contato: Contato;
  onOpenTouchpoints: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onToggleEstrela: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.contato.id,
    data: { etapa: props.contato.etapaNutricao },
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="relative">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute -left-1 top-2 z-10 rounded p-0.5 text-ber-gray/30 hover:text-ber-carbon cursor-grab active:cursor-grabbing touch-none opacity-0 hover:opacity-100 group-hover:opacity-100"
        title="Arrastar"
      >
        <GripVertical size={12} />
      </button>
      <CardContato {...props} />
    </div>
  );
}

// ── Coluna droppable ──────────────────────────────────────────────────────────

function DroppableColumn({ etapa, children }: { etapa: NutricaoEtapa; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${etapa}`, data: { etapa, isColumn: true } });
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 rounded-xl p-2 space-y-2 overflow-y-auto transition-colors ${
        isOver ? 'bg-ber-teal/10 ring-2 ring-ber-teal/40' : 'bg-ber-surface'
      }`}
    >
      {children}
    </div>
  );
}

// ── Modal editar segmentação do contato ───────────────────────────────────────

function EditContatoModal({
  contato,
  onClose,
  onSaved,
}: {
  contato: Contato;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [perfil, setPerfil] = useState<NutricaoPerfil | ''>(contato.perfil ?? '');
  const [potencial, setPotencial] = useState<NutricaoPotencial | ''>(contato.potencial ?? '');
  const [papel, setPapel] = useState<PapelContato | ''>(contato.papel ?? '');
  const [etapa, setEtapa] = useState<NutricaoEtapa>(contato.etapaNutricao ?? 'descoberta');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/crm/contatos/${contato.id}`, {
        perfil: perfil || null,
        potencial: potencial || null,
        papel: papel || null,
        etapaNutricao: etapa,
      });
      onSaved();
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md bg-white rounded-xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-ber-carbon text-sm">Segmentar contato</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <p className="text-xs text-ber-gray">{contato.nome} · {contato.empresa?.razaoSocial ?? '—'}</p>

        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Perfil</label>
          <select value={perfil} onChange={e => setPerfil(e.target.value as NutricaoPerfil)}
            className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm">
            <option value="">—</option>
            {NUTRICAO_PERFIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Potencial</label>
          <select value={potencial} onChange={e => setPotencial(e.target.value as NutricaoPotencial)}
            className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm">
            <option value="">—</option>
            {NUTRICAO_POTENCIAIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Papel na decisão</label>
          <select value={papel} onChange={e => setPapel(e.target.value as PapelContato)}
            className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm">
            <option value="">—</option>
            {PAPEIS_CONTATO.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Etapa no funil</label>
          <select value={etapa} onChange={e => setEtapa(e.target.value as NutricaoEtapa)}
            className="mt-1 w-full border border-ber-border rounded-lg px-3 py-2 text-sm">
            {NUTRICAO_ETAPAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-ber-gray hover:text-ber-carbon">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-1.5 text-sm font-semibold bg-ber-teal text-white rounded-lg hover:bg-ber-teal/80 disabled:opacity-50">
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal touchpoints (templates da etapa) ────────────────────────────────────

function TouchpointsModal({
  contato,
  templates,
  onClose,
}: {
  contato: Contato;
  templates: NutricaoTemplate[];
  onClose: () => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const relevantes = templates
    .filter(t => t.etapa === (contato.etapaNutricao ?? 'descoberta') && t.ativo)
    .filter(t => !t.perfilAlvo || t.perfilAlvo === contato.perfil);

  function copyToClipboard(id: string, corpo: string) {
    // Substitui placeholders básicos
    const preenchido = corpo
      .replace(/\[NOME\]/gi, contato.nome.split(' ')[0])
      .replace(/\[NOME_COMPLETO\]/gi, contato.nome)
      .replace(/\[EMPRESA\]/gi, contato.empresa?.razaoSocial ?? '')
      .replace(/\[CARGO\]/gi, contato.cargo ?? '');
    navigator.clipboard.writeText(preenchido);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  const etapaLabel = NUTRICAO_ETAPAS.find(e => e.value === (contato.etapaNutricao ?? 'descoberta'))?.label;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-2xl max-h-[85vh] bg-white rounded-xl flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-ber-border">
          <div>
            <h2 className="font-bold text-ber-carbon text-sm">Executar touchpoint · {etapaLabel}</h2>
            <p className="text-xs text-ber-gray mt-0.5">{contato.nome} · {contato.empresa?.razaoSocial ?? '—'}</p>
          </div>
          <button onClick={onClose}><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {relevantes.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle size={28} className="mx-auto mb-2 text-ber-gray/40" />
              <p className="text-sm text-ber-gray">Nenhum template cadastrado pra essa etapa.</p>
              <p className="text-xs text-ber-gray/60 mt-1">Use o botão "Templates" no topo pra criar.</p>
            </div>
          ) : (
            relevantes.map(t => {
              const canalCfg = NUTRICAO_CANAIS.find(c => c.value === t.canal);
              const isCopied = copiedId === t.id;
              return (
                <div key={t.id} className="border border-ber-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{canalCfg?.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-ber-carbon">{t.titulo}</p>
                        <p className="text-[10px] text-ber-gray uppercase tracking-wide">{canalCfg?.label}</p>
                      </div>
                    </div>
                    <button onClick={() => copyToClipboard(t.id, t.corpo)}
                      className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isCopied ? 'bg-green-100 text-green-700' : 'bg-ber-teal text-white hover:bg-ber-teal/80'
                      }`}>
                      {isCopied ? <Check size={12} /> : <Copy size={12} />}
                      {isCopied ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <p className="text-xs text-ber-carbon whitespace-pre-wrap bg-ber-surface/50 rounded p-2">
                    {t.corpo}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal admin de templates ──────────────────────────────────────────────────

function TemplatesModal({
  templates,
  onClose,
  onRefresh,
}: {
  templates: NutricaoTemplate[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<Partial<NutricaoTemplate> | null>(null);

  const byEtapa = useMemo(() => {
    const m: Record<string, NutricaoTemplate[]> = {};
    for (const e of NUTRICAO_ETAPAS) m[e.value] = [];
    for (const t of templates) if (m[t.etapa]) m[t.etapa].push(t);
    return m;
  }, [templates]);

  async function save() {
    if (!editing || !editing.etapa || !editing.canal || !editing.titulo || !editing.corpo) return;
    const payload = {
      etapa: editing.etapa,
      canal: editing.canal,
      titulo: editing.titulo,
      corpo: editing.corpo,
      perfilAlvo: editing.perfilAlvo || null,
      ordem: editing.ordem ?? 0,
    };
    if (editing.id) {
      await api.patch(`/crm/nutricao/templates/${editing.id}`, payload);
    } else {
      await api.post('/crm/nutricao/templates', payload);
    }
    setEditing(null);
    onRefresh();
  }

  async function remove(id: string) {
    if (!confirm('Excluir esse template?')) return;
    await api.delete(`/crm/nutricao/templates/${id}`);
    onRefresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-3xl max-h-[90vh] bg-white rounded-xl flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-ber-border">
          <div>
            <h2 className="font-bold text-ber-carbon">Templates de mensagem</h2>
            <p className="text-xs text-ber-gray mt-0.5">Use placeholders [NOME], [EMPRESA], [CARGO] — o sistema substitui automaticamente.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing({ etapa: 'descoberta', canal: 'linkedin', titulo: '', corpo: '', perfilAlvo: null, ordem: 0 })}
              className="flex items-center gap-1 rounded-lg bg-ber-teal text-white text-xs font-semibold px-3 py-1.5 hover:bg-ber-teal/80">
              <Plus size={12} /> Novo template
            </button>
            <button onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {editing && (
            <div className="border-2 border-ber-teal/40 rounded-lg p-3 bg-ber-teal/5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-ber-gray uppercase">Etapa</label>
                  <select value={editing.etapa} onChange={e => setEditing({ ...editing, etapa: e.target.value as NutricaoEtapa })}
                    className="mt-0.5 w-full border border-ber-border rounded px-2 py-1 text-sm">
                    {NUTRICAO_ETAPAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-ber-gray uppercase">Canal</label>
                  <select value={editing.canal} onChange={e => setEditing({ ...editing, canal: e.target.value as NutricaoCanal })}
                    className="mt-0.5 w-full border border-ber-border rounded px-2 py-1 text-sm">
                    {NUTRICAO_CANAIS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-ber-gray uppercase">Título interno</label>
                  <input value={editing.titulo ?? ''} onChange={e => setEditing({ ...editing, titulo: e.target.value })}
                    placeholder="Ex: Msg apresentação inicial"
                    className="mt-0.5 w-full border border-ber-border rounded px-2 py-1 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-ber-gray uppercase">Perfil-alvo (opcional)</label>
                  <select value={editing.perfilAlvo ?? ''} onChange={e => setEditing({ ...editing, perfilAlvo: (e.target.value || null) as NutricaoPerfil | null })}
                    className="mt-0.5 w-full border border-ber-border rounded px-2 py-1 text-sm">
                    <option value="">Todos os perfis</option>
                    {NUTRICAO_PERFIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-ber-gray uppercase">Corpo da mensagem</label>
                  <textarea value={editing.corpo ?? ''} onChange={e => setEditing({ ...editing, corpo: e.target.value })}
                    rows={5}
                    placeholder="Olá [NOME], tudo bem?..."
                    className="mt-0.5 w-full border border-ber-border rounded px-2 py-1 text-sm resize-y" />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditing(null)} className="text-xs text-ber-gray hover:text-ber-carbon px-2">Cancelar</button>
                <button onClick={save} className="text-xs font-semibold bg-ber-teal text-white rounded px-3 py-1 hover:bg-ber-teal/80">
                  Salvar
                </button>
              </div>
            </div>
          )}

          {NUTRICAO_ETAPAS.map(etapa => (
            <div key={etapa.value}>
              <h3 className="text-xs font-bold text-ber-carbon uppercase tracking-wide mb-1.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: etapa.color }} />
                {etapa.label}
                <span className="text-ber-gray/70 font-normal">({byEtapa[etapa.value]?.length ?? 0})</span>
              </h3>
              {byEtapa[etapa.value]?.length === 0 ? (
                <p className="text-[11px] italic text-ber-gray/50 pl-4">Nenhum template ainda.</p>
              ) : (
                <div className="space-y-1 pl-4">
                  {byEtapa[etapa.value].map(t => {
                    const canalCfg = NUTRICAO_CANAIS.find(c => c.value === t.canal);
                    return (
                      <div key={t.id} className="flex items-center gap-2 text-xs border border-ber-border rounded px-2 py-1.5">
                        <span>{canalCfg?.icon}</span>
                        <span className="font-semibold flex-1">{t.titulo}</span>
                        {t.perfilAlvo && (
                          <span className="text-[10px] bg-ber-surface px-1.5 py-0.5 rounded">{NUTRICAO_PERFIS.find(p => p.value === t.perfilAlvo)?.label}</span>
                        )}
                        <button onClick={() => setEditing(t)} className="text-ber-gray hover:text-ber-carbon"><Pencil size={11} /></button>
                        <button onClick={() => remove(t.id)} className="text-ber-gray hover:text-red-600"><Trash2 size={11} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Modal Campanhas (lista + criação por segmento) ───────────────────────────

function CampanhasModal({
  segmento,
  templates,
  onClose,
}: {
  segmento: Segmento;
  templates: NutricaoTemplate[];
  onClose: () => void;
}) {
  const [campanhas, setCampanhas] = useState<CampanhaNutricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CampanhaNutricao>>({
    nome: '', descricao: '',
    perfilAlvo: segmento === 'todos' ? null : (segmento as NutricaoPerfil),
    potencialAlvo: null, etapaAlvo: null, canal: null,
    templateId: null, modo: 'snapshot',
  });
  const [alvoCount, setAlvoCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (segmento !== 'todos') params.perfilAlvo = segmento;
      const res = await api.get<CampanhaNutricao[]>('/crm/campanhas', { params });
      setCampanhas(res.data);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [segmento]);

  // Preview de contatos alvo
  useEffect(() => {
    if (!showForm) return;
    const params: Record<string, string> = {};
    if (form.perfilAlvo)    params.perfilAlvo = form.perfilAlvo;
    if (form.potencialAlvo) params.potencialAlvo = form.potencialAlvo;
    if (form.etapaAlvo)     params.etapaAlvo = form.etapaAlvo;
    api.get<{ total: number }>('/crm/campanhas/contatos-alvo', { params })
      .then(r => setAlvoCount(r.data.total)).catch(() => setAlvoCount(null));
  }, [showForm, form.perfilAlvo, form.potencialAlvo, form.etapaAlvo]);

  async function save() {
    if (!form.nome) return;
    setSaving(true);
    try {
      await api.post('/crm/campanhas', form);
      setShowForm(false);
      setForm({ nome: '', descricao: '', perfilAlvo: segmento === 'todos' ? null : (segmento as NutricaoPerfil), potencialAlvo: null, etapaAlvo: null, canal: null, templateId: null, modo: 'snapshot' });
      load();
    } finally { setSaving(false); }
  }

  async function ativar(id: string) {
    await api.post(`/crm/campanhas/${id}/ativar`);
    load();
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta campanha?')) return;
    await api.delete(`/crm/campanhas/${id}`);
    load();
  }

  const templatesDoCanal = form.canal ? templates.filter(t => t.canal === form.canal) : templates;
  const segLabel = segmento === 'todos' ? 'Todos' : NUTRICAO_PERFIS.find(p => p.value === segmento)?.label;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-3xl max-h-[90vh] bg-white rounded-xl flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-ber-border">
          <div>
            <h2 className="font-bold text-ber-carbon">Campanhas · {segLabel}</h2>
            <p className="text-xs text-ber-gray mt-0.5">Disparos táticos por segmento</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1 rounded-lg bg-ber-teal text-white text-xs font-semibold px-3 py-1.5 hover:bg-ber-teal/80">
              <Plus size={12} /> Nova campanha
            </button>
            <button onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {showForm && (
            <div className="border-2 border-ber-teal/40 rounded-lg p-3 bg-ber-teal/5 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-ber-gray uppercase">Nome</label>
                <input value={form.nome ?? ''} onChange={e => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex: Broker Q3 · Reengajamento"
                  className="mt-0.5 w-full border border-ber-border rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-ber-gray uppercase">Descrição</label>
                <input value={form.descricao ?? ''} onChange={e => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Opcional"
                  className="mt-0.5 w-full border border-ber-border rounded px-2 py-1 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-ber-gray uppercase">Perfil</label>
                  <select value={form.perfilAlvo ?? ''}
                    onChange={e => setForm({ ...form, perfilAlvo: (e.target.value || null) as NutricaoPerfil | null })}
                    className="mt-0.5 w-full border border-ber-border rounded px-2 py-1 text-sm">
                    <option value="">Todos</option>
                    {NUTRICAO_PERFIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-ber-gray uppercase">Potencial</label>
                  <select value={form.potencialAlvo ?? ''}
                    onChange={e => setForm({ ...form, potencialAlvo: (e.target.value || null) as NutricaoPotencial | null })}
                    className="mt-0.5 w-full border border-ber-border rounded px-2 py-1 text-sm">
                    <option value="">Todos</option>
                    {NUTRICAO_POTENCIAIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-ber-gray uppercase">Etapa</label>
                  <select value={form.etapaAlvo ?? ''}
                    onChange={e => setForm({ ...form, etapaAlvo: (e.target.value || null) as NutricaoEtapa | null })}
                    className="mt-0.5 w-full border border-ber-border rounded px-2 py-1 text-sm">
                    <option value="">Todas</option>
                    {NUTRICAO_ETAPAS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-ber-gray uppercase">Canal</label>
                  <select value={form.canal ?? ''}
                    onChange={e => setForm({ ...form, canal: (e.target.value || null) as NutricaoCanal | null, templateId: null })}
                    className="mt-0.5 w-full border border-ber-border rounded px-2 py-1 text-sm">
                    <option value="">—</option>
                    {NUTRICAO_CANAIS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-ber-gray uppercase">Template</label>
                  <select value={form.templateId ?? ''}
                    onChange={e => setForm({ ...form, templateId: e.target.value || null })}
                    className="mt-0.5 w-full border border-ber-border rounded px-2 py-1 text-sm">
                    <option value="">—</option>
                    {templatesDoCanal.map(t => <option key={t.id} value={t.id}>{t.titulo}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-ber-gray uppercase">Modo</label>
                <div className="mt-1 flex gap-3">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="radio" checked={form.modo === 'snapshot'} onChange={() => setForm({ ...form, modo: 'snapshot' })} />
                    Foto (congela lista ao ativar)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="radio" checked={form.modo === 'ao_vivo'} onChange={() => setForm({ ...form, modo: 'ao_vivo' })} />
                    Ao vivo (recalcula sempre)
                  </label>
                </div>
              </div>
              {alvoCount !== null && (
                <p className="text-xs text-ber-teal font-medium">
                  Vai atingir <strong>{alvoCount}</strong> contatos com esses filtros.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="text-xs text-ber-gray hover:text-ber-carbon px-2">Cancelar</button>
                <button onClick={save} disabled={saving || !form.nome}
                  className="text-xs font-semibold bg-ber-teal text-white rounded px-3 py-1 hover:bg-ber-teal/80 disabled:opacity-50">
                  Salvar rascunho
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-center text-sm text-ber-gray py-8">Carregando…</p>
          ) : campanhas.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle size={28} className="mx-auto mb-2 text-ber-gray/40" />
              <p className="text-sm text-ber-gray">Nenhuma campanha ainda pra {segLabel}.</p>
            </div>
          ) : (
            campanhas.map(c => {
              const perfilLab = c.perfilAlvo && NUTRICAO_PERFIS.find(p => p.value === c.perfilAlvo)?.label;
              const potencialLab = c.potencialAlvo && NUTRICAO_POTENCIAIS.find(p => p.value === c.potencialAlvo)?.label;
              const canalLab = c.canal && NUTRICAO_CANAIS.find(x => x.value === c.canal)?.label;
              return (
                <div key={c.id} className="border border-ber-border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-ber-carbon">{c.nome}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.status === 'ativa' ? 'bg-green-100 text-green-700' : c.status === 'rascunho' ? 'bg-gray-100 text-gray-600' : c.status === 'pausada' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {c.status}
                        </span>
                      </div>
                      {c.descricao && <p className="text-[11px] text-ber-gray mt-0.5">{c.descricao}</p>}
                      <div className="mt-1 flex items-center gap-1 flex-wrap">
                        {perfilLab && <span className="text-[10px] bg-ber-surface text-ber-gray px-1.5 py-0.5 rounded">Perfil: {perfilLab}</span>}
                        {potencialLab && <span className="text-[10px] bg-ber-surface text-ber-gray px-1.5 py-0.5 rounded">Potencial: {potencialLab}</span>}
                        {canalLab && <span className="text-[10px] bg-ber-surface text-ber-gray px-1.5 py-0.5 rounded">Canal: {canalLab}</span>}
                        <span className="text-[10px] bg-ber-surface text-ber-gray px-1.5 py-0.5 rounded">
                          {c.modo === 'ao_vivo' ? 'Ao vivo' : 'Foto'}
                        </span>
                        {c._count && (
                          <span className="text-[10px] text-ber-teal font-semibold">{c._count.contatos} contatos</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {c.status === 'rascunho' && (
                        <button onClick={() => ativar(c.id)}
                          className="text-[11px] font-semibold bg-ber-teal text-white rounded px-2 py-1 hover:bg-ber-teal/80">
                          Ativar
                        </button>
                      )}
                      <button onClick={() => remove(c.id)} className="text-ber-gray hover:text-red-600 p-1">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function TabNutricao({ contatos: contatosProp, onRefresh }: Props) {
  const [localContatos, setLocalContatos] = useState<Contato[]>(contatosProp);
  useEffect(() => { setLocalContatos(contatosProp); }, [contatosProp]);
  const contatos = localContatos;

  const [templates, setTemplates] = useState<NutricaoTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCampanhas, setShowCampanhas] = useState(false);
  const [touchpointFor, setTouchpointFor] = useState<Contato | null>(null);
  const [editContato, setEditContato] = useState<Contato | null>(null);

  const [segmento, setSegmento] = useState<Segmento>('todos');
  const [search, setSearch] = useState('');
  const [potencialFilter, setPotencialFilter] = useState<NutricaoPotencial | ''>('');
  const [papelFilter, setPapelFilter] = useState<PapelContato | ''>('');
  const [setorFilter, setSetorFilter] = useState<string>('');
  const [soEstrelas, setSoEstrelas] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function loadTemplates() {
    const res = await api.get<NutricaoTemplate[]>('/crm/nutricao/templates');
    setTemplates(res.data);
  }
  useEffect(() => { loadTemplates(); }, []);

  // Filtragem
  const filtered = useMemo(() => {
    return contatos.filter(c => {
      if (!c.nutricao) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.nome.toLowerCase().includes(q) && !(c.empresa?.razaoSocial ?? '').toLowerCase().includes(q)) return false;
      }
      if (segmento !== 'todos' && c.perfil !== segmento) return false;
      if (potencialFilter && c.potencial !== potencialFilter) return false;
      if (papelFilter && c.papel !== papelFilter) return false;
      if (setorFilter && c.empresa?.setor !== setorFilter) return false;
      if (soEstrelas && !c.estrela) return false;
      return true;
    });
  }, [contatos, search, segmento, potencialFilter, papelFilter, setorFilter, soEstrelas]);

  // Contadores por segmento (pra mostrar nas sub-abas)
  const contadoresSegmento = useMemo(() => {
    const c: Record<Segmento, number> = { todos: 0, cliente_direto: 0, arquitetura: 0, gerenciadora: 0, broker: 0, incorporadora: 0, fundo: 0 };
    for (const ct of contatos) {
      if (!ct.nutricao) continue;
      c.todos++;
      if (ct.perfil) c[ct.perfil]++;
    }
    return c;
  }, [contatos]);

  // Agrupamento por etapa
  const byEtapa = useMemo(() => {
    const m: Record<NutricaoEtapa, Contato[]> = {
      descoberta: [], consciencia: [], engajamento: [], consideracao: [], ativo: [], pos_venda: [],
    };
    for (const c of filtered) {
      const e = (c.etapaNutricao ?? 'descoberta') as NutricaoEtapa;
      if (m[e]) m[e].push(c);
    }
    return m;
  }, [filtered]);

  async function handleToggleEstrela(contato: Contato) {
    const novo = !contato.estrela;
    setLocalContatos(prev => prev.map(c => c.id === contato.id ? { ...c, estrela: novo } : c));
    try {
      await api.patch(`/crm/contatos/${contato.id}`, { estrela: novo });
    } catch (err) {
      console.error('Erro ao alternar estrela', err);
      onRefresh();
    }
  }

  async function handleRemoverContato(contato: Contato) {
    const confirm1 = confirm(`Excluir ${contato.nome} do CRM? Esta ação é permanente.`);
    if (!confirm1) return;
    // Update local otimista pra sumir do kanban imediatamente
    setLocalContatos(prev => prev.filter(c => c.id !== contato.id));
    try {
      await api.delete(`/crm/contatos/${contato.id}`);
    } catch (err) {
      console.error('Erro ao excluir', err);
      alert('Erro ao excluir. Recarregando lista.');
      onRefresh();
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    const activeC = contatos.find(c => c.id === activeId);
    if (!activeC) return;
    const overData = over.data.current as { etapa?: NutricaoEtapa; isColumn?: boolean } | null;
    const destEtapa = overData?.etapa ?? activeC.etapaNutricao ?? 'descoberta';
    const sourceEtapa = activeC.etapaNutricao ?? 'descoberta';

    if (sourceEtapa === destEtapa) {
      const ids = contatos.filter(c => (c.etapaNutricao ?? 'descoberta') === sourceEtapa).map(c => c.id);
      const oldIdx = ids.indexOf(activeId);
      const newIdx = ids.indexOf(overId);
      if (oldIdx < 0 || newIdx < 0) return;
      const reordered = arrayMove(ids, oldIdx, newIdx);
      const fora = contatos.filter(c => (c.etapaNutricao ?? 'descoberta') !== sourceEtapa);
      const dentro = reordered.map(id => contatos.find(c => c.id === id)!);
      setLocalContatos([...fora, ...dentro]);
      try { await api.patch('/crm/nutricao/contatos/reorder', { ids: reordered }); }
      catch { onRefresh(); }
    } else {
      const idsDest = contatos.filter(c => (c.etapaNutricao ?? 'descoberta') === destEtapa).map(c => c.id);
      const insertIdx = overData?.isColumn ? idsDest.length : idsDest.indexOf(overId);
      const finalIds = [...idsDest.slice(0, insertIdx), activeId, ...idsDest.slice(insertIdx)];
      const updated = { ...activeC, etapaNutricao: destEtapa };
      const outras = contatos.filter(c => c.id !== activeId && (c.etapaNutricao ?? 'descoberta') !== destEtapa);
      const destino = finalIds.map(id => id === activeId ? updated : contatos.find(c => c.id === id)!);
      setLocalContatos([...outras, ...destino]);
      try {
        await api.patch('/crm/nutricao/contatos/reorder', { ids: finalIds, etapaNutricao: destEtapa });
        onRefresh();
      } catch { onRefresh(); }
    }
  }

  return (
    <div className="flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <ThermometerSun size={18} className="text-ber-teal" />
          <h2 className="font-bold text-ber-carbon">Funil de Nutrição</h2>
          <span className="text-xs text-ber-gray bg-ber-surface px-2 py-0.5 rounded-full">
            {filtered.length} contatos
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-ber-gray/50" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-7 pr-3 py-1.5 text-xs border border-ber-border rounded-lg w-40 focus:outline-none focus:border-ber-teal" />
          </div>
          <select value={potencialFilter} onChange={e => setPotencialFilter(e.target.value as NutricaoPotencial)}
            className="text-xs border border-ber-border rounded-lg px-2 py-1.5">
            <option value="">Todos potenciais</option>
            {NUTRICAO_POTENCIAIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={papelFilter} onChange={e => setPapelFilter(e.target.value as PapelContato)}
            className="text-xs border border-ber-border rounded-lg px-2 py-1.5">
            <option value="">Todos papéis</option>
            {PAPEIS_CONTATO.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={setorFilter} onChange={e => setSetorFilter(e.target.value)}
            className="text-xs border border-ber-border rounded-lg px-2 py-1.5">
            <option value="">Todos setores</option>
            {CRM_SETORES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => setSoEstrelas(v => !v)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              soEstrelas ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-ber-border text-ber-gray hover:text-ber-carbon'
            }`}
            title="Mostrar só contatos marcados como VIP"
          >
            <Star size={12} fill={soEstrelas ? 'currentColor' : 'none'} />
            VIP
          </button>
          <button onClick={() => setShowCampanhas(true)}
            className="flex items-center gap-1.5 rounded-lg bg-ber-teal text-white px-3 py-1.5 text-xs font-semibold hover:bg-ber-teal/80">
            <Filter size={12} /> Campanhas
          </button>
          <button onClick={() => setShowTemplates(true)}
            className="flex items-center gap-1.5 rounded-lg border border-ber-border px-3 py-1.5 text-xs font-semibold hover:bg-ber-surface">
            <Settings2 size={12} /> Templates
          </button>
        </div>
      </div>

      {/* Sub-abas por segmento (canal de vendas) */}
      <div className="flex gap-1 mb-4 overflow-x-auto border-b border-ber-border">
        {([
          { value: 'todos' as Segmento, label: 'Todos' },
          ...NUTRICAO_PERFIS.map(p => ({ value: p.value as Segmento, label: p.label })),
        ]).map(s => {
          const count = contadoresSegmento[s.value] ?? 0;
          const active = segmento === s.value;
          return (
            <button
              key={s.value}
              onClick={() => setSegmento(s.value)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? 'border-ber-teal text-ber-teal'
                  : 'border-transparent text-ber-gray hover:text-ber-carbon'
              }`}
            >
              {s.label}
              <span className={`text-[10px] rounded-full px-1.5 ${active ? 'bg-ber-teal/10' : 'bg-ber-surface'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '65vh' }}>
          {NUTRICAO_ETAPAS.map(etapa => {
            const cards = byEtapa[etapa.value];
            return (
              <div key={etapa.value} className="flex-shrink-0 w-64 flex flex-col">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: etapa.color }} />
                  <span className="text-xs font-bold text-ber-carbon uppercase tracking-wide">{etapa.label}</span>
                  <span className="ml-auto text-xs text-ber-gray bg-ber-surface rounded-full px-1.5">{cards.length}</span>
                </div>
                <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                  <DroppableColumn etapa={etapa.value}>
                    {cards.map(c => (
                      <SortableCard
                        key={c.id}
                        contato={c}
                        onOpenTouchpoints={() => setTouchpointFor(c)}
                        onEdit={() => setEditContato(c)}
                        onRemove={() => handleRemoverContato(c)}
                        onToggleEstrela={() => handleToggleEstrela(c)}
                      />
                    ))}
                    {cards.length === 0 && (
                      <p className="text-center text-xs text-ber-gray/50 py-4">Vazio</p>
                    )}
                  </DroppableColumn>
                </SortableContext>
              </div>
            );
          })}
        </div>
      </DndContext>

      {touchpointFor && (
        <TouchpointsModal contato={touchpointFor} templates={templates} onClose={() => setTouchpointFor(null)} />
      )}
      {editContato && (
        <EditContatoModal contato={editContato} onClose={() => setEditContato(null)} onSaved={onRefresh} />
      )}
      {showTemplates && (
        <TemplatesModal templates={templates} onClose={() => setShowTemplates(false)} onRefresh={loadTemplates} />
      )}
      {showCampanhas && (
        <CampanhasModal segmento={segmento} templates={templates} onClose={() => setShowCampanhas(false)} />
      )}
    </div>
  );
}
