'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useBackToObra } from '@/hooks/useBackToObra';
import { useTabState } from '@/hooks/useTabState';
import Link from 'next/link';
import { ArrowLeft, Plus, FileSignature, ShoppingBag, Trash2, X, Paperclip, Upload, Pencil } from 'lucide-react';
import api from '@/lib/api';
import { ContratacaoFormModal, OcFormModal } from '@/components/obras/ContratacaoFormModal';

// ─── Status meta ───────────────────────────────────────────────────────────
const CONTRATACAO_STATUS_META: Record<string, { label: string; color: string }> = {
  em_negociacao: { label: 'Em negociação',  color: 'bg-amber-100 text-amber-700' },
  aprovado:      { label: 'Aprovado',       color: 'bg-blue-100 text-blue-700' },
  assinado:      { label: 'Assinado',       color: 'bg-indigo-100 text-indigo-700' },
  em_execucao:   { label: 'Em execução',    color: 'bg-green-100 text-green-700' },
  concluido:     { label: 'Concluído',      color: 'bg-gray-200 text-gray-700' },
  rescindido:    { label: 'Rescindido',     color: 'bg-red-100 text-red-700' },
};

const OC_STATUS_META: Record<string, { label: string; color: string }> = {
  aberta:     { label: 'Aberta',      color: 'bg-amber-100 text-amber-700' },
  aprovada:   { label: 'Aprovada',    color: 'bg-blue-100 text-blue-700' },
  em_entrega: { label: 'Em entrega',  color: 'bg-indigo-100 text-indigo-700' },
  entregue:   { label: 'Entregue',    color: 'bg-green-100 text-green-700' },
  cancelada:  { label: 'Cancelada',   color: 'bg-red-100 text-red-700' },
};

// ─── Types ─────────────────────────────────────────────────────────────────
interface Contratacao {
  id: string;
  fornecedor: string;
  disciplina: string | null;
  valor: string | number;
  dataAssinatura: string | null;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  status: keyof typeof CONTRATACAO_STATUS_META;
  observacoes: string | null;
  _count: { ocs: number };
}

interface Oc {
  id: string;
  numero: string;
  fornecedor: string;
  descricao: string;
  valor: string | number;
  dataEmissao: string;
  dataPrevistaEntrega: string | null;
  dataEntregaReal: string | null;
  status: keyof typeof OC_STATUS_META;
  observacoes: string | null;
  contratacao: { id: string; fornecedor: string; disciplina: string | null } | null;
}

interface ListContratacoesResponse {
  data: {
    contratacoes: Contratacao[];
    totals: { total: number; byStatus: Record<string, number> };
  };
}

interface ListOcsResponse {
  data: {
    ocs: Oc[];
    totals: { total: number; byStatus: Record<string, number> };
  };
}

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

// ─── Main ──────────────────────────────────────────────────────────────────
export default function ContratacoesPage() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;
  const backHref = useBackToObra();
  const [tab, setTab] = useTabState<'contratos' | 'ocs'>('contratos');
  const [obraName, setObraName] = useState('');
  const [contratos, setContratos] = useState<ListContratacoesResponse['data'] | null>(null);
  const [ocs, setOcs] = useState<ListOcsResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showContratoForm, setShowContratoForm] = useState<Contratacao | true | null>(null);
  const [showOcForm, setShowOcForm] = useState<Oc | true | null>(null);
  const [expandedC, setExpandedC] = useState<string | null>(null);
  const [attsByC, setAttsByC] = useState<Record<string, Attachment[]>>({});

  async function fetchAll() {
    setLoading(true);
    try {
      const [c, o, obraRes] = await Promise.all([
        api.get<ListContratacoesResponse>(`/obras/${obraId}/contratacoes`),
        api.get<ListOcsResponse>(`/obras/${obraId}/ordens-compra`),
        api.get(`/obras/${obraId}`),
      ]);
      setContratos(c.data.data);
      setOcs(o.data.data);
      setObraName(obraRes.data.data.name);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, [obraId]);

  async function fetchAttachments(contratoId: string) {
    try {
      const r = await api.get<{ data: Attachment[] }>('/attachments', { params: { entityType: 'contratacao', entityId: contratoId } });
      setAttsByC(prev => ({ ...prev, [contratoId]: r.data.data }));
    } catch { /* silent */ }
  }

  function toggleExpand(id: string) {
    if (expandedC === id) {
      setExpandedC(null);
    } else {
      setExpandedC(id);
      if (!attsByC[id]) fetchAttachments(id);
    }
  }

  async function deleteContratacao(id: string) {
    if (!confirm('Excluir esta contratação? OCs vinculadas vão perder o link, mas não serão deletadas.')) return;
    try { await api.delete(`/contratacoes/${id}`); fetchAll(); }
    catch (err) { alert(errMsg(err, 'Erro ao excluir')); }
  }

  async function deleteOc(id: string) {
    if (!confirm('Excluir esta OC?')) return;
    try { await api.delete(`/ordens-compra/${id}`); fetchAll(); }
    catch (err) { alert(errMsg(err, 'Erro ao excluir')); }
  }

  async function updateContratacaoStatus(id: string, status: string) {
    try { await api.patch(`/contratacoes/${id}`, { status }); fetchAll(); }
    catch (err) { alert(errMsg(err, 'Erro ao atualizar')); }
  }

  async function updateOcStatus(id: string, status: string) {
    const patch: Record<string, unknown> = { status };
    if (status === 'entregue') patch.dataEntregaReal = new Date().toISOString().slice(0, 10);
    try { await api.patch(`/ordens-compra/${id}`, patch); fetchAll(); }
    catch (err) { alert(errMsg(err, 'Erro ao atualizar')); }
  }

  const contratosByStatus = useMemo(() => {
    if (!contratos) return [];
    return Object.entries(CONTRATACAO_STATUS_META).map(([key, meta]) => ({
      status: key, label: meta.label, color: meta.color,
      value: contratos.totals.byStatus[key] ?? 0,
    }));
  }, [contratos]);

  const ocsByStatus = useMemo(() => {
    if (!ocs) return [];
    return Object.entries(OC_STATUS_META).map(([key, meta]) => ({
      status: key, label: meta.label, color: meta.color,
      value: ocs.totals.byStatus[key] ?? 0,
    }));
  }, [ocs]);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={backHref} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> {obraName || 'Obra'}
        </Link>
        <span>/</span>
        <span className="text-ber-carbon font-medium">Contratações & OCs</span>
      </div>

      {/* Sub-tabs */}
      <div className="mb-5 flex items-center gap-1 border-b border-ber-gray/20">
        <button onClick={() => setTab('contratos')}
          className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === 'contratos' ? 'border-b-2 border-ber-olive text-ber-carbon' : 'text-ber-gray hover:text-ber-carbon'}`}>
          <FileSignature size={14} /> Contratações ({contratos?.contratacoes.length ?? 0})
        </button>
        <button onClick={() => setTab('ocs')}
          className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === 'ocs' ? 'border-b-2 border-ber-olive text-ber-carbon' : 'text-ber-gray hover:text-ber-carbon'}`}>
          <ShoppingBag size={14} /> Ordens de Compra ({ocs?.ocs.length ?? 0})
        </button>
        <button onClick={() => tab === 'contratos' ? setShowContratoForm(true) : setShowOcForm(true)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-1.5 text-xs font-semibold text-white hover:bg-ber-black">
          <Plus size={12} /> {tab === 'contratos' ? 'Nova Contratação' : 'Nova OC'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        {tab === 'contratos' ? (
          <>
            <KpiCard label="Total contratado" value={contratos?.totals.total ?? 0} />
            {contratosByStatus.slice(0, 3).map(s => <KpiCard key={s.status} label={s.label} value={s.value} sub />)}
          </>
        ) : (
          <>
            <KpiCard label="Total em OCs" value={ocs?.totals.total ?? 0} />
            {ocsByStatus.slice(0, 3).map(s => <KpiCard key={s.status} label={s.label} value={s.value} sub />)}
          </>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center text-sm text-ber-gray">Carregando…</div>
      ) : tab === 'contratos' ? (
        contratos && contratos.contratacoes.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-ber-gray/10 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-ber-carbon text-xs text-white">
                <tr>
                  <th className="px-3 py-3 text-left">Fornecedor</th>
                  <th className="px-3 py-3 text-left w-32">Disciplina</th>
                  <th className="px-3 py-3 text-right w-32">Valor</th>
                  <th className="px-3 py-3 text-center w-28">Assinatura</th>
                  <th className="px-3 py-3 text-center w-32">Vigência</th>
                  <th className="px-3 py-3 text-center w-28">Status</th>
                  <th className="px-3 py-3 text-center w-16">OCs</th>
                  <th className="px-3 py-3 w-28"></th>
                </tr>
              </thead>
              <tbody>
                {contratos.contratacoes.map(c => {
                  const valor = typeof c.valor === 'string' ? parseFloat(c.valor) : c.valor;
                  const meta = CONTRATACAO_STATUS_META[c.status] ?? CONTRATACAO_STATUS_META.em_negociacao;
                  const isExp = expandedC === c.id;
                  return (
                    <>
                      <tr key={c.id} className="border-t border-ber-gray/10 hover:bg-ber-bg/40 cursor-pointer" onClick={() => toggleExpand(c.id)}>
                        <td className="px-3 py-2.5 font-medium text-ber-carbon">{c.fornecedor}</td>
                        <td className="px-3 py-2.5 text-xs text-ber-gray">{c.disciplina || '—'}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-bold text-ber-carbon">{fmtBRL(valor)}</td>
                        <td className="px-3 py-2.5 text-center text-xs text-ber-gray">{fmtDate(c.dataAssinatura)}</td>
                        <td className="px-3 py-2.5 text-center text-xs text-ber-gray">
                          {c.vigenciaInicio || c.vigenciaFim ? `${fmtDate(c.vigenciaInicio)} → ${fmtDate(c.vigenciaFim)}` : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <select value={c.status}
                            onClick={e => e.stopPropagation()}
                            onChange={e => updateContratacaoStatus(c.id, e.target.value)}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium border-0 focus:outline-none focus:ring-1 focus:ring-ber-teal ${meta.color}`}>
                            {Object.entries(CONTRATACAO_STATUS_META).map(([k, m]) => (
                              <option key={k} value={k}>{m.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs font-bold text-ber-gray">{c._count.ocs}</td>
                        <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => setShowContratoForm(c)} title="Editar" className="rounded p-1 text-ber-gray hover:bg-ber-bg hover:text-ber-carbon"><Pencil size={14} /></button>
                            <button onClick={() => deleteContratacao(c.id)} title="Excluir" className="rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                      {isExp && (
                        <tr className="bg-ber-bg/30 border-t border-ber-gray/10">
                          <td colSpan={8} className="px-4 py-3">
                            {c.observacoes && <p className="mb-3 text-xs text-ber-gray italic">{c.observacoes}</p>}
                            <AttachmentsPanel entityType="contratacao" entityId={c.id} attachments={attsByC[c.id] || []} onRefresh={() => fetchAttachments(c.id)} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={FileSignature} label="Nenhuma contratação cadastrada" />
      ) : (
        ocs && ocs.ocs.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-ber-gray/10 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-ber-carbon text-xs text-white">
                <tr>
                  <th className="px-3 py-3 text-left w-20">Nº OC</th>
                  <th className="px-3 py-3 text-left">Descrição</th>
                  <th className="px-3 py-3 text-left w-40">Fornecedor</th>
                  <th className="px-3 py-3 text-right w-28">Valor</th>
                  <th className="px-3 py-3 text-center w-24">Emissão</th>
                  <th className="px-3 py-3 text-center w-28">Prev. entrega</th>
                  <th className="px-3 py-3 text-center w-28">Status</th>
                  <th className="px-3 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {ocs.ocs.map(o => {
                  const valor = typeof o.valor === 'string' ? parseFloat(o.valor) : o.valor;
                  const meta = OC_STATUS_META[o.status] ?? OC_STATUS_META.aberta;
                  return (
                    <tr key={o.id} className="border-t border-ber-gray/10 hover:bg-ber-bg/40">
                      <td className="px-3 py-2.5 font-bold text-ber-carbon">{o.numero}</td>
                      <td className="px-3 py-2.5 text-ber-carbon">
                        <div className="line-clamp-1">{o.descricao}</div>
                        {o.contratacao && (
                          <div className="text-[10px] text-ber-teal mt-0.5">↳ Contrato: {o.contratacao.fornecedor}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs">{o.fornecedor}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-ber-carbon">{fmtBRL(valor)}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-ber-gray">{fmtDate(o.dataEmissao)}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-ber-gray">{fmtDate(o.dataPrevistaEntrega)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <select value={o.status} onChange={e => updateOcStatus(o.id, e.target.value)}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium border-0 focus:outline-none focus:ring-1 focus:ring-ber-teal ${meta.color}`}>
                          {Object.entries(OC_STATUS_META).map(([k, m]) => (
                            <option key={k} value={k}>{m.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => setShowOcForm(o)} title="Editar" className="rounded p-1 text-ber-gray hover:bg-ber-bg hover:text-ber-carbon"><Pencil size={14} /></button>
                          <button onClick={() => deleteOc(o.id)} title="Excluir" className="rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon={ShoppingBag} label="Nenhuma OC cadastrada" />
      )}

      {showContratoForm !== null && (
        <ContratacaoFormModal
          obraId={obraId}
          edit={showContratoForm === true ? null : showContratoForm}
          onClose={() => setShowContratoForm(null)}
          onSaved={() => { setShowContratoForm(null); fetchAll(); }}
        />
      )}
      {showOcForm !== null && (
        <OcFormModal
          obraId={obraId}
          contratacoes={contratos?.contratacoes ?? []}
          edit={showOcForm === true ? null : showOcForm}
          onClose={() => setShowOcForm(null)}
          onSaved={() => { setShowOcForm(null); fetchAll(); }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────
function KpiCard({ label, value, sub }: { label: string; value: number; sub?: boolean }) {
  return (
    <div className="rounded-xl bg-white border border-ber-gray/15 p-4 shadow-sm">
      <p className="text-[10px] font-medium text-ber-gray uppercase tracking-wide">{label}</p>
      <p className={`mt-1 ${sub ? 'text-base' : 'text-xl'} font-bold text-ber-carbon`}>{fmtBRL(value)}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, label }: { icon: typeof FileSignature; label: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center">
      <Icon size={28} className="mx-auto mb-2 text-ber-gray/40" />
      <p className="text-sm font-medium text-ber-gray">{label}</p>
    </div>
  );
}

// Forms movidos pra components/obras/ContratacaoFormModal.tsx (reusados no Gestão 360).

function AttachmentsPanel({ entityType, entityId, attachments, onRefresh }: { entityType: string; entityId: string; attachments: Attachment[]; onRefresh: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('entityType', entityType);
      fd.append('entityId', entityId);
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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-ber-carbon uppercase tracking-wide flex items-center gap-1">
          <Paperclip size={12} /> Anexos ({attachments.length})
        </p>
        <label className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-ber-gray/30 px-2.5 py-1 text-xs font-medium text-ber-carbon hover:bg-white">
          <Upload size={12} /> {uploading ? 'Enviando…' : 'Enviar arquivo'}
          <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} disabled={uploading} />
        </label>
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-ber-gray/70 italic">Nenhum anexo. Use pra guardar contrato assinado, escopo, planilha de preços, etc.</p>
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

