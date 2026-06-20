'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, FileText, CheckCircle2, XCircle, Clock, Trash2, X, Paperclip, Upload, Pencil } from 'lucide-react';
import api from '@/lib/api';

const STATUS_META: Record<string, { label: string; color: string }> = {
  em_analise: { label: 'Em análise', color: 'bg-amber-100 text-amber-700' },
  aprovado:   { label: 'Aprovado',   color: 'bg-green-100 text-green-700' },
  reprovado:  { label: 'Reprovado',  color: 'bg-red-100 text-red-700' },
  pendente:   { label: 'Pendente',   color: 'bg-gray-200 text-gray-700' },
};

const TIPOS = ['projeto', 'memorial', 'contrato', 'as_built', 'certificado', 'proposta', 'outros'] as const;

interface Documento {
  id: string;
  tipo: string;
  nome: string;
  revisao: string | null;
  emitidoPor: string | null;
  dataEmissao: string | null;
  status: keyof typeof STATUS_META;
  aprovadoEm: string | null;
  aprovadoPor: { id: string; name: string } | null;
  observacoes: string | null;
}

interface Attachment { id: string; fileName: string; fileUrl: string }

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

export default function DocumentosPage() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;
  const [obraName, setObraName] = useState('');
  const [docs, setDocs] = useState<Documento[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<Documento | true | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [attsBy, setAttsBy] = useState<Record<string, Attachment[]>>({});

  async function fetchAll() {
    setLoading(true);
    try {
      const [list, obraRes] = await Promise.all([
        api.get<{ data: { documentos: Documento[]; totals: { byStatus: Record<string, number> } } }>(`/obras/${obraId}/documentos`),
        api.get(`/obras/${obraId}`),
      ]);
      setDocs(list.data.data.documentos);
      setTotals(list.data.data.totals.byStatus);
      setObraName(obraRes.data.data.name);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchAll(); }, [obraId]);

  async function fetchAtts(id: string) {
    try {
      const r = await api.get<{ data: Attachment[] }>('/attachments', { params: { entityType: 'documento', entityId: id } });
      setAttsBy(prev => ({ ...prev, [id]: r.data.data }));
    } catch { /* silent */ }
  }

  function toggleExpand(id: string) {
    if (expanded === id) setExpanded(null);
    else { setExpanded(id); if (!attsBy[id]) fetchAtts(id); }
  }

  async function updateStatus(id: string, status: string) {
    try { await api.patch(`/documentos/${id}`, { status }); fetchAll(); }
    catch (err) { alert(errMsg(err, 'Erro ao atualizar')); }
  }

  async function deleteDoc(id: string) {
    if (!confirm('Excluir este documento? Os anexos também serão removidos.')) return;
    try { await api.delete(`/documentos/${id}`); fetchAll(); }
    catch (err) { alert(errMsg(err, 'Erro ao excluir')); }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> {obraName || 'Obra'}
        </Link>
        <span>/</span><span className="text-ber-carbon font-medium">Documentos</span>
      </div>

      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-ber-teal" />
          <h1 className="text-xl font-black text-ber-carbon">Documentos & Aprovações</h1>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-2 text-sm font-medium text-white hover:bg-ber-black">
          <Plus size={14} /> Novo documento
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(STATUS_META).map(([k, m]) => (
          <div key={k} className="rounded-xl bg-white border border-ber-gray/15 p-3 shadow-sm">
            <p className="text-[10px] font-medium text-ber-gray uppercase tracking-wide">{m.label}</p>
            <p className="mt-1 text-xl font-bold text-ber-carbon">{totals[k] ?? 0}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center text-sm text-ber-gray">Carregando…</div>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center">
          <FileText size={28} className="mx-auto mb-2 text-ber-gray/40" />
          <p className="text-sm font-medium text-ber-gray">Nenhum documento cadastrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ber-gray/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-ber-carbon text-xs text-white">
              <tr>
                <th className="px-3 py-3 text-left w-28">Tipo</th>
                <th className="px-3 py-3 text-left">Nome</th>
                <th className="px-3 py-3 text-center w-16">Rev.</th>
                <th className="px-3 py-3 text-left w-40">Emitido por</th>
                <th className="px-3 py-3 text-center w-24">Emissão</th>
                <th className="px-3 py-3 text-center w-32">Status</th>
                <th className="px-3 py-3 text-center w-32">Aprovação</th>
                <th className="px-3 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map(d => {
                const meta = STATUS_META[d.status] || STATUS_META.em_analise;
                const isExp = expanded === d.id;
                return (
                  <>
                    <tr key={d.id} className="border-t border-ber-gray/10 hover:bg-ber-bg/40 cursor-pointer" onClick={() => toggleExpand(d.id)}>
                      <td className="px-3 py-2.5 text-xs capitalize text-ber-gray">{d.tipo.replace('_', ' ')}</td>
                      <td className="px-3 py-2.5 font-medium text-ber-carbon">{d.nome}</td>
                      <td className="px-3 py-2.5 text-center text-xs">{d.revisao || '—'}</td>
                      <td className="px-3 py-2.5 text-xs">{d.emitidoPor || '—'}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-ber-gray">{fmtDate(d.dataEmissao)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <select value={d.status} onClick={e => e.stopPropagation()} onChange={e => updateStatus(d.id, e.target.value)}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium border-0 focus:outline-none focus:ring-1 focus:ring-ber-teal ${meta.color}`}>
                          {Object.entries(STATUS_META).map(([k, m]) => (<option key={k} value={k}>{m.label}</option>))}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-ber-gray">
                        {d.aprovadoEm ? <>{fmtDate(d.aprovadoEm)}{d.aprovadoPor && <div className="text-[10px] opacity-70">{d.aprovadoPor.name}</div>}</> : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setShowForm(d)} title="Editar" className="rounded p-1 text-ber-gray hover:bg-ber-bg hover:text-ber-carbon"><Pencil size={14} /></button>
                          <button onClick={() => deleteDoc(d.id)} title="Excluir" className="rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                    {isExp && (
                      <tr className="bg-ber-bg/30 border-t border-ber-gray/10">
                        <td colSpan={8} className="px-4 py-3">
                          {d.observacoes && <p className="mb-3 text-xs text-ber-gray italic">{d.observacoes}</p>}
                          <AttachmentsPanel entityType="documento" entityId={d.id} attachments={attsBy[d.id] || []} onRefresh={() => fetchAtts(d.id)} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm !== null && (
        <DocForm obraId={obraId} edit={showForm === true ? null : showForm} onClose={() => setShowForm(null)} onSaved={() => { setShowForm(null); fetchAll(); }} />
      )}
    </div>
  );
}

function DocForm({ obraId, edit, onClose, onSaved }: { obraId: string; edit: Documento | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    tipo: edit?.tipo || 'projeto',
    nome: edit?.nome || '',
    revisao: edit?.revisao || '',
    emitidoPor: edit?.emitidoPor || '',
    dataEmissao: edit?.dataEmissao ? edit.dataEmissao.slice(0, 10) : '',
    observacoes: edit?.observacoes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome.trim() || !f.tipo) { setError('Preencha nome e tipo.'); return; }
    setSaving(true);
    try {
      const body = {
        tipo: f.tipo,
        nome: f.nome.trim(),
        revisao: f.revisao.trim() || null,
        emitidoPor: f.emitidoPor.trim() || null,
        dataEmissao: f.dataEmissao || null,
        observacoes: f.observacoes.trim() || null,
      };
      if (edit) await api.patch(`/documentos/${edit.id}`, body);
      else await api.post(`/obras/${obraId}/documentos`, body);
      onSaved();
    } catch (err) { setError(errMsg(err, 'Erro ao salvar')); }
    finally { setSaving(false); }
  }

  return (
    <FormShell title={edit ? 'Editar Documento' : 'Novo Documento'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Tipo *">
            <select value={f.tipo} onChange={e => setF(p => ({ ...p, tipo: e.target.value }))} className={inputCls}>
              {TIPOS.map(t => <option key={t} value={t} className="capitalize">{t.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Revisão"><input value={f.revisao} onChange={e => setF(p => ({ ...p, revisao: e.target.value }))} placeholder="Ex: R02" className={inputCls} /></Field>
        </div>
        <Field label="Nome *"><input value={f.nome} onChange={e => setF(p => ({ ...p, nome: e.target.value }))} className={inputCls} required /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Emitido por"><input value={f.emitidoPor} onChange={e => setF(p => ({ ...p, emitidoPor: e.target.value }))} className={inputCls} placeholder="Escritório, fornecedor…" /></Field>
          <Field label="Data de emissão"><input type="date" value={f.dataEmissao} onChange={e => setF(p => ({ ...p, dataEmissao: e.target.value }))} className={inputCls} /></Field>
        </div>
        <Field label="Observações"><textarea rows={2} value={f.observacoes} onChange={e => setF(p => ({ ...p, observacoes: e.target.value }))} className={inputCls} /></Field>
        <FormActions onClose={onClose} saving={saving} />
      </form>
    </FormShell>
  );
}

function AttachmentsPanel({ entityType, entityId, attachments, onRefresh }: { entityType: string; entityId: string; attachments: Attachment[]; onRefresh: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('entityType', entityType); fd.append('entityId', entityId); fd.append('file', file);
      await api.post('/attachments', fd); onRefresh();
    } catch (err) { alert(errMsg(err, 'Erro ao subir anexo')); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  async function handleDelete(id: string) {
    if (!confirm('Remover este anexo?')) return;
    try { await api.delete(`/attachments/${id}`); onRefresh(); } catch { /* silent */ }
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-ber-carbon uppercase tracking-wide flex items-center gap-1"><Paperclip size={12} /> Anexos ({attachments.length})</p>
        <label className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-ber-gray/30 px-2.5 py-1 text-xs font-medium text-ber-carbon hover:bg-white">
          <Upload size={12} /> {uploading ? 'Enviando…' : 'Enviar arquivo'}
          <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} disabled={uploading} />
        </label>
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-ber-gray italic">Anexa o arquivo do documento (PDF, DWG, doc, etc).</p>
      ) : (
        <ul className="space-y-1">
          {attachments.map(att => (
            <li key={att.id} className="flex items-center justify-between text-xs bg-white rounded border border-ber-gray/15 px-2 py-1">
              <a href={att.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-ber-teal hover:underline truncate">
                <Paperclip size={11} /> {att.fileName}
              </a>
              <button onClick={() => handleDelete(att.id)} className="text-ber-gray hover:text-red-600"><Trash2 size={11} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const inputCls = 'mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-ber-gray uppercase tracking-wide">{label}</label>{children}</div>;
}
function FormShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-t-2xl md:rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
          <h2 className="text-lg font-black text-ber-carbon">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite hover:text-ber-carbon"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
function FormActions({ onClose, saving }: { onClose: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
      <button type="submit" disabled={saving} className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar'}</button>
    </div>
  );
}
