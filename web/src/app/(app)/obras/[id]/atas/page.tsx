'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useBackToObra } from '@/hooks/useBackToObra';
import Link from 'next/link';
import { ArrowLeft, Plus, FileSearch, Trash2, X, Paperclip, Upload, Pencil, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface Participante { nome: string; papel?: string | null }

interface PendenciaInline {
  id: string;
  descricao: string;
  status: string;
  prazo: string | null;
  responsible: { id: string; name: string } | null;
}

interface Ata {
  id: string;
  tipo: 'interna' | 'externa';
  numero: string;
  data: string;
  local: string | null;
  participantes: Participante[];
  pauta: string;
  decisoes: string | null;
  pendencias: PendenciaInline[];
}

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
}

interface UserOption { id: string; name: string }

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
        <AtaForm
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

// ─── Form ──────────────────────────────────────────────────────────────────
function AtaForm({ obraId, users, edit, onClose, onSaved }: { obraId: string; users: UserOption[]; edit: Ata | null; onClose: () => void; onSaved: () => void }) {
  const [tipo, setTipo] = useState<'interna' | 'externa'>(edit?.tipo || 'interna');
  const [numero, setNumero] = useState(edit?.numero || '');
  const [data, setData] = useState(edit?.data ? edit.data.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [local, setLocal] = useState(edit?.local || '');
  const [participantes, setParticipantes] = useState<Participante[]>(edit?.participantes || []);
  const [novoPart, setNovoPart] = useState({ nome: '', papel: '' });
  const [pauta, setPauta] = useState(edit?.pauta || '');
  const [decisoes, setDecisoes] = useState(edit?.decisoes || '');
  const [pendencias, setPendencias] = useState<{ descricao: string; responsibleId: string; prazo: string }[]>([]);
  const [novaPend, setNovaPend] = useState({ descricao: '', responsibleId: '', prazo: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addParticipante() {
    if (!novoPart.nome.trim()) return;
    setParticipantes(p => [...p, { nome: novoPart.nome.trim(), papel: novoPart.papel.trim() || null }]);
    setNovoPart({ nome: '', papel: '' });
  }

  function addPendencia() {
    if (!novaPend.descricao.trim()) return;
    setPendencias(p => [...p, { ...novaPend, descricao: novaPend.descricao.trim() }]);
    setNovaPend({ descricao: '', responsibleId: '', prazo: '' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!numero.trim() || !pauta.trim()) {
      setError('Número e pauta são obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = {
        tipo,
        numero: numero.trim(),
        data,
        local: local.trim() || null,
        participantes,
        pauta: pauta.trim(),
        decisoes: decisoes.trim() || null,
        pendencias: edit ? [] : pendencias.map(p => ({
          descricao: p.descricao,
          responsibleId: p.responsibleId || null,
          prazo: p.prazo || null,
        })),
      };
      if (edit) {
        await api.patch(`/atas/${edit.id}`, body);
      } else {
        await api.post(`/obras/${obraId}/atas`, body);
      }
      onSaved();
    } catch (err) {
      setError(errMsg(err, 'Erro ao salvar ata'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl rounded-t-2xl md:rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-black text-ber-carbon">{edit ? 'Editar Ata' : 'Nova Ata'}</h2>
          <button onClick={onClose} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite hover:text-ber-carbon"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="grid grid-cols-3 gap-4">
            <Field label="Tipo *">
              <select value={tipo} onChange={e => setTipo(e.target.value as 'interna' | 'externa')} className={inputCls}>
                <option value="interna">Interna</option>
                <option value="externa">Externa (cliente / gerenciadora)</option>
              </select>
            </Field>
            <Field label="Número *"><input value={numero} onChange={e => setNumero(e.target.value)} placeholder="Ex: AR-01" className={inputCls} required /></Field>
            <Field label="Data *"><input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} required /></Field>
          </div>

          <Field label="Local"><input value={local} onChange={e => setLocal(e.target.value)} placeholder="Ex: Canteiro, escritório do cliente, online…" className={inputCls} /></Field>

          <div>
            <label className="block text-xs font-medium text-ber-gray uppercase tracking-wide mb-1">Participantes</label>
            {participantes.length > 0 && (
              <ul className="mb-2 space-y-1">
                {participantes.map((p, i) => (
                  <li key={i} className="flex items-center justify-between text-xs bg-ber-bg/40 rounded border border-ber-gray/15 px-2 py-1">
                    <span><strong>{p.nome}</strong>{p.papel ? ` · ${p.papel}` : ''}</span>
                    <button type="button" onClick={() => setParticipantes(arr => arr.filter((_, j) => j !== i))} className="text-ber-gray hover:text-red-600"><X size={11} /></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-5 gap-2">
              <input value={novoPart.nome} onChange={e => setNovoPart(p => ({ ...p, nome: e.target.value }))} placeholder="Nome" className={`${inputCls} col-span-2`} />
              <input value={novoPart.papel} onChange={e => setNovoPart(p => ({ ...p, papel: e.target.value }))} placeholder="Papel (cliente, arq…)" className={`${inputCls} col-span-2`} />
              <button type="button" onClick={addParticipante} className="rounded-md border border-ber-gray/30 text-sm text-ber-carbon hover:bg-ber-offwhite">+ Add</button>
            </div>
          </div>

          <Field label="Pauta *"><textarea rows={3} value={pauta} onChange={e => setPauta(e.target.value)} className={inputCls} required /></Field>
          <Field label="Decisões"><textarea rows={3} value={decisoes} onChange={e => setDecisoes(e.target.value)} className={inputCls} placeholder="O que foi decidido na reunião." /></Field>

          {!edit && (
            <div>
              <label className="block text-xs font-medium text-ber-gray uppercase tracking-wide mb-1">Pendências geradas (opcional)</label>
              {pendencias.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {pendencias.map((p, i) => (
                    <li key={i} className="flex items-center justify-between text-xs bg-ber-bg/40 rounded border border-ber-gray/15 px-2 py-1">
                      <span>
                        <strong>{p.descricao}</strong>
                        {p.responsibleId && <span className="text-ber-gray"> · {users.find(u => u.id === p.responsibleId)?.name || '?'}</span>}
                        {p.prazo && <span className="text-ber-gray"> · prazo {fmtDate(p.prazo)}</span>}
                      </span>
                      <button type="button" onClick={() => setPendencias(arr => arr.filter((_, j) => j !== i))} className="text-ber-gray hover:text-red-600"><X size={11} /></button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid grid-cols-7 gap-2">
                <input value={novaPend.descricao} onChange={e => setNovaPend(p => ({ ...p, descricao: e.target.value }))} placeholder="Descrição da pendência" className={`${inputCls} col-span-3`} />
                <select value={novaPend.responsibleId} onChange={e => setNovaPend(p => ({ ...p, responsibleId: e.target.value }))} className={`${inputCls} col-span-2`}>
                  <option value="">Responsável (opc.)</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <input type="date" value={novaPend.prazo} onChange={e => setNovaPend(p => ({ ...p, prazo: e.target.value }))} className={inputCls} />
                <button type="button" onClick={addPendencia} className="rounded-md border border-ber-gray/30 text-sm text-ber-carbon hover:bg-ber-offwhite">+ Add</button>
              </div>
              <p className="mt-1 text-[10px] text-ber-gray/70">As pendências geradas vão pro PunchList "Geral" da obra e ficam vinculadas a esta ata.</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">
              {saving ? 'Salvando…' : edit ? 'Salvar' : 'Criar Ata'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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

const inputCls = 'mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ber-gray uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
