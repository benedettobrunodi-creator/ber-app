'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useBackToObra } from '@/hooks/useBackToObra';
import Link from 'next/link';
import { ArrowLeft, Plus, FileSearch, Trash2, X, Paperclip, Upload, Pencil, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import AtaFormModal, { type Ata, type UserOption } from '@/components/obras/AtaFormModal';

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

export default function AtasPage() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;
  const backHref = useBackToObra();
  const [obraName, setObraName] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'todas' | 'interna' | 'externa'>('todas');
  const [atas, setAtas] = useState<Ata[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<Ata | true | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [attsByAta, setAttsByAta] = useState<Record<string, Attachment[]>>({});

  async function fetchAll() {
    setLoading(true);
    try {
      const qs = tipoFilter === 'todas' ? '' : `?tipo=${tipoFilter}`;
      const [list, obraRes, usersRes] = await Promise.all([
        api.get<{ data: Ata[] }>(`/obras/${obraId}/atas${qs}`),
        api.get(`/obras/${obraId}`),
        api.get('/users', { params: { limit: 200 } }).catch(() => ({ data: { data: [] } })),
      ]);
      setAtas(list.data.data);
      setObraName(obraRes.data.data.name);
      setUsers(usersRes.data.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, [obraId, tipoFilter]);

  async function fetchAttachments(ataId: string) {
    try {
      const r = await api.get<{ data: Attachment[] }>('/attachments', { params: { entityType: 'ata', entityId: ataId } });
      setAttsByAta(prev => ({ ...prev, [ataId]: r.data.data }));
    } catch { /* silent */ }
  }

  function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      if (!attsByAta[id]) fetchAttachments(id);
    }
  }

  async function deleteAta(id: string) {
    if (!confirm('Excluir esta ata? Pendências vinculadas vão perder o link à ata, mas continuam abertas.')) return;
    try { await api.delete(`/atas/${id}`); fetchAll(); }
    catch (err) { alert(errMsg(err, 'Erro ao excluir')); }
  }

  const counts = useMemo(() => ({
    todas:   atas.length,
    interna: atas.filter(a => a.tipo === 'interna').length,
    externa: atas.filter(a => a.tipo === 'externa').length,
  }), [atas]);

  const totalPendencias = useMemo(
    () => atas.reduce((s, a) => s + a.pendencias.filter(p => p.status === 'aberto' || p.status === 'em_andamento').length, 0),
    [atas],
  );

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={backHref} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> {obraName || 'Obra'}
        </Link>
        <span>/</span>
        <span className="text-ber-carbon font-medium">Atas de Reunião</span>
      </div>

      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileSearch size={20} className="text-ber-teal" />
          <h1 className="text-xl font-black text-ber-carbon">Atas de Reunião</h1>
          {totalPendencias > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-semibold">
              <AlertCircle size={11} /> {totalPendencias} pendência{totalPendencias > 1 ? 's' : ''} aberta{totalPendencias > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-2 text-sm font-medium text-white hover:bg-ber-black">
          <Plus size={14} /> Nova Ata
        </button>
      </div>

      {/* Tipo filter */}
      <div className="mb-4 flex items-center gap-1 border-b border-ber-gray/20">
        {(['todas', 'interna', 'externa'] as const).map(t => (
          <button key={t} onClick={() => setTipoFilter(t)}
            className={`px-3 py-2 text-sm font-medium transition-colors capitalize ${tipoFilter === t ? 'border-b-2 border-ber-olive text-ber-carbon' : 'text-ber-gray hover:text-ber-carbon'}`}>
            {t === 'todas' ? `Todas (${counts.todas})` : t === 'interna' ? `Internas (${counts.interna})` : `Externas (${counts.externa})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center text-sm text-ber-gray">Carregando…</div>
      ) : atas.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center">
          <FileSearch size={28} className="mx-auto mb-2 text-ber-gray/40" />
          <p className="text-sm font-medium text-ber-gray">Nenhuma ata cadastrada</p>
          <p className="mt-1 text-xs text-ber-gray/60">Clique em "Nova Ata" pra começar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {atas.map(a => {
            const isExp = expanded === a.id;
            const abertas = a.pendencias.filter(p => p.status === 'aberto' || p.status === 'em_andamento').length;
            return (
              <div key={a.id} className="rounded-xl border border-ber-gray/15 bg-white shadow-sm overflow-hidden">
                <div className="flex items-start justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-ber-bg/30" onClick={() => toggleExpand(a.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${a.tipo === 'interna' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {a.tipo}
                      </span>
                      <span className="font-bold text-ber-carbon">{a.numero}</span>
                      <span className="text-xs text-ber-gray">· {fmtDate(a.data)}</span>
                      {a.local && <span className="text-xs text-ber-gray">· {a.local}</span>}
                      {abertas > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-semibold">
                          {abertas} pend. abertas
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ber-carbon line-clamp-2">{a.pauta}</p>
                    {a.participantes.length > 0 && (
                      <p className="mt-1 text-[11px] text-ber-gray italic line-clamp-1">
                        👥 {a.participantes.map(p => p.nome).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowForm(a)} title="Editar" className="rounded p-1 text-ber-gray hover:bg-ber-bg hover:text-ber-carbon"><Pencil size={14} /></button>
                    <button onClick={() => deleteAta(a.id)} title="Excluir" className="rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </div>
                {isExp && (
                  <div className="border-t border-ber-gray/10 bg-ber-bg/30 px-4 py-4 space-y-4">
                    {a.decisoes && (
                      <div>
                        <p className="text-xs font-semibold text-ber-carbon uppercase tracking-wide mb-1">Decisões</p>
                        <p className="text-sm text-ber-carbon whitespace-pre-wrap">{a.decisoes}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-ber-carbon uppercase tracking-wide mb-2">
                        Pendências geradas ({a.pendencias.length})
                      </p>
                      {a.pendencias.length === 0 ? (
                        <p className="text-xs text-ber-gray italic">Nenhuma pendência registrada nesta ata.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {a.pendencias.map(p => (
                            <li key={p.id} className="flex items-start gap-2 text-sm bg-white rounded border border-ber-gray/15 px-3 py-2">
                              <span className={`mt-0.5 inline-block w-2 h-2 rounded-full shrink-0 ${p.status === 'aberto' ? 'bg-amber-500' : p.status === 'em_andamento' ? 'bg-blue-500' : 'bg-green-500'}`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-ber-carbon">{p.descricao}</p>
                                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-ber-gray">
                                  {p.responsible && <span>👤 {p.responsible.name}</span>}
                                  {p.prazo && <span>📅 {fmtDate(p.prazo)}</span>}
                                  <span className="capitalize">· {p.status.replace('_', ' ')}</span>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <AttachmentsPanel ataId={a.id} attachments={attsByAta[a.id] || []} onRefresh={() => fetchAttachments(a.id)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm !== null && (
        <AtaFormModal
          obraId={obraId}
          users={users}
          edit={showForm === true ? null : showForm}
          onClose={() => setShowForm(null)}
          onSaved={() => { setShowForm(null); fetchAll(); }}
        />
      )}
    </div>
  );
}

// Form movido pra components/obras/AtaFormModal.tsx (reusado no Gestão 360).

function AttachmentsPanel({ ataId, attachments, onRefresh }: { ataId: string; attachments: Attachment[]; onRefresh: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('entityType', 'ata');
      fd.append('entityId', ataId);
      fd.append('file', file);
      await api.post('/attachments', fd);
      onRefresh();
    } catch (err) {
      alert(errMsg(err, 'Erro ao subir anexo'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este anexo?')) return;
    try { await api.delete(`/attachments/${id}`); onRefresh(); } catch { /* silent */ }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-ber-carbon uppercase tracking-wide flex items-center gap-1">
          <Paperclip size={12} /> Anexos ({attachments.length})
        </p>
        <label className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-ber-gray/30 px-2.5 py-1 text-xs font-medium text-ber-carbon hover:bg-white">
          <Upload size={12} /> {uploading ? 'Enviando…' : 'Enviar arquivo'}
          <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} disabled={uploading} />
        </label>
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-ber-gray italic">Ata assinada, foto da lousa, áudio da reunião…</p>
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

