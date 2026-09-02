'use client';

/**
 * Durante a Obra · Controle de Documentos (31/08/26).
 * Substitui os controles em planilha (colunas fixas REV/DATA + campo
 * "última atualização" solto que desincroniza). Revisão é histórico
 * normalizado — 1 linha por revisão, ilimitado, arquivo por versão; a
 * última revisão é sempre calculada, nunca digitada à parte.
 */

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Trash2, Pencil, ChevronDown, ChevronUp, Download, Upload, UploadCloud } from 'lucide-react';
import api from '@/lib/api';
import { confirmar } from '@/lib/confirmar';

const DISCIPLINAS = [
  'Arquitetura', 'Estrutural', 'Instalações Elétricas', 'Hidráulica', 'Ar Condicionado',
  'Combate a Incêndio', 'Detecção e Alarme', 'Cabeamento Estruturado', 'Comunicação Visual',
  'Interiores', 'Paisagismo', 'Projeto Legal', 'Outra',
] as const;

const ETAPAS = ['Conceito', 'Anteprojeto (AP)', 'Executivo (EX)', 'Locação (LO)', 'As Built'] as const;

interface Revisao {
  id: string;
  revisao: string;
  data: string;
  arquivoUrl: string | null;
  arquivoNome: string | null;
  observacao: string | null;
}

interface Documento {
  id: string;
  codigo: string;
  titulo: string | null;
  disciplina: string;
  projetista: string | null;
  etapa: string | null;
  revisoes: Revisao[];
}

function fmtBR(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function ultimaRevisao(d: Documento): Revisao | null {
  if (d.revisoes.length === 0) return null;
  return [...d.revisoes].sort((a, b) => b.data.localeCompare(a.data))[0];
}

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function emptyDocForm() {
  return { codigo: '', titulo: '', disciplina: DISCIPLINAS[0] as string, projetista: '', etapa: '' };
}

export default function ControleDocumentosPage() {
  const { id: obraId } = useParams<{ id: string }>();
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Documento | null>(null);
  const [form, setForm] = useState(emptyDocForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revForms, setRevForms] = useState<Record<string, { revisao: string; data: string; observacao: string; file: File | null }>>({});
  const [savingRev, setSavingRev] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [dragOver, setDragOver] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ criados: number; atualizados: number } | null>(null);
  const bulkInput = useRef<HTMLInputElement | null>(null);

  const inputCls = 'w-full text-sm px-3 py-2 border border-ber-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ber-teal bg-white';

  async function load() {
    setLoading(true);
    try {
      const r = await api.get(`/obras/${obraId}/controle-documentos`);
      setDocumentos(r.data.data ?? []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [obraId]);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openCreate() {
    setEditando(null);
    setForm(emptyDocForm());
    setError('');
    setShowForm(true);
  }

  function openEdit(d: Documento) {
    setEditando(d);
    setForm({ codigo: d.codigo, titulo: d.titulo ?? '', disciplina: d.disciplina, projetista: d.projetista ?? '', etapa: d.etapa ?? '' });
    setError('');
    setShowForm(true);
  }

  async function saveDoc() {
    if (!form.codigo.trim()) { setError('Informe o código'); return; }
    setSaving(true);
    setError('');
    const payload = {
      codigo: form.codigo,
      titulo: form.titulo || null,
      disciplina: form.disciplina,
      projetista: form.projetista || null,
      etapa: form.etapa || null,
    };
    try {
      if (editando) {
        const r = await api.patch(`/obras/${obraId}/controle-documentos/${editando.id}`, payload);
        setDocumentos(prev => prev.map(d => d.id === editando.id ? r.data.data : d));
      } else {
        const r = await api.post(`/obras/${obraId}/controle-documentos`, payload);
        setDocumentos(prev => [...prev, r.data.data]);
      }
      setShowForm(false);
    } catch (e) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(m || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function updateField(id: string, field: 'codigo' | 'disciplina' | 'etapa' | 'projetista', value: string) {
    try {
      const r = await api.patch(`/obras/${obraId}/controle-documentos/${id}`, { [field]: field === 'etapa' || field === 'projetista' ? (value || null) : value });
      setDocumentos(prev => prev.map(d => d.id === id ? r.data.data : d));
    } catch (e) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      alert(m || 'Erro ao salvar');
      load();
    }
  }

  async function handleBulkFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setBulkUploading(true);
    setBulkResult(null);
    try {
      const fd = new FormData();
      arr.forEach(f => fd.append('files', f));
      const r = await api.post(`/obras/${obraId}/controle-documentos/bulk-upload`, fd);
      setDocumentos(r.data.data.documentos);
      setBulkResult({ criados: r.data.data.criados.length, atualizados: r.data.data.atualizados.length });
    } catch (e) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      alert(m || 'Erro ao subir arquivos');
    } finally {
      setBulkUploading(false);
    }
  }

  async function handleRemoveDoc(id: string) {
    if (!(await confirmar('Excluir este documento e todo o histórico de revisões dele?', { confirmarLabel: 'Excluir' }))) return;
    try {
      await api.delete(`/obras/${obraId}/controle-documentos/${id}`);
      setDocumentos(prev => prev.filter(d => d.id !== id));
    } catch {
      alert('Erro ao excluir');
    }
  }

  async function openNovaRevisao(d: Documento) {
    toggleExpand(d.id);
    if (revForms[d.id]) return;
    let sugestao = '';
    try {
      const r = await api.get(`/obras/${obraId}/controle-documentos/${d.id}/proxima-revisao`);
      sugestao = r.data.data.sugestao;
    } catch {}
    setRevForms(prev => ({ ...prev, [d.id]: { revisao: sugestao, data: new Date().toISOString().slice(0, 10), observacao: '', file: null } }));
  }

  async function saveRevisao(docId: string) {
    const f = revForms[docId];
    if (!f || !f.revisao.trim() || !f.data) { alert('Preencha revisão e data'); return; }
    setSavingRev(docId);
    try {
      const fd = new FormData();
      fd.append('revisao', f.revisao);
      fd.append('data', f.data);
      if (f.observacao) fd.append('observacao', f.observacao);
      if (f.file) fd.append('file', f.file);
      const r = await api.post(`/obras/${obraId}/controle-documentos/${docId}/revisoes`, fd);
      setDocumentos(prev => prev.map(d => d.id === docId ? r.data.data : d));
      setRevForms(prev => { const next = { ...prev }; delete next[docId]; return next; });
    } catch (e) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      alert(m || 'Erro ao salvar revisão');
    } finally {
      setSavingRev(null);
    }
  }

  async function handleRemoveRevisao(docId: string, revisaoId: string) {
    if (!(await confirmar('Excluir esta revisão?', { confirmarLabel: 'Excluir' }))) return;
    try {
      await api.delete(`/obras/${obraId}/controle-documentos/${docId}/revisoes/${revisaoId}`);
      setDocumentos(prev => prev.map(d => d.id === docId ? { ...d, revisoes: d.revisoes.filter(r => r.id !== revisaoId) } : d));
    } catch {
      alert('Erro ao excluir revisão');
    }
  }

  const grupos = DISCIPLINAS
    .map(disc => ({ disc, docs: documentos.filter(d => d.disciplina === disc) }))
    .filter(g => g.docs.length > 0);

  return (
    <div className="w-full max-w-[1200px] pb-24">
      <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon mb-4">
        <ArrowLeft size={16} /> Voltar à obra
      </Link>

      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="text-xl font-semibold text-ber-carbon">Controle de Documentos</h1>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 text-sm font-semibold bg-ber-carbon text-white rounded-lg px-3.5 py-2 hover:opacity-90">
          <Plus size={16} /> Novo documento
        </button>
      </div>

      <input ref={bulkInput} type="file" multiple className="hidden"
        onChange={e => { if (e.target.files) handleBulkFiles(e.target.files); e.target.value = ''; }} />
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) handleBulkFiles(e.dataTransfer.files); }}
        onClick={() => bulkInput.current?.click()}
        className={`mb-5 cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          dragOver ? 'border-ber-teal bg-ber-teal/5' : 'border-ber-border bg-white hover:border-ber-carbon/40'
        }`}
      >
        {bulkUploading ? (
          <p className="text-sm text-ber-gray">Subindo arquivos…</p>
        ) : (
          <div className="flex flex-col items-center gap-1 text-ber-gray">
            <UploadCloud size={22} />
            <p className="text-sm">Arraste arquivos aqui pra criar/atualizar documentos em massa (ou clique pra escolher) — PDF, DWG, planilha, imagem, qualquer tipo</p>
            <p className="text-[11px]">Código e revisão detectados do nome do arquivo quando possível — corrige depois na lista</p>
          </div>
        )}
        {bulkResult && !bulkUploading && (
          <p className="mt-2 text-xs font-semibold text-ber-teal">
            {bulkResult.criados} documento(s) novo(s) · {bulkResult.atualizados} revisão(ões) adicionada(s) a documentos existentes
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-ber-gray">Carregando…</p>
      ) : documentos.length === 0 ? (
        <div className="bg-white border border-ber-border rounded-xl p-8 text-center text-sm text-ber-gray">
          Nenhum documento cadastrado ainda nesta obra.
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map(({ disc, docs }) => (
            <div key={disc}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ber-teal mb-2">{disc} ({docs.length})</p>
              <div className="space-y-2">
                {docs.map(d => {
                  const ult = ultimaRevisao(d);
                  const isExpanded = expanded.has(d.id);
                  const parado = ult && diasDesde(ult.data) > 90;
                  return (
                    <div key={d.id} className="bg-white border border-ber-border rounded-xl overflow-hidden">
                      <div className="p-3 flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggleExpand(d.id)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              defaultValue={d.codigo}
                              onClick={e => e.stopPropagation()}
                              onBlur={e => { if (e.target.value.trim() && e.target.value !== d.codigo) updateField(d.id, 'codigo', e.target.value.trim()); }}
                              className="font-semibold text-ber-carbon text-sm bg-transparent border-b border-transparent hover:border-ber-border focus:border-ber-teal focus:outline-none px-0.5 -mx-0.5"
                              style={{ width: `${Math.max(d.codigo.length, 8)}ch` }}
                            />
                            {ult && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${parado ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                {ult.revisao} · {fmtBR(ult.data)}{parado ? ' · parado' : ''}
                              </span>
                            )}
                            {!ult && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">sem revisão</span>}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
                            <select value={d.disciplina} onChange={e => updateField(d.id, 'disciplina', e.target.value)}
                              className="text-[11px] bg-transparent border border-ber-border rounded px-1.5 py-0.5 text-ber-carbon hover:border-ber-carbon/50 focus:outline-none focus:ring-1 focus:ring-ber-teal">
                              {DISCIPLINAS.map(disc2 => <option key={disc2} value={disc2}>{disc2}</option>)}
                            </select>
                            <select value={d.etapa ?? ''} onChange={e => updateField(d.id, 'etapa', e.target.value)}
                              className="text-[11px] bg-transparent border border-ber-border rounded px-1.5 py-0.5 text-ber-carbon hover:border-ber-carbon/50 focus:outline-none focus:ring-1 focus:ring-ber-teal">
                              <option value="">Etapa —</option>
                              {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                            <input
                              defaultValue={d.projetista ?? ''}
                              placeholder="Projetista"
                              onBlur={e => { if (e.target.value !== (d.projetista ?? '')) updateField(d.id, 'projetista', e.target.value.trim()); }}
                              className="text-[11px] bg-transparent border border-ber-border rounded px-1.5 py-0.5 text-ber-carbon hover:border-ber-carbon/50 focus:outline-none focus:ring-1 focus:ring-ber-teal w-24"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => openEdit(d)} className="text-ber-gray hover:text-ber-carbon" title="Editar título"><Pencil size={14} /></button>
                          <button onClick={() => handleRemoveDoc(d.id)} className="text-ber-gray/40 hover:text-red-500"><Trash2 size={14} /></button>
                          <button onClick={() => toggleExpand(d.id)} className="text-ber-gray hover:text-ber-carbon">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-ber-border bg-ber-surface p-3">
                          {d.revisoes.length > 0 && (
                            <table className="w-full text-xs mb-3">
                              <thead>
                                <tr className="text-ber-gray text-left">
                                  <th className="pb-1.5 font-medium">Revisão</th>
                                  <th className="pb-1.5 font-medium">Data</th>
                                  <th className="pb-1.5 font-medium">Arquivo</th>
                                  <th className="pb-1.5 font-medium">Observação</th>
                                  <th></th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...d.revisoes].sort((a, b) => b.data.localeCompare(a.data)).map(r => (
                                  <tr key={r.id} className="border-t border-ber-border/60">
                                    <td className="py-1.5 font-semibold text-ber-carbon">{r.revisao}</td>
                                    <td className="py-1.5 text-ber-carbon">{fmtBR(r.data)}</td>
                                    <td className="py-1.5">
                                      {r.arquivoUrl ? (
                                        <a href={r.arquivoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ber-teal hover:text-ber-carbon">
                                          <Download size={12} /> {r.arquivoNome?.slice(0, 24) ?? 'baixar'}
                                        </a>
                                      ) : <span className="text-ber-gray">—</span>}
                                    </td>
                                    <td className="py-1.5 text-ber-gray">{r.observacao ?? '—'}</td>
                                    <td className="py-1.5 text-right">
                                      <button onClick={() => handleRemoveRevisao(d.id, r.id)} className="text-ber-gray/40 hover:text-red-500"><Trash2 size={12} /></button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}

                          {revForms[d.id] ? (
                            <div className="flex items-end gap-2 flex-wrap bg-white border border-ber-border rounded-lg p-2.5">
                              <div>
                                <label className="block text-[10px] text-ber-gray mb-0.5">Revisão</label>
                                <input className="text-sm px-2 py-1.5 border border-ber-border rounded-lg w-20" value={revForms[d.id].revisao}
                                  onChange={e => setRevForms(prev => ({ ...prev, [d.id]: { ...prev[d.id], revisao: e.target.value } }))} />
                              </div>
                              <div>
                                <label className="block text-[10px] text-ber-gray mb-0.5">Data</label>
                                <input type="date" className="text-sm px-2 py-1.5 border border-ber-border rounded-lg" value={revForms[d.id].data}
                                  onChange={e => setRevForms(prev => ({ ...prev, [d.id]: { ...prev[d.id], data: e.target.value } }))} />
                              </div>
                              <div className="flex-1 min-w-[120px]">
                                <label className="block text-[10px] text-ber-gray mb-0.5">Observação</label>
                                <input className="text-sm px-2 py-1.5 border border-ber-border rounded-lg w-full" value={revForms[d.id].observacao}
                                  onChange={e => setRevForms(prev => ({ ...prev, [d.id]: { ...prev[d.id], observacao: e.target.value } }))} />
                              </div>
                              <input ref={el => { fileInputs.current[d.id] = el; }} type="file" className="hidden"
                                onChange={e => { const file = e.target.files?.[0] ?? null; setRevForms(prev => ({ ...prev, [d.id]: { ...prev[d.id], file } })); }} />
                              <button type="button" onClick={() => fileInputs.current[d.id]?.click()}
                                className="flex items-center gap-1 text-xs text-ber-teal hover:text-ber-carbon px-2 py-1.5">
                                <Upload size={13} /> {revForms[d.id].file ? revForms[d.id].file!.name.slice(0, 16) : 'Arquivo'}
                              </button>
                              <button onClick={() => setRevForms(prev => { const n = { ...prev }; delete n[d.id]; return n; })}
                                className="text-xs text-ber-gray px-2 py-1.5 hover:text-ber-carbon">Cancelar</button>
                              <button onClick={() => saveRevisao(d.id)} disabled={savingRev === d.id}
                                className="text-xs font-semibold bg-ber-carbon text-white rounded-lg px-3 py-1.5 hover:opacity-90 disabled:opacity-50">
                                {savingRev === d.id ? 'Salvando…' : 'Salvar revisão'}
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => openNovaRevisao(d)} className="flex items-center gap-1.5 text-xs font-semibold text-ber-teal hover:text-ber-carbon">
                              <Plus size={13} /> Nova revisão
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold text-ber-carbon">{editando ? 'Editar documento' : 'Novo documento'}</p>
              <button onClick={() => setShowForm(false)} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ber-carbon">Código *</label>
                <input className={inputCls} value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="ex: 319-EDW-CV-CD" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ber-carbon">Título</label>
                <input className={inputCls} value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="ex: Planta de Piso" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ber-carbon">Disciplina</label>
                  <select className={inputCls} value={form.disciplina} onChange={e => setForm(f => ({ ...f, disciplina: e.target.value }))}>
                    {DISCIPLINAS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ber-carbon">Etapa</label>
                  <select className={inputCls} value={form.etapa} onChange={e => setForm(f => ({ ...f, etapa: e.target.value }))}>
                    <option value="">—</option>
                    {ETAPAS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ber-carbon">Projetista</label>
                <input className={inputCls} value={form.projetista} onChange={e => setForm(f => ({ ...f, projetista: e.target.value }))} />
              </div>
            </div>
            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-ber-border py-2 text-sm text-ber-gray hover:bg-ber-surface">Cancelar</button>
              <button onClick={saveDoc} disabled={saving} className="flex-1 rounded-lg bg-ber-carbon py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
