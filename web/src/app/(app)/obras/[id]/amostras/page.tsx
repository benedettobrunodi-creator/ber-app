'use client';

/**
 * Durante a Obra · Aprovação de Amostras (31/08/26).
 * Registro de amostras enviadas pra aprovação — item, marca, especificação,
 * ambiente, status, data, responsável (stakeholder), fotos — com botão pra
 * disparar e-mail avisando TODOS os stakeholders da obra.
 */

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Trash2, Pencil, Mail, Upload, Image as ImageIcon } from 'lucide-react';
import api from '@/lib/api';

interface Stakeholder { id: string; nome: string; empresa: string; email: string | null }

interface Amostra {
  id: string;
  item: string;
  marca: string | null;
  especificacao: string | null;
  ambiente: string | null;
  status: 'aprovado' | 'reprovado' | 'pendente';
  dataAprovacao: string | null;
  responsavelStakeholderId: string | null;
  responsavelStakeholder: { id: string; nome: string; empresa: string } | null;
  observacoes: string | null;
  fotos: string[];
  emailEnviadoEm: string | null;
  createdAt: string;
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  aprovado: { label: 'Aprovado', cls: 'bg-green-100 text-green-700' },
  reprovado: { label: 'Reprovado', cls: 'bg-red-100 text-red-700' },
  pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
};

function fmtBR(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function emptyForm() {
  return {
    item: '', marca: '', especificacao: '', ambiente: '',
    status: 'aprovado' as Amostra['status'],
    dataAprovacao: new Date().toISOString().slice(0, 10),
    responsavelStakeholderId: '',
    observacoes: '',
  };
}

export default function AmostrasPage() {
  const { id: obraId } = useParams<{ id: string }>();
  const [amostras, setAmostras] = useState<Amostra[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<Amostra | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingFotoId, setUploadingFotoId] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const newFileInput = useRef<HTMLInputElement | null>(null);
  const [pendingFotos, setPendingFotos] = useState<File[]>([]);

  const inputCls = 'w-full text-sm px-3 py-2 border border-ber-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ber-teal bg-white';

  async function load() {
    setLoading(true);
    try {
      const [aRes, sRes] = await Promise.all([
        api.get(`/obras/${obraId}/amostras`),
        api.get(`/obras/${obraId}/stakeholders`),
      ]);
      setAmostras(aRes.data.data ?? []);
      setStakeholders(sRes.data.data ?? []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [obraId]);

  function openCreate() {
    setEditando(null);
    setForm(emptyForm());
    setPendingFotos([]);
    setError('');
    setShowForm(true);
  }

  function openEdit(a: Amostra) {
    setEditando(a);
    setForm({
      item: a.item,
      marca: a.marca ?? '',
      especificacao: a.especificacao ?? '',
      ambiente: a.ambiente ?? '',
      status: a.status,
      dataAprovacao: a.dataAprovacao?.slice(0, 10) ?? '',
      responsavelStakeholderId: a.responsavelStakeholderId ?? '',
      observacoes: a.observacoes ?? '',
    });
    setPendingFotos([]);
    setError('');
    setShowForm(true);
  }

  async function save() {
    if (!form.item.trim()) { setError('Informe o item'); return; }
    setSaving(true);
    setError('');
    const payload = {
      item: form.item,
      marca: form.marca || null,
      especificacao: form.especificacao || null,
      ambiente: form.ambiente || null,
      status: form.status,
      dataAprovacao: form.dataAprovacao || null,
      responsavelStakeholderId: form.responsavelStakeholderId || null,
      observacoes: form.observacoes || null,
    };
    try {
      let amostra: Amostra;
      if (editando) {
        const r = await api.patch(`/obras/${obraId}/amostras/${editando.id}`, payload);
        amostra = r.data.data;
      } else {
        const r = await api.post(`/obras/${obraId}/amostras`, payload);
        amostra = r.data.data;
      }
      for (const file of pendingFotos) {
        const fd = new FormData();
        fd.append('file', file);
        const r = await api.post(`/obras/${obraId}/amostras/${amostra.id}/foto`, fd);
        amostra = r.data.data;
      }
      setAmostras(prev => editando
        ? prev.map(a => a.id === amostra.id ? amostra : a)
        : [amostra, ...prev]);
      setShowForm(false);
    } catch (e) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(m || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadFoto(amostraId: string, file: File) {
    setUploadingFotoId(amostraId);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(`/obras/${obraId}/amostras/${amostraId}/foto`, fd);
      setAmostras(prev => prev.map(a => a.id === amostraId ? r.data.data : a));
    } catch {
      alert('Erro ao subir foto');
    } finally {
      setUploadingFotoId(null);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('Excluir esta amostra?')) return;
    try {
      await api.delete(`/obras/${obraId}/amostras/${id}`);
      setAmostras(prev => prev.filter(a => a.id !== id));
    } catch {
      alert('Erro ao excluir');
    }
  }

  async function handleEnviarEmail(a: Amostra) {
    if (!confirm(`Enviar e-mail sobre "${a.item}" para TODOS os stakeholders cadastrados nesta obra?`)) return;
    setSendingEmailId(a.id);
    try {
      const r = await api.post(`/obras/${obraId}/amostras/${a.id}/enviar-email`);
      setAmostras(prev => prev.map(x => x.id === a.id ? { ...x, emailEnviadoEm: r.data.data.emailEnviadoEm } : x));
      alert(`Enviado para: ${r.data.data.enviadoPara.join(', ')}`);
    } catch (e) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      alert(m || 'Erro ao enviar e-mail');
    } finally {
      setSendingEmailId(null);
    }
  }

  return (
    <div className="w-full max-w-[1100px] pb-24">
      <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon mb-4">
        <ArrowLeft size={16} /> Voltar à obra
      </Link>

      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="text-xl font-semibold text-ber-carbon">Aprovação de Amostras</h1>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 text-sm font-semibold bg-ber-carbon text-white rounded-lg px-3.5 py-2 hover:opacity-90">
          <Plus size={16} /> Nova amostra
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-ber-gray">Carregando…</p>
      ) : amostras.length === 0 ? (
        <div className="bg-white border border-ber-border rounded-xl p-8 text-center text-sm text-ber-gray">
          Nenhuma amostra registrada ainda nesta obra.
        </div>
      ) : (
        <div className="space-y-3">
          {amostras.map(a => {
            const st = STATUS_CFG[a.status] ?? { label: a.status, cls: 'bg-gray-100 text-gray-600' };
            return (
              <div key={a.id} className="bg-white border border-ber-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-ber-carbon">{a.item}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-ber-gray">
                      {a.marca && <>Marca: <strong className="text-ber-carbon">{a.marca}</strong> · </>}
                      {a.ambiente && <>{a.ambiente} · </>}
                      {fmtBR(a.dataAprovacao)}
                      {a.responsavelStakeholder && <> · {a.responsavelStakeholder.nome} ({a.responsavelStakeholder.empresa})</>}
                    </p>
                    {a.especificacao && <p className="text-xs text-ber-carbon mt-1.5">{a.especificacao}</p>}
                    {a.observacoes && <p className="text-xs text-ber-gray italic mt-1">{a.observacoes}</p>}
                    {a.emailEnviadoEm && (
                      <p className="text-[10px] text-ber-teal mt-1.5">✓ E-mail enviado em {new Date(a.emailEnviadoEm).toLocaleString('pt-BR')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleEnviarEmail(a)} disabled={sendingEmailId === a.id}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-ber-teal hover:text-ber-carbon disabled:opacity-50">
                      <Mail size={13} /> {sendingEmailId === a.id ? 'Enviando…' : 'Enviar aos stakeholders'}
                    </button>
                    <button onClick={() => openEdit(a)} className="text-ber-gray hover:text-ber-carbon"><Pencil size={14} /></button>
                    <button onClick={() => handleRemove(a.id)} className="text-ber-gray/40 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {a.fotos.map(f => (
                    <a key={f} href={f} target="_blank" rel="noreferrer">
                      <img src={f} alt="" className="h-16 w-16 rounded-lg object-cover border border-ber-border" />
                    </a>
                  ))}
                  <input
                    ref={el => { fileInputs.current[a.id] = el; }}
                    type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFoto(a.id, f); }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputs.current[a.id]?.click()}
                    disabled={uploadingFotoId === a.id}
                    className="h-16 w-16 rounded-lg border border-dashed border-ber-border flex items-center justify-center text-ber-gray hover:text-ber-carbon hover:border-ber-carbon disabled:opacity-50"
                    title="Adicionar foto"
                  >
                    {uploadingFotoId === a.id ? '…' : <ImageIcon size={18} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-bold text-ber-carbon">{editando ? 'Editar amostra' : 'Nova amostra'}</p>
              <button onClick={() => setShowForm(false)} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ber-carbon">Item *</label>
                <input className={inputCls} value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))} placeholder="ex: Porcelanato, Torneira, Piso laminado…" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ber-carbon">Marca</label>
                  <input className={inputCls} value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ber-carbon">Ambiente</label>
                  <input className={inputCls} value={form.ambiente} onChange={e => setForm(f => ({ ...f, ambiente: e.target.value }))} placeholder="ex: Banheiro suíte" />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ber-carbon">Especificação</label>
                <textarea className={inputCls} rows={2} value={form.especificacao} onChange={e => setForm(f => ({ ...f, especificacao: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ber-carbon">Status</label>
                  <select className={inputCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Amostra['status'] }))}>
                    <option value="aprovado">Aprovado</option>
                    <option value="reprovado">Reprovado</option>
                    <option value="pendente">Pendente</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-ber-carbon">Data</label>
                  <input type="date" className={inputCls} value={form.dataAprovacao} onChange={e => setForm(f => ({ ...f, dataAprovacao: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ber-carbon">Responsável pela aprovação</label>
                <select className={inputCls} value={form.responsavelStakeholderId} onChange={e => setForm(f => ({ ...f, responsavelStakeholderId: e.target.value }))}>
                  <option value="">Selecione um stakeholder…</option>
                  {stakeholders.map(s => (
                    <option key={s.id} value={s.id}>{s.nome} ({s.empresa})</option>
                  ))}
                </select>
                {stakeholders.length === 0 && (
                  <p className="mt-1 text-[11px] text-amber-600">Nenhum stakeholder cadastrado nesta obra ainda.</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ber-carbon">Observações</label>
                <textarea className={inputCls} rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="ex: aprovado condicionado a ajuste de cor" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ber-carbon">Fotos</label>
                <div className="flex flex-wrap gap-2">
                  {pendingFotos.map((f, i) => (
                    <span key={i} className="flex items-center gap-1 rounded-full bg-ber-surface border border-ber-border px-2.5 py-1 text-[11px] text-ber-carbon">
                      {f.name.slice(0, 20)}
                      <button type="button" onClick={() => setPendingFotos(prev => prev.filter((_, j) => j !== i))} className="text-ber-gray hover:text-red-500">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <input ref={newFileInput} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) setPendingFotos(prev => [...prev, ...files]); e.target.value = ''; }} />
                <button type="button" onClick={() => newFileInput.current?.click()}
                  className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-ber-teal hover:text-ber-carbon">
                  <Upload size={12} /> Adicionar foto{editando ? '' : ' (pode escolher várias)'}
                </button>
                {editando && <p className="mt-1 text-[10px] text-ber-gray">Fotos já salvas aparecem na lista — as adicionadas aqui entram junto ao salvar.</p>}
              </div>
            </div>

            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

            <div className="mt-5 flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-ber-border py-2 text-sm text-ber-gray hover:bg-ber-surface">
                Cancelar
              </button>
              <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-ber-carbon py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
