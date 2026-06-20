'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, FileText, CheckCircle2, XCircle, Clock, Trash2, Upload, Paperclip, X } from 'lucide-react';
import api from '@/lib/api';

const STATUS_META: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  em_analise:   { label: 'Em análise',   color: 'bg-amber-100 text-amber-700',  icon: Clock },
  aprovado:     { label: 'Aprovado',     color: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
  rejeitado:    { label: 'Rejeitado',    color: 'bg-red-100 text-red-700',      icon: XCircle },
  em_execucao:  { label: 'Em execução',  color: 'bg-blue-100 text-blue-700',    icon: Clock },
  concluido:    { label: 'Concluído',    color: 'bg-gray-200 text-gray-700',    icon: CheckCircle2 },
};

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

interface Aditivo {
  id: string;
  numero: string;
  descricao: string;
  valor: string | number;
  tipo: 'credito' | 'debito';
  motivo: string | null;
  status: keyof typeof STATUS_META;
  dataAbertura: string;
  dataDecisao: string | null;
  decididoPor: { id: string; name: string } | null;
}

interface ListResponse {
  data: {
    aditivos: Aditivo[];
    totals: { total: number; byStatus: Record<string, number> };
  };
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function ObraAditivosPage() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;

  const [data, setData] = useState<ListResponse['data'] | null>(null);
  const [obraName, setObraName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [attsByAditivo, setAttsByAditivo] = useState<Record<string, Attachment[]>>({});

  async function fetchAll() {
    setLoading(true);
    setError('');
    try {
      const [list, obraRes] = await Promise.all([
        api.get<ListResponse>(`/obras/${obraId}/aditivos`),
        api.get(`/obras/${obraId}`),
      ]);
      setData(list.data.data);
      setObraName(obraRes.data.data.name);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
      setError(typeof msg === 'string' ? msg : msg?.message || 'Erro ao carregar aditivos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, [obraId]);

  async function fetchAttachments(aditivoId: string) {
    try {
      const r = await api.get<{ data: Attachment[] }>('/attachments', { params: { entityType: 'aditivo', entityId: aditivoId } });
      setAttsByAditivo(prev => ({ ...prev, [aditivoId]: r.data.data }));
    } catch { /* silently ignore */ }
  }

  function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      if (!attsByAditivo[id]) fetchAttachments(id);
    }
  }

  async function handleDecision(aditivoId: string, status: 'aprovado' | 'rejeitado') {
    try {
      await api.post(`/aditivos/${aditivoId}/decision`, { status });
      fetchAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
      alert(typeof msg === 'string' ? msg : msg?.message || 'Erro ao decidir');
    }
  }

  async function handleStatusUpdate(aditivoId: string, status: string) {
    try {
      await api.patch(`/aditivos/${aditivoId}`, { status });
      fetchAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
      alert(typeof msg === 'string' ? msg : msg?.message || 'Erro ao atualizar');
    }
  }

  async function handleDelete(aditivoId: string) {
    if (!confirm('Excluir este aditivo? Esta ação não pode ser desfeita.')) return;
    try {
      await api.delete(`/aditivos/${aditivoId}`);
      fetchAll();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
      alert(typeof msg === 'string' ? msg : msg?.message || 'Erro ao excluir');
    }
  }

  const totalsRows = useMemo(() => {
    if (!data) return [];
    return Object.entries(STATUS_META).map(([key, meta]) => ({
      status: key,
      label: meta.label,
      value: data.totals.byStatus[key] ?? 0,
    }));
  }, [data]);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> {obraName || 'Obra'}
        </Link>
        <span>/</span>
        <span className="text-ber-carbon font-medium">Aditivos</span>
      </div>

      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-ber-teal" />
          <h1 className="text-xl font-black text-ber-carbon">Aditivos · Change Orders</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-2 text-sm font-medium text-white hover:bg-ber-black"
        >
          <Plus size={14} /> Novo Aditivo
        </button>
      </div>

      {/* KPI cards */}
      <div className="mb-5 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl bg-white border border-ber-gray/15 p-4 shadow-sm">
          <p className="text-[10px] font-medium text-ber-gray uppercase tracking-wide">Total líquido</p>
          <p className={`mt-1 text-xl font-black ${data && data.totals.total >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {fmtBRL(data?.totals.total ?? 0)}
          </p>
        </div>
        {totalsRows.map(row => {
          const meta = STATUS_META[row.status];
          const Icon = meta.icon;
          return (
            <div key={row.status} className="rounded-xl bg-white border border-ber-gray/15 p-4 shadow-sm">
              <p className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide ${meta.color.replace('bg-', 'text-').replace('-100', '-700').replace('-200', '-700')}`}>
                <Icon size={11} /> {meta.label}
              </p>
              <p className="mt-1 text-base font-bold text-ber-carbon">{fmtBRL(row.value)}</p>
            </div>
          );
        })}
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center text-sm text-ber-gray">Carregando…</div>
      ) : !data || data.aditivos.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center">
          <FileText size={28} className="mx-auto mb-2 text-ber-gray/40" />
          <p className="text-sm font-medium text-ber-gray">Nenhum aditivo cadastrado</p>
          <p className="mt-1 text-xs text-ber-gray/60">Clique em "Novo Aditivo" pra começar</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ber-gray/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-ber-carbon text-xs text-white">
              <tr>
                <th className="px-3 py-3 text-left w-20">Nº</th>
                <th className="px-3 py-3 text-left">Descrição</th>
                <th className="px-3 py-3 text-center w-24">Tipo</th>
                <th className="px-3 py-3 text-right w-32">Valor</th>
                <th className="px-3 py-3 text-center w-28">Status</th>
                <th className="px-3 py-3 text-center w-28">Abertura</th>
                <th className="px-3 py-3 text-center w-32">Decisão</th>
                <th className="px-3 py-3 w-32"></th>
              </tr>
            </thead>
            <tbody>
              {data.aditivos.map(a => {
                const statusMeta = STATUS_META[a.status] || STATUS_META.em_analise;
                const valor = typeof a.valor === 'string' ? parseFloat(a.valor) : a.valor;
                const signed = a.tipo === 'debito' ? -valor : valor;
                const isExp = expanded === a.id;
                return (
                  <>
                    <tr key={a.id} className="border-t border-ber-gray/10 hover:bg-ber-bg/40 cursor-pointer" onClick={() => toggleExpand(a.id)}>
                      <td className="px-3 py-2.5 font-bold text-ber-carbon">{a.numero}</td>
                      <td className="px-3 py-2.5 text-ber-carbon">
                        <div className="line-clamp-1">{a.descricao}</div>
                        {a.motivo && <div className="text-xs text-ber-gray/70 line-clamp-1 italic">Motivo: {a.motivo}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${a.tipo === 'credito' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {a.tipo === 'credito' ? '+ Crédito' : '− Débito'}
                        </span>
                      </td>
                      <td className={`px-3 py-2.5 text-right tabular-nums font-bold ${signed >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {fmtBRL(signed)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusMeta.color}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-ber-gray">{fmtDate(a.dataAbertura)}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-ber-gray">
                        {a.dataDecisao ? (
                          <>
                            {fmtDate(a.dataDecisao)}
                            {a.decididoPor && <div className="text-[10px] opacity-70">{a.decididoPor.name}</div>}
                          </>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          {a.status === 'em_analise' && (
                            <>
                              <button onClick={() => handleDecision(a.id, 'aprovado')} title="Aprovar" className="rounded p-1 text-green-600 hover:bg-green-50">
                                <CheckCircle2 size={14} />
                              </button>
                              <button onClick={() => handleDecision(a.id, 'rejeitado')} title="Rejeitar" className="rounded p-1 text-red-600 hover:bg-red-50">
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                          {a.status === 'aprovado' && (
                            <button onClick={() => handleStatusUpdate(a.id, 'em_execucao')} title="Marcar em execução" className="rounded p-1 text-blue-600 hover:bg-blue-50">
                              <Clock size={14} />
                            </button>
                          )}
                          {a.status === 'em_execucao' && (
                            <button onClick={() => handleStatusUpdate(a.id, 'concluido')} title="Concluir" className="rounded p-1 text-gray-700 hover:bg-gray-100">
                              <CheckCircle2 size={14} />
                            </button>
                          )}
                          <button onClick={() => handleDelete(a.id)} title="Excluir" className="rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExp && (
                      <tr className="bg-ber-bg/30 border-t border-ber-gray/10">
                        <td colSpan={8} className="px-4 py-3">
                          <AttachmentsPanel
                            aditivoId={a.id}
                            attachments={attsByAditivo[a.id] || []}
                            onRefresh={() => fetchAttachments(a.id)}
                          />
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

      {showForm && (
        <AditivoForm
          obraId={obraId}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); fetchAll(); }}
        />
      )}
    </div>
  );
}

function AditivoForm({ obraId, onClose, onCreated }: { obraId: string; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ numero: '', descricao: '', valor: '', tipo: 'credito' as 'credito' | 'debito', motivo: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const valor = Number(form.valor.replace(',', '.'));
      if (!form.numero.trim() || !form.descricao.trim() || isNaN(valor) || valor <= 0) {
        setError('Preencha número, descrição e valor (> 0).');
        setSaving(false);
        return;
      }
      await api.post(`/obras/${obraId}/aditivos`, {
        numero: form.numero.trim(),
        descricao: form.descricao.trim(),
        valor,
        tipo: form.tipo,
        motivo: form.motivo.trim() || null,
      });
      onCreated();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
      setError(typeof msg === 'string' ? msg : msg?.message || 'Erro ao criar aditivo');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-t-2xl md:rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-ber-offwhite px-6 py-4">
          <h2 className="text-lg font-black text-ber-carbon">Novo Aditivo</h2>
          <button onClick={onClose} className="rounded p-1 text-ber-gray hover:bg-ber-offwhite hover:text-ber-carbon">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-ber-gray uppercase tracking-wide">Número *</label>
              <input value={form.numero} onChange={e => setForm(p => ({ ...p, numero: e.target.value }))}
                placeholder="Ex: AD-01" required
                className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ber-gray uppercase tracking-wide">Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as 'credito' | 'debito' }))}
                className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none">
                <option value="credito">Crédito (a receber)</option>
                <option value="debito">Débito (a deduzir)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ber-gray uppercase tracking-wide">Descrição *</label>
            <textarea rows={2} value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} required
              className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ber-gray uppercase tracking-wide">Valor (R$) *</label>
            <input value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
              inputMode="decimal" placeholder="Ex: 15000.00" required
              className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ber-gray uppercase tracking-wide">Motivo (opcional)</label>
            <textarea rows={2} value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))}
              placeholder="Justificativa, número da ata de origem, etc."
              className="mt-1 block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-ber-gray hover:bg-ber-offwhite">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">
              {saving ? 'Criando…' : 'Criar Aditivo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AttachmentsPanel({ aditivoId, attachments, onRefresh }: { aditivoId: string; attachments: Attachment[]; onRefresh: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('entityType', 'aditivo');
      fd.append('entityId', aditivoId);
      fd.append('file', file);
      await api.post('/attachments', fd);
      onRefresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
      alert(typeof msg === 'string' ? msg : msg?.message || 'Erro ao subir anexo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este anexo?')) return;
    try {
      await api.delete(`/attachments/${id}`);
      onRefresh();
    } catch { /* silent */ }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-ber-carbon uppercase tracking-wide flex items-center gap-1">
          <Paperclip size={12} /> Anexos ({attachments.length})
        </p>
        <label className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-ber-gray/30 px-2.5 py-1 text-xs font-medium text-ber-carbon hover:bg-white">
          <Upload size={12} /> {uploading ? 'Enviando…' : 'Enviar arquivo'}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            disabled={uploading}
          />
        </label>
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-ber-gray/70 italic">Nenhum anexo. Use para guardar email de aprovação, ata, planilha, etc.</p>
      ) : (
        <ul className="space-y-1">
          {attachments.map(att => (
            <li key={att.id} className="flex items-center justify-between text-xs bg-white rounded border border-ber-gray/15 px-2 py-1">
              <a href={att.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-ber-teal hover:underline truncate">
                <Paperclip size={11} /> {att.fileName}
              </a>
              <button onClick={() => handleDelete(att.id)} className="text-ber-gray hover:text-red-600">
                <Trash2 size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
