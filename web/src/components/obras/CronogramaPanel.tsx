'use client';

/**
 * CronogramaPanel — componente reutilizável de cronograma da obra.
 *
 * Self-contained: faz seu próprio fetch, gerencia estado, e renderiza
 * upload + viewer PDF + tabela de tarefas com expand/collapse + edição
 * inline de % e observação + botão "Sincronizar Kanban".
 *
 * Usado em:
 *  - Gestão 360 → aba "Cronograma & MO"
 *  - (legado) obra detail → tab "Cronograma" (vai ser desativada)
 */

import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import api from '@/lib/api';

interface CronogramaOverride {
  pct?: number;
  inicioRealizado?: string | null;
  fimRealizado?: string | null;
  observacao?: string;
}

interface ParsedTask {
  wbs: string; nome: string;
  inicio: string | null; fim: string | null;
  duracaoDias: number | null;
  percentualConcluido: number;
  ehResumo: boolean; nivel: number;
}

interface Cronograma {
  id: string; fileUrl: string; fileName: string;
  parsedAt: string | null;
  parsedData: { progressoGeral: number; tarefas: ParsedTask[] } | null;
  overrides: Record<string, CronogramaOverride> | null;
  progressPct: number | null;
}

export default function CronogramaPanel({ obraId }: { obraId: string }) {
  const [cronograma, setCronograma] = useState<Cronograma | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ created: number; updated: number; progressoGeral: number } | null>(null);
  const [reparsing, setReparsing] = useState(false);
  const [reparseResult, setReparseResult] = useState<{ numTarefas: number; progressPct: number } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/obras/${obraId}/cronograma`)
      .then(r => setCronograma(r.data.data))
      .catch(() => setCronograma(null))
      .finally(() => setLoading(false));
  }, [obraId]);

  async function handleUpload(file: File) {
    setUploading(true); setSyncResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const r = await api.post(`/obras/${obraId}/cronograma/upload`, form);
      setCronograma(r.data.data);
    } catch (err) {
      alert(((err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error as { message?: string } | string | undefined)?.toString() ?? 'Erro ao enviar PDF');
    } finally { setUploading(false); }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const r = await api.post(`/obras/${obraId}/cronograma/sync`);
      setSyncResult(r.data.data);
    } catch (err) {
      alert(((err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error as { message?: string } | string | undefined)?.toString() ?? 'Erro ao sincronizar');
    } finally { setSyncing(false); }
  }

  async function handleReparse() {
    if (!confirm('Reprocessar extrai as tarefas do PDF atual via IA. Pode levar 30-60s. Continuar?')) return;
    setReparsing(true); setReparseResult(null); setSyncResult(null);
    try {
      const r = await api.post<{ data: { numTarefas: number; progressPct: number } }>(`/obras/${obraId}/cronograma/parse`);
      setReparseResult(r.data.data);
      const cr = await api.get(`/obras/${obraId}/cronograma`);
      setCronograma(cr.data.data);
    } catch (err) {
      const resp = (err as { response?: { status?: number; data?: unknown }; message?: string });
      const data = resp?.response?.data as { error?: { message?: string; code?: string } | string } | undefined;
      const msg = typeof data?.error === 'string'
        ? data.error
        : data?.error?.message
        ?? (data ? JSON.stringify(data) : null)
        ?? resp?.message
        ?? 'Erro ao reprocessar';
      console.error('[reparse] erro:', err);
      alert(`Erro ao reprocessar (HTTP ${resp?.response?.status ?? '?'}):\n${msg}`);
    } finally { setReparsing(false); }
  }

  async function patchOverride(ref: string, patch: Record<string, unknown>) {
    try {
      const r = await api.patch(`/obras/${obraId}/cronograma/tasks/${encodeURIComponent(ref)}`, patch);
      setCronograma(prev => prev ? { ...prev, overrides: r.data.data.overrides ?? {}, progressPct: r.data.data.progressPct } : prev);
    } catch { /* silent */ }
  }

  function toggleCollapse(wbs: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(wbs) ? next.delete(wbs) : next.add(wbs);
      return next;
    });
  }

  function isHidden(wbs: string): boolean {
    if (!wbs) return false;
    const parts = wbs.split('.');
    for (let i = 1; i < parts.length; i++) {
      if (collapsed.has(parts.slice(0, i).join('.'))) return true;
    }
    return false;
  }

  if (loading) return <p className="py-8 text-center text-sm text-ber-gray">Carregando cronograma…</p>;

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const taskStatus = (t: ParsedTask, pct: number) => {
    if (pct >= 100) return { label: 'Concluído', cls: 'bg-green-100 text-green-700' };
    const fim = t.fim ? new Date(t.fim) : null;
    const ini = t.inicio ? new Date(t.inicio) : null;
    if (fim && fim < today) return { label: 'Atrasado', cls: 'bg-red-100 text-red-700' };
    if (ini && ini <= today) return { label: 'Em andamento', cls: 'bg-blue-100 text-blue-700' };
    return { label: 'Previsto', cls: 'bg-gray-100 text-gray-500' };
  };
  const hasChildren = (wbs: string) =>
    !!cronograma?.parsedData?.tarefas.some(t => t.wbs !== wbs && t.wbs.startsWith(wbs + '.'));

  const overrides = cronograma?.overrides ?? {};
  const tarefasLeaf = cronograma?.parsedData?.tarefas.filter(t => !t.ehResumo && (t.duracaoDias ?? 0) > 0) ?? [];
  const totalDias = tarefasLeaf.reduce((s, t) => s + (t.duracaoDias ?? 0), 0);
  const completedDias = tarefasLeaf.reduce((s, t) => {
    const key = t.wbs || t.nome;
    const ov = overrides[key];
    const pct = ov?.pct !== undefined ? ov.pct : t.percentualConcluido;
    return s + (t.duracaoDias ?? 0) * pct / 100;
  }, 0);
  const progressGeral = totalDias > 0 ? Math.round(completedDias / totalDias * 100) : (cronograma?.progressPct ?? 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-ber-gray">Cronograma da Obra</h3>
        <div className="flex gap-2">
          {cronograma && (
            <button onClick={handleReparse} disabled={reparsing || uploading}
              className="flex items-center gap-1.5 rounded-md bg-ber-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-ber-teal/90 disabled:opacity-50"
              title="Roda o parser IA no PDF atual e atualiza as tarefas">
              {reparsing ? 'Reprocessando…' : '🔁 Reprocessar PDF'}
            </button>
          )}
          {cronograma?.parsedData && (
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-1.5 rounded-md bg-ber-olive px-3 py-1.5 text-sm font-medium text-white hover:bg-ber-olive/90 disabled:opacity-50">
              {syncing ? 'Sincronizando…' : '↻ Sincronizar Kanban'}
            </button>
          )}
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm font-medium text-ber-carbon hover:bg-white disabled:opacity-50">
            <Upload size={13} />
            {uploading ? 'Enviando…' : cronograma ? 'Substituir PDF' : 'Upload PDF'}
          </button>
          <input ref={inputRef} type="file" accept=".pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
        </div>
      </div>

      {syncResult && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✅ Kanban atualizado: <strong>{syncResult.created}</strong> criadas, <strong>{syncResult.updated}</strong> atualizadas · Progresso geral: <strong>{syncResult.progressoGeral}%</strong>
        </div>
      )}

      {reparseResult && (
        <div className="mb-4 rounded-lg border border-ber-teal/30 bg-ber-teal/5 px-4 py-3 text-sm text-ber-carbon">
          ✅ Cronograma reprocessado: <strong>{reparseResult.numTarefas}</strong> tarefas extraídas · Progresso geral: <strong>{reparseResult.progressPct}%</strong>
        </div>
      )}

      {!cronograma ? (
        <div onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed border-ber-gray/20 py-16 text-center hover:border-ber-teal hover:bg-ber-teal/5 transition-colors">
          <Upload size={28} className="mx-auto mb-3 text-ber-gray/40" />
          <p className="text-sm font-medium text-ber-gray">Clique para enviar o cronograma em PDF</p>
          <p className="mt-1 text-xs text-ber-gray/60">MS Project, Primavera, Excel impresso — qualquer formato</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* PDF viewer */}
          <div className="rounded-lg border border-ber-gray/15 overflow-hidden">
            <div className="flex items-center justify-between bg-ber-bg/40 px-4 py-2 border-b border-ber-gray/15">
              <span className="text-xs font-medium text-ber-gray truncate">{cronograma.fileName}</span>
              <a href={cronograma.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-ber-teal hover:underline shrink-0 ml-2">Abrir ↗</a>
            </div>
            <iframe src={cronograma.fileUrl} className="w-full h-[50vh]" title="Cronograma PDF" />
          </div>

          {/* Tabela de tarefas */}
          {cronograma.parsedData ? (
            <div>
              <div className="mb-3 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-32 rounded-full bg-gray-200 overflow-hidden">
                    <div className="h-2 rounded-full bg-ber-olive transition-all" style={{ width: `${progressGeral}%` }} />
                  </div>
                  <span className="text-sm font-bold text-ber-carbon">{progressGeral}% concluído</span>
                </div>
                <span className="text-xs text-ber-gray">
                  {tarefasLeaf.length} tarefas · processado {cronograma.parsedAt ? new Date(cronograma.parsedAt).toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>

              <div className="rounded-lg border border-ber-gray/15 overflow-x-auto">
                <table className="w-full text-xs min-w-[900px]">
                  <thead className="bg-ber-carbon text-white">
                    <tr>
                      <th className="px-2 py-2 text-left w-12">WBS</th>
                      <th className="px-3 py-2 text-left">Tarefa</th>
                      <th className="px-2 py-2 text-center w-20">Status</th>
                      <th className="px-2 py-2 text-center w-16">Início Plan.</th>
                      <th className="px-2 py-2 text-center w-16">Fim Plan.</th>
                      <th className="px-2 py-2 text-center w-20 bg-ber-teal/20">Início Real</th>
                      <th className="px-2 py-2 text-center w-20 bg-ber-teal/20">Fim Real</th>
                      <th className="px-2 py-2 text-center w-16 bg-ber-teal/20">%</th>
                      <th className="px-2 py-2 text-left w-28 bg-ber-teal/20">Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cronograma.parsedData.tarefas.map((t, i) => {
                      if (isHidden(t.wbs)) return null;
                      const key = t.wbs || t.nome;
                      const ov = overrides[key] ?? {};
                      const pct = ov.pct !== undefined ? ov.pct : t.percentualConcluido;
                      const pctColor = pct >= 100 ? 'text-green-600 font-bold' : pct >= 50 ? 'text-amber-600 font-semibold' : 'text-ber-gray';
                      const bg = t.ehResumo ? 'bg-ber-carbon/5' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                      const st = !t.ehResumo ? taskStatus(t, pct) : null;
                      const canCollapse = t.ehResumo && hasChildren(t.wbs);
                      const isCollapsed = collapsed.has(t.wbs);
                      return (
                        <tr key={i} className={`${bg} group`}>
                          <td className="px-2 py-1 text-ber-gray/70 tabular-nums text-[10px]">{t.wbs}</td>
                          <td className="px-3 py-1.5 font-medium select-none" style={{ paddingLeft: t.nivel > 1 ? `${t.nivel * 10 + 4}px` : undefined }}>
                            <div className="flex items-center gap-1">
                              {canCollapse && (
                                <button onClick={() => toggleCollapse(t.wbs)}
                                  className="shrink-0 w-4 h-4 flex items-center justify-center text-ber-gray/50 hover:text-ber-carbon">
                                  {isCollapsed ? '▶' : '▼'}
                                </button>
                              )}
                              {!canCollapse && t.ehResumo && <span className="w-4 shrink-0" />}
                              <span>{t.nome}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1 text-center">
                            {st && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>}
                          </td>
                          <td className="px-2 py-1 text-center text-ber-gray tabular-nums">{fmtDate(t.inicio)}</td>
                          <td className="px-2 py-1 text-center text-ber-gray tabular-nums">{fmtDate(t.fim)}</td>
                          {t.ehResumo ? (
                            <><td /><td /><td /><td /></>
                          ) : (
                            <>
                              <td className="px-1 py-0.5">
                                <input key={ov.inicioRealizado ?? ''} type="date" defaultValue={ov.inicioRealizado ?? ''}
                                  onBlur={e => patchOverride(key, { inicioRealizado: e.target.value || null })}
                                  className="w-full bg-transparent text-center text-[10px] hover:ring-1 hover:ring-ber-gray/20 focus:bg-white focus:outline-none focus:ring-1 focus:ring-ber-teal rounded px-0.5 tabular-nums" />
                              </td>
                              <td className="px-1 py-0.5">
                                <input key={ov.fimRealizado ?? ''} type="date" defaultValue={ov.fimRealizado ?? ''}
                                  onBlur={e => patchOverride(key, { fimRealizado: e.target.value || null })}
                                  className="w-full bg-transparent text-center text-[10px] hover:ring-1 hover:ring-ber-gray/20 focus:bg-white focus:outline-none focus:ring-1 focus:ring-ber-teal rounded px-0.5 tabular-nums" />
                              </td>
                              <td className="px-1 py-0.5 relative">
                                <div className="absolute inset-0 rounded" style={{ background: `linear-gradient(90deg, ${pct >= 100 ? '#dcfce7' : pct >= 50 ? '#fef3c7' : '#f3f4f6'} ${pct}%, transparent ${pct}%)` }} />
                                <input key={pct} type="number" min={0} max={100} defaultValue={pct}
                                  onBlur={e => {
                                    const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                                    e.target.value = String(v);
                                    patchOverride(key, { pct: v });
                                  }}
                                  className={`relative w-full bg-transparent text-center font-bold hover:ring-1 hover:ring-ber-teal/40 focus:bg-white focus:outline-none focus:ring-1 focus:ring-ber-teal rounded px-0.5 tabular-nums cursor-text ${pctColor}`} />
                              </td>
                              <td className="px-1 py-0.5">
                                <input key={ov.observacao ?? ''} type="text" defaultValue={ov.observacao ?? ''}
                                  onBlur={e => patchOverride(key, { observacao: e.target.value })}
                                  placeholder="—"
                                  className="w-full bg-transparent text-[10px] hover:ring-1 hover:ring-ber-gray/20 focus:bg-white focus:outline-none focus:ring-1 focus:ring-ber-teal rounded px-1 text-ber-gray placeholder:text-ber-gray/30" />
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-ber-gray/20 py-8 text-center">
              <p className="text-sm text-ber-gray">PDF enviado. <strong>Cadastro manual em desenvolvimento</strong> — em breve você poderá inserir tarefas direto.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
