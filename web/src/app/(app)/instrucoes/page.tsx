'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  Search, ExternalLink, Plus, X,
  FileText, Trash2, ArrowLeft, Eye, Pencil, CheckCircle, Archive,
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────

const DISCIPLINE_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'eletrica', label: 'Elétrica' },
  { value: 'hidraulica', label: 'Hidráulica' },
  { value: 'alvenaria', label: 'Alvenaria' },
  { value: 'ar_condicionado', label: 'AC/HVAC' },
  { value: 'impermeabilizacao', label: 'Impermeabilização' },
  { value: 'revestimento', label: 'Revestimento' },
  { value: 'acabamento', label: 'Acabamento' },
  { value: 'marcenaria', label: 'Marcenaria' },
  { value: 'vidros', label: 'Vidros' },
  { value: 'outro', label: 'Canteiro/Outro' },
];

const DISCIPLINE_COLORS: Record<string, string> = {
  estrutura:         'bg-gray-100 text-gray-700',
  hidraulica:        'bg-blue-100 text-blue-700',
  eletrica:          'bg-amber-100 text-amber-700',
  impermeabilizacao: 'bg-teal-100 text-teal-700',
  revestimento:      'bg-purple-100 text-purple-700',
  acabamento:        'bg-ber-olive/15 text-ber-olive',
  seguranca:         'bg-red-100 text-red-600',
  alvenaria:         'bg-stone-100 text-stone-700',
  ar_condicionado:   'bg-sky-100 text-sky-700',
  marcenaria:        'bg-orange-100 text-orange-700',
  vidros:            'bg-cyan-100 text-cyan-700',
  outro:             'bg-gray-100 text-gray-600',
};

const DISCIPLINE_LABELS: Record<string, string> = {
  estrutura:         'Estrutura',
  hidraulica:        'Hidráulica',
  eletrica:          'Elétrica',
  impermeabilizacao: 'Impermeabilização',
  revestimento:      'Revestimento',
  acabamento:        'Acabamento',
  seguranca:         'Segurança',
  alvenaria:         'Alvenaria',
  ar_condicionado:   'AC/HVAC',
  marcenaria:        'Marcenaria',
  vidros:            'Vidros',
  outro:             'Canteiro/Outro',
};

const ALL_DISCIPLINES = Object.entries(DISCIPLINE_LABELS);

const IT_STATUS: Record<string, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho', className: 'bg-ber-gray/10 text-ber-gray' },
  publicada: { label: 'Publicada', className: 'bg-green-100 text-green-700' },
  arquivada: { label: 'Arquivada', className: 'bg-amber-100 text-amber-700' },
};

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface Norma {
  id: string;
  code: string;
  title: string;
  discipline: string;
  summary: string | null;
  source: string;
  url: string | null;
}

interface ITStep {
  order: number;
  title: string;
  description: string;
  photoUrl?: string;
}

interface IT {
  id: string;
  code: string;
  title: string;
  discipline: string;
  objective: string | null;
  content: string | null;
  materials: string[];
  tools: string[];
  steps: ITStep[];
  attentionPoints: string[];
  approvalCriteria: string[];
  relatedNormas: string[];
  normas: string[];
  epis: string[];
  preRequisitos: string | null;
  criteriosQualidade: string | null;
  errosComuns: string | null;
  fvsCode: string | null;
  status: string;
  creator: { id: string; name: string } | null;
  updater: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  normasDetails?: Norma[];
}

// ─── Component ──────────────────────────────────────────────────────────────

// ─── IT Detail View ──────────────────────────────────────────────────────────

function CollapsibleSection({ title, accent = 'text-ber-gray', defaultOpen = false, children }: {
  title: string; accent?: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-ber-gray/10 mt-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-[3px] rounded-full bg-[#5A7A7A]" />
          <span className={`text-xs font-black uppercase tracking-widest ${accent}`}>{title}</span>
        </div>
        <span className="text-ber-gray text-sm">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

function ITDetailView({ it, discColor, discLabel, statusCfg, canCreate, onBack, onEdit, onPublish }: {
  it: IT; discColor: string; discLabel: string;
  statusCfg: { label: string; className: string };
  canCreate: boolean;
  onBack: () => void; onEdit: () => void; onPublish: (s: string) => void;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Back */}
      <button onClick={onBack} className="mb-4 flex items-center gap-2 text-sm text-ber-gray hover:text-ber-carbon transition-colors">
        <ArrowLeft size={16} /> Voltar
      </button>

      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        {/* Faixa de disciplina topo */}
        <div className="h-1.5 w-full" style={{ backgroundColor: '#5A7A7A' }} />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-2xl font-black text-ber-carbon">{it.code}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${discColor}`}>{discLabel}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusCfg.className}`}>{statusCfg.label}</span>
                {it.fvsCode && (
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-ber-olive/15 text-ber-olive">
                    FVS: {it.fvsCode}
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-base font-bold text-ber-carbon leading-tight">{it.title}</h1>
            </div>
            {canCreate && (
              <div className="flex gap-1.5 shrink-0">
                <button onClick={onEdit} className="flex items-center gap-1 rounded-md border border-ber-gray/30 px-2.5 py-1.5 text-xs font-medium text-ber-carbon hover:bg-ber-offwhite">
                  <Pencil size={11} /> Editar
                </button>
                {it.status === 'rascunho' && (
                  <button onClick={() => onPublish('publicada')} className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                    <CheckCircle size={11} /> Publicar
                  </button>
                )}
                {it.status === 'publicada' && (
                  <button onClick={() => onPublish('arquivada')} className="flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">
                    <Archive size={11} /> Arquivar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Seções colapsáveis */}
          <div className="space-y-0">

            {/* Objetivo */}
            {it.objective && (
              <CollapsibleSection title="Objetivo" defaultOpen>
                <p className="text-sm text-ber-carbon leading-relaxed">{it.objective}</p>
                {it.content && <p className="mt-2 text-sm text-ber-carbon leading-relaxed whitespace-pre-wrap">{it.content}</p>}
              </CollapsibleSection>
            )}

            {/* EPIs */}
            {it.epis && it.epis.length > 0 && (
              <CollapsibleSection title="EPIs Obrigatórios" accent="text-red-600" defaultOpen>
                <div className="flex flex-wrap gap-2">
                  {it.epis.map((epi, i) => (
                    <span key={i} className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                      🦺 {epi}
                    </span>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Pré-requisitos */}
            {it.preRequisitos && (
              <CollapsibleSection title="Pré-requisitos" defaultOpen>
                <p className="text-sm text-ber-carbon leading-relaxed whitespace-pre-wrap">{it.preRequisitos}</p>
              </CollapsibleSection>
            )}

            {/* Materiais */}
            {it.materials && it.materials.length > 0 && (
              <CollapsibleSection title="Materiais">
                <ul className="space-y-1">
                  {it.materials.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ber-carbon">
                      <span className="text-[#5A7A7A] mt-0.5">•</span> {m}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* Ferramentas */}
            {it.tools && it.tools.length > 0 && (
              <CollapsibleSection title="Ferramentas">
                <ul className="space-y-1">
                  {it.tools.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ber-carbon">
                      <span className="text-[#5A7A7A] mt-0.5">•</span> {t}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* Passo a Passo */}
            {it.steps && it.steps.length > 0 && (
              <CollapsibleSection title="Passo a Passo" accent="text-ber-carbon" defaultOpen>
                <div className="space-y-3">
                  {it.steps.map((step) => (
                    <div key={step.order} className="flex gap-3 rounded-lg bg-ber-offwhite/60 p-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#5A7A7A] text-xs font-black text-white">
                        {step.order}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-ber-carbon">{step.title}</p>
                        <p className="mt-0.5 text-xs text-ber-gray leading-relaxed">{step.description}</p>
                        {step.photoUrl && (
                          <img src={step.photoUrl} alt={step.title} className="mt-2 w-full max-h-48 rounded-lg object-cover" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Critérios de Qualidade */}
            {(it.criteriosQualidade || (it.approvalCriteria && it.approvalCriteria.length > 0)) && (
              <CollapsibleSection title="Critérios de Qualidade" accent="text-ber-olive">
                {it.criteriosQualidade && (
                  <p className="text-sm text-ber-carbon leading-relaxed whitespace-pre-wrap mb-2">{it.criteriosQualidade}</p>
                )}
                {it.approvalCriteria && it.approvalCriteria.length > 0 && (
                  <ul className="space-y-1">
                    {it.approvalCriteria.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-ber-carbon">
                        <span className="text-ber-olive mt-0.5">✓</span> {c}
                      </li>
                    ))}
                  </ul>
                )}
              </CollapsibleSection>
            )}

            {/* Erros Comuns */}
            {it.errosComuns && (
              <CollapsibleSection title="Erros Comuns" accent="text-red-500">
                <p className="text-sm text-ber-carbon leading-relaxed whitespace-pre-wrap">{it.errosComuns}</p>
              </CollapsibleSection>
            )}

            {/* Pontos de Atenção */}
            {it.attentionPoints && it.attentionPoints.length > 0 && (
              <CollapsibleSection title="Pontos de Atenção" accent="text-red-500">
                <ul className="space-y-1">
                  {it.attentionPoints.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-ber-carbon">
                      <span className="text-red-500 mt-0.5">⚠</span> {a}
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* Normas */}
            {((it.normas && it.normas.length > 0) || (it.normasDetails && it.normasDetails.length > 0)) && (
              <CollapsibleSection title="Normas Técnicas">
                <div className="flex flex-wrap gap-2">
                  {it.normas && it.normas.map((n, i) => (
                    <span key={i} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{n}</span>
                  ))}
                  {it.normasDetails && it.normasDetails.map((n: Norma) => (
                    <span key={n.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      {n.code} — {n.title}
                      {n.url && <a href={n.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={10} /></a>}
                    </span>
                  ))}
                </div>
              </CollapsibleSection>
            )}

          </div>

          {/* Meta */}
          <div className="mt-4 pt-3 border-t border-ber-gray/10 text-[10px] text-ber-gray flex flex-wrap gap-3">
            {it.creator && <span>Criado por <strong>{it.creator.name}</strong></span>}
            {it.updater && <span>Atualizado por <strong>{it.updater.name}</strong></span>}
            <span>{new Date(it.updatedAt).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InstrucoesPage() {
  const user = useAuthStore((s) => s.user);
  const canCreate = user?.role === 'diretoria' || user?.role === 'coordenacao';

  const [its, setIts] = useState<IT[]>([]);
  const [loadingITs, setLoadingITs] = useState(true);
  const [itSearch, setItSearch] = useState('');
  const [itDiscipline, setItDiscipline] = useState('');
  const [viewingIT, setViewingIT] = useState<IT | null>(null);
  const [loadingViewIT, setLoadingViewIT] = useState(false);
  const [showITForm, setShowITForm] = useState(false);
  const [editingIT, setEditingIT] = useState<IT | null>(null);
  const [submittingIT, setSubmittingIT] = useState(false);

  // IT form fields
  const [itCode, setItCode] = useState('');
  const [itTitle, setItTitle] = useState('');
  const [itDisc, setItDisc] = useState('estrutura');
  const [itObjective, setItObjective] = useState('');
  const [itMaterials, setItMaterials] = useState<string[]>(['']);
  const [itTools, setItTools] = useState<string[]>(['']);
  const [itSteps, setItSteps] = useState<ITStep[]>([{ order: 1, title: '', description: '' }]);
  const [itAttention, setItAttention] = useState<string[]>(['']);
  const [itCriteria, setItCriteria] = useState<string[]>(['']);
  const [itRelatedNormas, setItRelatedNormas] = useState<string[]>([]);
  const [allNormas, setAllNormas] = useState<Norma[]>([]);

  // ─── Fetch ──────────────────────────────────
  const fetchITs = useCallback(async () => {
    setLoadingITs(true);
    try {
      const params: Record<string, string> = {};
      if (itDiscipline) params.discipline = itDiscipline;
      if (itSearch) params.search = itSearch;
      const res = await api.get('/instrucoes-tecnicas', { params });
      setIts(res.data.data);
    } catch {} finally { setLoadingITs(false); }
  }, [itDiscipline, itSearch]);

  useEffect(() => {
    const timeout = setTimeout(fetchITs, 300);
    return () => clearTimeout(timeout);
  }, [fetchITs]);

  // ─── IT view ──────────────────────────────────
  async function openITView(id: string) {
    setLoadingViewIT(true);
    try {
      const res = await api.get(`/instrucoes-tecnicas/${id}`);
      setViewingIT(res.data.data);
    } catch {} finally { setLoadingViewIT(false); }
  }

  // ─── IT form helpers ──────────────────────────
  function resetITForm() {
    setItCode(''); setItTitle(''); setItDisc('estrutura'); setItObjective('');
    setItMaterials(['']); setItTools(['']); setItSteps([{ order: 1, title: '', description: '' }]);
    setItAttention(['']); setItCriteria(['']); setItRelatedNormas([]);
    setEditingIT(null);
  }

  async function openITForm(it?: IT) {
    if (allNormas.length === 0) {
      try {
        const res = await api.get('/normas');
        setAllNormas(res.data.data);
      } catch {}
    }

    if (it) {
      setEditingIT(it);
      setItCode(it.code);
      setItTitle(it.title);
      setItDisc(it.discipline);
      setItObjective(it.objective || '');
      setItMaterials(it.materials.length > 0 ? it.materials : ['']);
      setItTools(it.tools.length > 0 ? it.tools : ['']);
      setItSteps(it.steps.length > 0 ? it.steps : [{ order: 1, title: '', description: '' }]);
      setItAttention(it.attentionPoints.length > 0 ? it.attentionPoints : ['']);
      setItCriteria(it.approvalCriteria.length > 0 ? it.approvalCriteria : ['']);
      setItRelatedNormas(it.relatedNormas);
    } else {
      resetITForm();
    }
    setShowITForm(true);
  }

  async function handleSaveIT(e: React.FormEvent) {
    e.preventDefault();
    if (!itCode.trim() || !itTitle.trim()) return;
    setSubmittingIT(true);
    const body = {
      code: itCode,
      title: itTitle,
      discipline: itDisc,
      objective: itObjective || undefined,
      materials: itMaterials.filter((m) => m.trim()),
      tools: itTools.filter((t) => t.trim()),
      steps: itSteps.filter((s) => s.title.trim()).map((s, i) => ({ ...s, order: i + 1 })),
      attentionPoints: itAttention.filter((a) => a.trim()),
      approvalCriteria: itCriteria.filter((c) => c.trim()),
      relatedNormas: itRelatedNormas,
    };
    try {
      if (editingIT) {
        await api.put(`/instrucoes-tecnicas/${editingIT.id}`, body);
      } else {
        await api.post('/instrucoes-tecnicas', body);
      }
      setShowITForm(false);
      resetITForm();
      fetchITs();
    } catch {} finally { setSubmittingIT(false); }
  }

  async function handlePublishIT(id: string, status: 'publicada' | 'arquivada') {
    try {
      await api.patch(`/instrucoes-tecnicas/${id}/publish`, { status });
      fetchITs();
      if (viewingIT?.id === id) {
        setViewingIT((prev) => prev ? { ...prev, status } : null);
      }
    } catch {}
  }

  // ─── Dynamic list helpers ─────────────────────
  function updateListItem<T>(list: T[], idx: number, value: T, setter: (v: T[]) => void) {
    const copy = [...list];
    copy[idx] = value;
    setter(copy);
  }
  function addListItem<T>(list: T[], value: T, setter: (v: T[]) => void) {
    setter([...list, value]);
  }
  function removeListItem<T>(list: T[], idx: number, setter: (v: T[]) => void) {
    setter(list.filter((_, i) => i !== idx));
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  // IT detail view
  if (viewingIT) {
    const discColor = DISCIPLINE_COLORS[viewingIT.discipline] || 'bg-gray-100 text-gray-600';
    const discLabel = DISCIPLINE_LABELS[viewingIT.discipline] || viewingIT.discipline;
    const statusCfg = IT_STATUS[viewingIT.status] || IT_STATUS.rascunho;

    return (
      <ITDetailView
        it={viewingIT}
        discColor={discColor}
        discLabel={discLabel}
        statusCfg={statusCfg}
        canCreate={canCreate}
        onBack={() => setViewingIT(null)}
        onEdit={() => { setViewingIT(null); openITForm(viewingIT); }}
        onPublish={(s) => handlePublishIT(viewingIT.id, s)}
      />
    );
  }

  // ─── Main page ────────────────────────────────────────────────────────────

  return (
    <div>
      <h1 className="text-2xl font-black text-ber-carbon">Instruções Técnicas</h1>
      <p className="mt-1 text-sm text-ber-gray">
        Biblioteca de instruções técnicas BER
      </p>

      {/* Search + filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-ber-gray" />
          <input type="text" value={itSearch} onChange={(e) => setItSearch(e.target.value)}
            placeholder="Buscar por código ou título..."
            className="w-full rounded-lg border border-ber-gray/20 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DISCIPLINE_FILTERS.map((f) => (
            <button key={f.value} onClick={() => setItDiscipline(f.value)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${itDiscipline === f.value ? 'bg-ber-carbon text-white' : 'bg-white text-ber-gray shadow-sm hover:bg-ber-offwhite'}`}>
              {f.label}
            </button>
          ))}
        </div>
        {canCreate && (
          <button onClick={() => openITForm()}
            className="flex items-center gap-2 rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ber-black">
            <Plus size={14} /> Nova IT
          </button>
        )}
      </div>

      {/* List */}
      <div className="mt-6">
        {loadingITs ? (
          <p className="py-12 text-center text-sm text-ber-gray">Carregando instruções técnicas...</p>
        ) : its.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <FileText size={40} className="mb-3 text-ber-gray/30" />
            <p className="text-sm text-ber-gray">Nenhuma instrução técnica encontrada.</p>
            {canCreate && (
              <button onClick={() => openITForm()} className="mt-3 text-sm font-medium text-ber-teal hover:underline">
                Criar primeira instrução técnica
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {its.map((it) => {
              const discColor = DISCIPLINE_COLORS[it.discipline] || 'bg-gray-100 text-gray-600';
              const discLabel = DISCIPLINE_LABELS[it.discipline] || it.discipline;
              const statusCfg = IT_STATUS[it.status] || IT_STATUS.rascunho;
              return (
                <button key={it.id} onClick={() => openITView(it.id)}
                  className="flex w-full items-center gap-4 rounded-lg bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ber-carbon/5">
                    <FileText size={18} className="text-ber-carbon" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-ber-carbon">{it.code}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${discColor}`}>{discLabel}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusCfg.className}`}>{statusCfg.label}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-ber-carbon">{it.title}</p>
                  </div>
                  <Eye size={16} className="shrink-0 text-ber-gray" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── IT Form Modal ─── */}
      {showITForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 py-8">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
              <h2 className="text-lg font-black text-ber-carbon">
                {editingIT ? `Editar ${editingIT.code}` : 'Nova Instrução Técnica'}
              </h2>
              <button onClick={() => { setShowITForm(false); resetITForm(); }}
                className="rounded p-1 text-ber-gray transition-colors hover:bg-ber-offwhite hover:text-ber-carbon">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveIT} className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
              {/* Basic info */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ber-carbon">Código *</label>
                  <input type="text" value={itCode} onChange={(e) => setItCode(e.target.value)} placeholder="IT-01"
                    className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" required />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-ber-carbon">Título *</label>
                  <input type="text" value={itTitle} onChange={(e) => setItTitle(e.target.value)}
                    className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" required />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ber-carbon">Disciplina</label>
                <select value={itDisc} onChange={(e) => setItDisc(e.target.value)}
                  className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none">
                  {ALL_DISCIPLINES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ber-carbon">Objetivo</label>
                <textarea value={itObjective} onChange={(e) => setItObjective(e.target.value)} rows={2}
                  className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
              </div>

              {/* Materials */}
              <div>
                <label className="block text-xs font-medium text-ber-carbon">Materiais</label>
                {itMaterials.map((m, i) => (
                  <div key={i} className="mt-1 flex gap-1">
                    <input type="text" value={m} onChange={(e) => updateListItem(itMaterials, i, e.target.value, setItMaterials)}
                      placeholder="Material..." className="flex-1 rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                    {itMaterials.length > 1 && (
                      <button type="button" onClick={() => removeListItem(itMaterials, i, setItMaterials)} className="rounded p-1 text-ber-gray hover:text-red-500"><Trash2 size={14} /></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addListItem(itMaterials, '', setItMaterials)}
                  className="mt-1 text-xs font-medium text-ber-teal hover:underline">+ Adicionar material</button>
              </div>

              {/* Tools */}
              <div>
                <label className="block text-xs font-medium text-ber-carbon">Ferramentas</label>
                {itTools.map((t, i) => (
                  <div key={i} className="mt-1 flex gap-1">
                    <input type="text" value={t} onChange={(e) => updateListItem(itTools, i, e.target.value, setItTools)}
                      placeholder="Ferramenta..." className="flex-1 rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                    {itTools.length > 1 && (
                      <button type="button" onClick={() => removeListItem(itTools, i, setItTools)} className="rounded p-1 text-ber-gray hover:text-red-500"><Trash2 size={14} /></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addListItem(itTools, '', setItTools)}
                  className="mt-1 text-xs font-medium text-ber-teal hover:underline">+ Adicionar ferramenta</button>
              </div>

              {/* Steps */}
              <div>
                <label className="block text-xs font-medium text-ber-carbon">Passo a Passo</label>
                {itSteps.map((step, i) => (
                  <div key={i} className="mt-2 rounded-md border border-ber-gray/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ber-gray">Passo {i + 1}</span>
                      {itSteps.length > 1 && (
                        <button type="button" onClick={() => removeListItem(itSteps, i, setItSteps)} className="rounded p-0.5 text-ber-gray hover:text-red-500"><Trash2 size={12} /></button>
                      )}
                    </div>
                    <input type="text" value={step.title} onChange={(e) => updateListItem(itSteps, i, { ...step, title: e.target.value }, setItSteps)}
                      placeholder="Título do passo" className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                    <textarea value={step.description} onChange={(e) => updateListItem(itSteps, i, { ...step, description: e.target.value }, setItSteps)}
                      placeholder="Descrição detalhada..." rows={2}
                      className="mt-1 w-full rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                  </div>
                ))}
                <button type="button" onClick={() => addListItem(itSteps, { order: itSteps.length + 1, title: '', description: '' }, setItSteps)}
                  className="mt-1 text-xs font-medium text-ber-teal hover:underline">+ Adicionar passo</button>
              </div>

              {/* Attention Points */}
              <div>
                <label className="block text-xs font-medium text-ber-carbon">Pontos de Atenção</label>
                {itAttention.map((a, i) => (
                  <div key={i} className="mt-1 flex gap-1">
                    <input type="text" value={a} onChange={(e) => updateListItem(itAttention, i, e.target.value, setItAttention)}
                      placeholder="Ponto de atenção..." className="flex-1 rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                    {itAttention.length > 1 && (
                      <button type="button" onClick={() => removeListItem(itAttention, i, setItAttention)} className="rounded p-1 text-ber-gray hover:text-red-500"><Trash2 size={14} /></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addListItem(itAttention, '', setItAttention)}
                  className="mt-1 text-xs font-medium text-ber-teal hover:underline">+ Adicionar ponto</button>
              </div>

              {/* Approval Criteria */}
              <div>
                <label className="block text-xs font-medium text-ber-carbon">Critérios de Aprovação</label>
                {itCriteria.map((c, i) => (
                  <div key={i} className="mt-1 flex gap-1">
                    <input type="text" value={c} onChange={(e) => updateListItem(itCriteria, i, e.target.value, setItCriteria)}
                      placeholder="Critério..." className="flex-1 rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
                    {itCriteria.length > 1 && (
                      <button type="button" onClick={() => removeListItem(itCriteria, i, setItCriteria)} className="rounded p-1 text-ber-gray hover:text-red-500"><Trash2 size={14} /></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addListItem(itCriteria, '', setItCriteria)}
                  className="mt-1 text-xs font-medium text-ber-teal hover:underline">+ Adicionar critério</button>
              </div>

              {/* Related Normas */}
              <div>
                <label className="block text-xs font-medium text-ber-carbon">Normas Relacionadas</label>
                <div className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded-md border border-ber-gray/20 p-2">
                  {allNormas.length === 0 ? (
                    <p className="text-xs text-ber-gray">Carregando normas...</p>
                  ) : (
                    allNormas.map((n) => (
                      <label key={n.id} className="flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={itRelatedNormas.includes(n.id)}
                          onChange={(e) => {
                            if (e.target.checked) setItRelatedNormas((prev) => [...prev, n.id]);
                            else setItRelatedNormas((prev) => prev.filter((id) => id !== n.id));
                          }}
                          className="rounded border-ber-gray/30 text-ber-teal focus:ring-ber-teal" />
                        <span className="font-medium text-ber-carbon">{n.code}</span>
                        <span className="text-ber-gray">{n.title}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-ber-gray/10 pt-4">
                <button type="button" onClick={() => { setShowITForm(false); resetITForm(); }}
                  className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray transition-colors hover:bg-ber-offwhite">
                  Cancelar
                </button>
                <button type="submit" disabled={submittingIT || !itCode.trim() || !itTitle.trim()}
                  className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ber-black disabled:opacity-50">
                  {submittingIT ? 'Salvando...' : editingIT ? 'Salvar Alterações' : 'Criar Instrução'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
