'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { ChevronLeft, Camera, X, MapPin, HardHat, ClipboardCheck } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Obra {
  id: string; name: string; client: string | null; address: string | null;
  status: string; _count: { tasks: number; members: number };
}

interface BerClTemplate {
  id: string; code: string; name: string; recorrente: boolean;
  items: BerClTemplateItem[];
}
interface BerClTemplateItem {
  id: string; secao: string | null; descricao: string; fotoObrigatoria: boolean; ordem: number;
}
interface ObraBerClItem {
  id: string; checked: boolean; fotoUrl: string | null; observacao: string | null; filledAt: string | null; ambiente: string | null;
  templateItem: BerClTemplateItem | null;
}
interface ObraChecklistAmbiente { id: string; nome: string; ordem: number; }
interface ObraBerChecklist {
  id: string; status: string; visitaNumero: number; createdAt: string; submittedAt: string | null;
  template: BerClTemplate | null;
  filler: { id: string; name: string } | null;
  items: ObraBerClItem[];
  ambientes: ObraChecklistAmbiente[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  planejamento: { label: 'Planejamento', className: 'bg-ber-gray/10 text-ber-gray' },
  em_andamento: { label: 'Em andamento', className: 'bg-ber-teal/10 text-ber-teal' },
  pausada: { label: 'Pausada', className: 'bg-amber-100 text-amber-700' },
  concluida: { label: 'Concluída', className: 'bg-green-100 text-green-700' },
  cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-600' },
};

const CL_STATUS: Record<string, { label: string; color: string; dot: string }> = {
  nao_iniciado:    { label: 'Não iniciado',     color: 'bg-gray-100 text-gray-500',  dot: 'bg-gray-400' },
  em_preenchimento:{ label: 'Em preenchimento', color: 'bg-blue-100 text-blue-700',  dot: 'bg-blue-500' },
  concluido:       { label: 'Concluído ✓',      color: 'bg-green-100 text-green-700',dot: 'bg-green-500' },
};

const CARD_COLORS = ['bg-slate-50','bg-blue-50','bg-orange-50','bg-green-50','bg-red-50'];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChecklistsPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedObra, setSelectedObra] = useState<Obra | null>(null);
  const [checklists, setChecklists] = useState<ObraBerChecklist[]>([]);
  const [templates, setTemplates] = useState<BerClTemplate[]>([]);
  const [clLoading, setClLoading] = useState(false);

  // Detail modal
  const [activeCl, setActiveCl] = useState<ObraBerChecklist | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newAmbiente, setNewAmbiente] = useState('');

  // Load obras on mount
  useEffect(() => {
    api.get('/obras', { params: { limit: 100 } })
      .then(r => {
        const all: Obra[] = r.data.data ?? [];
        setObras(all.filter(o => ['em_andamento','planejamento'].includes(o.status)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    api.get('/ber-checklist-templates')
      .then(r => setTemplates(r.data.data ?? []))
      .catch(() => {});
  }, []);

  const loadChecklists = useCallback(async (obra: Obra) => {
    setClLoading(true);
    try {
      const r = await api.get(`/obras/${obra.id}/ber-checklists`);
      setChecklists(r.data.data ?? []);
    } catch { setChecklists([]); }
    finally { setClLoading(false); }
  }, []);

  const selectObra = (obra: Obra) => {
    setSelectedObra(obra);
    loadChecklists(obra);
  };

  // ── Checklist actions ──

  const toggleItem = async (cl: ObraBerChecklist, itemId: string) => {
    const item = cl.items.find(i => i.id === itemId);
    if (!item || cl.status === 'concluido') return;
    setSubmitting(true);
    try {
      const r = await api.patch(`/obra-ber-checklists/${cl.id}/items/${itemId}`, { checked: !item.checked });
      const updated = { ...cl, items: cl.items.map(i => i.id === itemId ? { ...i, ...r.data.data } : i) };
      setActiveCl(updated as ObraBerChecklist);
      setChecklists(prev => prev.map(c => c.id === cl.id ? updated as ObraBerChecklist : c));
    } catch (e: any) { alert(e?.response?.data?.error?.message ?? 'Erro'); }
    finally { setSubmitting(false); }
  };

  const uploadPhoto = async (cl: ObraBerChecklist, itemId: string, file: File) => {
    setSubmitting(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const up = await api.post('/uploads', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = up.data.data?.url ?? up.data.url;
      const r = await api.patch(`/obra-ber-checklists/${cl.id}/items/${itemId}`, { fotoUrl: url });
      const updated = { ...cl, items: cl.items.map(i => i.id === itemId ? { ...i, ...r.data.data } : i) };
      setActiveCl(updated as ObraBerChecklist);
      setChecklists(prev => prev.map(c => c.id === cl.id ? updated as ObraBerChecklist : c));
    } catch { alert('Erro no upload'); }
    finally { setSubmitting(false); }
  };

  const submitChecklist = async (cl: ObraBerChecklist) => {
    setSubmitting(true);
    try {
      const r = await api.post(`/obra-ber-checklists/${cl.id}/submit`);
      const updated = r.data.data as ObraBerChecklist;
      setActiveCl(updated);
      setChecklists(prev => prev.map(c => c.id === cl.id ? updated : c));
    } catch (e: any) { alert(e?.response?.data?.error?.message ?? 'Erro'); }
    finally { setSubmitting(false); }
  };

  const createChecklist = async (tmplId: string) => {
    if (!selectedObra) return;
    try {
      const r = await api.post(`/obras/${selectedObra.id}/ber-checklists`, { templateId: tmplId });
      const newCl = r.data.data as ObraBerChecklist;
      setChecklists(prev => [...prev, newCl]);
      setActiveCl(newCl);
    } catch (e: any) { alert(e?.response?.data?.error?.message ?? 'Erro'); }
  };

  const addAmbiente = async (cl: ObraBerChecklist, nome: string) => {
    try {
      const r = await api.post(`/obra-ber-checklists/${cl.id}/ambientes`, { nome });
      const updated = r.data.data.checklist as ObraBerChecklist;
      setActiveCl(updated);
      setChecklists(prev => prev.map(c => c.id === cl.id ? updated : c));
      setNewAmbiente('');
    } catch (e: any) { alert(e?.response?.data?.error?.message ?? 'Erro'); }
  };

  // ── RENDER: Obra grid ──────────────────────────────────────────────────────

  if (!selectedObra) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-ber-carbon">Checklists BÈR</h1>
          <p className="mt-0.5 text-sm text-ber-gray">Selecione uma obra para ver seus checklists</p>
        </div>

        {loading ? (
          <p className="text-sm text-ber-gray animate-pulse">Carregando obras...</p>
        ) : obras.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <HardHat size={40} className="mb-3 text-ber-gray/30" />
            <p className="text-sm text-ber-gray">Nenhuma obra ativa encontrada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {obras.map(obra => {
              const sc = STATUS_CONFIG[obra.status] ?? STATUS_CONFIG.planejamento;
              return (
                <button key={obra.id} onClick={() => selectObra(obra)}
                  className="group rounded-xl border border-ber-offwhite bg-white p-5 text-left shadow-sm transition-all hover:shadow-md hover:border-ber-teal/30">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="text-sm font-bold text-ber-carbon group-hover:text-ber-teal leading-snug">{obra.name}</h2>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.className}`}>{sc.label}</span>
                  </div>
                  {obra.client && <p className="text-xs text-ber-gray truncate">{obra.client}</p>}
                  {obra.address && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-ber-gray/60">
                      <MapPin size={10} className="shrink-0" />
                      <span className="truncate">{obra.address}</span>
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-ber-teal opacity-0 group-hover:opacity-100 transition-opacity">
                    <ClipboardCheck size={12} /> Ver checklists →
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── RENDER: Checklist list for selected obra ───────────────────────────────

  const byCode: Record<string, ObraBerChecklist[]> = {};
  checklists.forEach(c => { const code = c.template?.code ?? '?'; (byCode[code] = byCode[code] ?? []).push(c); });

  return (
    <div className="flex h-full flex-col">
      {/* Header with breadcrumb */}
      <div className="border-b border-ber-gray/10 bg-white px-6 py-4 shrink-0">
        <div className="flex items-center gap-2 text-sm text-ber-gray mb-1">
          <button onClick={() => { setSelectedObra(null); setChecklists([]); setActiveCl(null); }}
            className="flex items-center gap-1 hover:text-ber-teal transition-colors font-medium">
            <ChevronLeft size={14} /> Checklists
          </button>
          <span className="text-ber-gray/40">/</span>
          <span className="font-semibold text-ber-carbon">{selectedObra.name}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black text-ber-carbon">{selectedObra.name}</h1>
            {selectedObra.client && <p className="text-xs text-ber-gray">{selectedObra.client}</p>}
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CONFIG[selectedObra.status]?.className}`}>
            {STATUS_CONFIG[selectedObra.status]?.label}
          </span>
        </div>
      </div>

      {/* Checklist cards */}
      <div className="flex-1 overflow-auto p-6">
        {clLoading ? (
          <p className="text-sm text-ber-gray animate-pulse">Carregando checklists...</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((tmpl, idx) => {
              const instances = byCode[tmpl.code] ?? [];
              const latest = instances[instances.length - 1] ?? null;
              const sc = latest ? (CL_STATUS[latest.status] ?? CL_STATUS.nao_iniciado) : CL_STATUS.nao_iniciado;
              const checkedCount = latest?.items.filter(i => i.checked).length ?? 0;
              const totalCount = latest?.items.length ?? tmpl.items.length;
              const pct = totalCount > 0 ? Math.round(checkedCount / totalCount * 100) : 0;

              return (
                <div key={tmpl.id} className={`rounded-xl border border-ber-gray/10 ${CARD_COLORS[idx] ?? 'bg-gray-50'} p-4 shadow-sm`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ber-gray/60">{tmpl.code}</p>
                      <p className="mt-0.5 text-sm font-bold text-ber-carbon leading-snug">{tmpl.name}</p>
                      {tmpl.recorrente && (
                        <span className="mt-1 inline-block rounded-full bg-ber-teal/10 px-2 py-0.5 text-[9px] font-semibold text-ber-teal">Recorrente · {instances.length} visita{instances.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {latest && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.color}`}>{sc.label}</span>
                    )}
                  </div>

                  {/* Instances */}
                  {instances.length > 0 && (
                    <div className="mb-3 space-y-1.5 max-h-32 overflow-y-auto">
                      {instances.map(cl => {
                        const s = CL_STATUS[cl.status] ?? CL_STATUS.nao_iniciado;
                        const chk = cl.items.filter(i => i.checked).length;
                        return (
                          <button key={cl.id} onClick={() => setActiveCl(cl)}
                            className="w-full flex items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-left hover:bg-white transition-colors shadow-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                              <span className="text-xs font-medium text-ber-carbon truncate">
                                {tmpl.recorrente ? `Visita ${cl.visitaNumero}` : 'Abrir'} · {chk}/{cl.items.length}
                              </span>
                            </div>
                            <span className="shrink-0 text-[10px] text-ber-gray">{new Date(cl.createdAt).toLocaleDateString('pt-BR')}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Progress bar */}
                  {latest && (
                    <div className="mb-3">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
                        <div className="h-full rounded-full bg-ber-teal transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-0.5 text-right text-[10px] text-ber-gray">{pct}%</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {(tmpl.recorrente || instances.length === 0) && (
                      <button onClick={() => createChecklist(tmpl.id)}
                        className="flex-1 rounded-md bg-ber-carbon px-3 py-1.5 text-xs font-bold text-white hover:bg-ber-black transition-colors">
                        {tmpl.recorrente && instances.length > 0 ? '+ Nova visita' : '+ Iniciar'}
                      </button>
                    )}
                    {!tmpl.recorrente && instances.length > 0 && (
                      <button onClick={() => setActiveCl(latest!)}
                        className="flex-1 rounded-md border border-ber-gray/20 bg-white px-3 py-1.5 text-xs font-medium text-ber-carbon hover:bg-ber-offwhite transition-colors">
                        Abrir →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {activeCl && (() => {
        const cl = activeCl;
        const isLocked = cl.status === 'concluido';
        const isCl5 = cl.template?.code === 'CL_5';
        const sc = CL_STATUS[cl.status] ?? CL_STATUS.nao_iniciado;
        const checkedCount = cl.items.filter(i => i.checked).length;
        const pct = cl.items.length > 0 ? Math.round(checkedCount / cl.items.length * 100) : 0;

        // Group items by section+ambiente
        const grouped: Record<string, ObraBerClItem[]> = {};
        cl.items.forEach(i => {
          const key = i.ambiente
            ? `${i.templateItem?.secao ?? 'Geral'} · ${i.ambiente}`
            : (i.templateItem?.secao ?? 'Geral');
          (grouped[key] = grouped[key] ?? []).push(i);
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3">
            <div className="flex max-h-[94vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-2xl">
              {/* Header */}
              <div className="flex shrink-0 items-start justify-between border-b border-ber-offwhite px-6 py-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ber-gray/60">{cl.template?.code}</p>
                    {cl.template?.recorrente && <span className="text-[10px] font-bold text-ber-teal">Visita {cl.visitaNumero}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.color}`}>{sc.label}</span>
                  </div>
                  <h2 className="mt-0.5 text-base font-black text-ber-carbon">{cl.template?.name}</h2>
                  <p className="text-xs text-ber-gray">{selectedObra.name} · {checkedCount}/{cl.items.length} itens · {pct}%</p>
                </div>
                <button onClick={() => setActiveCl(null)} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite"><X size={18} /></button>
              </div>

              {/* Progress bar */}
              <div className="h-1 w-full bg-gray-100 shrink-0">
                <div className="h-full bg-ber-teal transition-all" style={{ width: `${pct}%` }} />
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                {/* CL_5: add ambiente */}
                {isCl5 && !isLocked && (
                  <div className="flex gap-2">
                    <input value={newAmbiente} onChange={e => setNewAmbiente(e.target.value)}
                      placeholder="Nome do ambiente (ex: Sala de Reuniões)"
                      className="flex-1 rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:outline-none" />
                    <button disabled={!newAmbiente.trim() || submitting}
                      onClick={() => addAmbiente(cl, newAmbiente.trim())}
                      className="rounded-md bg-ber-carbon px-3 py-1.5 text-xs font-bold text-white hover:bg-ber-black disabled:opacity-50">
                      + Ambiente
                    </button>
                  </div>
                )}

                {/* Sections */}
                {Object.entries(grouped).map(([secao, items]) => (
                  <div key={secao}>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-ber-gray">{secao}</p>
                    <div className="space-y-2">
                      {items.map(item => (
                        <div key={item.id} className={`rounded-lg border p-3 transition-colors ${item.checked ? 'border-green-200 bg-green-50' : 'border-ber-gray/10 bg-ber-offwhite/40'}`}>
                          <div className="flex items-start gap-3">
                            <input type="checkbox" checked={item.checked} disabled={isLocked || submitting}
                              onChange={() => toggleItem(cl, item.id)}
                              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-green-500 disabled:opacity-40" />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm leading-snug ${item.checked ? 'text-green-700 line-through' : 'text-ber-carbon'}`}>
                                {item.templateItem?.fotoObrigatoria && <span className="mr-1 text-amber-500">📷</span>}
                                {item.templateItem?.descricao}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {item.fotoUrl && (
                                  <a href={item.fotoUrl} target="_blank" rel="noreferrer">
                                    <img src={item.fotoUrl} alt="" className="h-12 w-12 rounded object-cover border border-ber-gray/15 hover:opacity-80" />
                                  </a>
                                )}
                                {!isLocked && (
                                  <label className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors ${
                                    item.templateItem?.fotoObrigatoria
                                      ? item.fotoUrl ? 'border-green-300 text-green-600' : 'border-amber-300 text-amber-600 hover:bg-amber-50'
                                      : 'border-ber-gray/20 text-ber-gray/60 hover:bg-ber-offwhite'
                                  }`}>
                                    <Camera size={11} />
                                    {item.fotoUrl ? 'Trocar' : item.templateItem?.fotoObrigatoria ? 'Foto obrigatória' : '+ Foto'}
                                    <input type="file" accept="image/*" capture="environment" className="hidden"
                                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(cl, item.id, f); }} />
                                  </label>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-ber-offwhite px-6 py-4 flex justify-end gap-3">
                <button onClick={() => setActiveCl(null)} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Fechar</button>
                {!isLocked && (
                  <button disabled={submitting} onClick={() => submitChecklist(cl)}
                    className="rounded-md bg-green-500 px-5 py-2 text-sm font-bold text-white hover:bg-green-600 disabled:opacity-50">
                    ✅ Concluir Checklist
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
