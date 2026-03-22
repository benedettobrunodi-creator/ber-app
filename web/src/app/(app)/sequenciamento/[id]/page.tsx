'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
  ArrowLeft, CheckCircle, Clock, PlayCircle, AlertCircle,
  XCircle, Lock, Camera, Loader2, X, ChevronDown, ChevronUp, Plus
} from 'lucide-react';

interface Etapa {
  id: string;
  name: string;
  discipline: string;
  order: number;
  estimatedDays: number;
  status: 'nao_iniciada' | 'em_andamento' | 'aguardando_aprovacao' | 'aprovada' | 'rejeitada';
  startDate?: string;
  estimatedEndDate?: string;
  endDate?: string;
  gestorNotes?: string;
  coordenadorNotes?: string;
  rejectionReason?: string;
  evidenciaDescricao?: string;
  evidenciaFotos?: string[];
}

interface Sequenciamento {
  id: string;
  frozenAt?: string;
  template?: { name: string; segment: string };
  etapas: Etapa[];
}

interface Template {
  id: string;
  name: string;
  segment: string;
  etapas: { id: string; name: string; discipline: string; order: number; estimatedDays: number }[];
}

interface Obra {
  id: string;
  name: string;
  status: string;
}

const statusConfig = {
  nao_iniciada: { label: 'Não iniciada', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: Clock, dot: 'bg-gray-300' },
  em_andamento: { label: 'Em andamento', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: PlayCircle, dot: 'bg-blue-500' },
  aguardando_aprovacao: { label: 'Aguardando aprovação', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: AlertCircle, dot: 'bg-yellow-500' },
  aprovada: { label: 'Aprovada', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle, dot: 'bg-green-500' },
  rejeitada: { label: 'Rejeitada', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, dot: 'bg-red-500' },
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

export default function SequenciamentoObraPage() {
  const params = useParams();
  const router = useRouter();
  const obraId = params.id as string;

  const [obra, setObra] = useState<Obra | null>(null);
  const [seq, setSeq] = useState<Sequenciamento | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Criar sequenciamento
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Modais
  const [submitModal, setSubmitModal] = useState<Etapa | null>(null);
  const [rejectModal, setRejectModal] = useState<Etapa | null>(null);
  const [submitForm, setSubmitForm] = useState({ gestorNotes: '', evidenciaDescricao: '', evidenciaFotos: [] as string[] });
  const [rejectForm, setRejectForm] = useState({ rejectionReason: '', coordenadorNotes: '' });
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    if (!obraId) return;
    Promise.all([api.get(`/obras/${obraId}`), api.get(`/obras/${obraId}/sequenciamento`)])
      .then(([obraRes, seqRes]) => {
        setObra(obraRes.data.data || obraRes.data);
        setSeq(seqRes.data.data || seqRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [obraId]);

  const loadTemplates = async () => {
    try {
      const res = await api.get('/sequenciamento-templates');
      setTemplates(res.data.data || res.data || []);
    } catch {}
  };

  const handleShowCreate = async () => {
    await loadTemplates();
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!selectedTemplate) { setCreateError('Selecione um template.'); return; }
    setCreating(true);
    setCreateError('');
    try {
      const res = await api.post(`/obras/${obraId}/sequenciamento`, { templateId: selectedTemplate });
      setSeq(res.data.data || res.data);
      setShowCreate(false);
    } catch (e: any) {
      setCreateError(e?.response?.data?.error?.message || 'Erro ao criar sequenciamento.');
    } finally {
      setCreating(false);
    }
  };

  const refresh = async () => {
    const res = await api.get(`/obras/${obraId}/sequenciamento`);
    setSeq(res.data.data || res.data);
  };

  const handleStart = async (etapa: Etapa) => {
    setActionLoading(etapa.id + '-start');
    try {
      await api.patch(`/obras/${obraId}/etapas/${etapa.id}/start`, {});
      await refresh();
    } catch (e: any) { alert(e?.response?.data?.error?.message || 'Erro ao iniciar etapa.'); }
    finally { setActionLoading(null); }
  };

  const handleApprove = async (etapa: Etapa) => {
    setActionLoading(etapa.id + '-approve');
    try {
      await api.patch(`/obras/${obraId}/etapas/${etapa.id}/approve`, {});
      await refresh();
    } catch (e: any) { alert(e?.response?.data?.error?.message || 'Erro ao aprovar etapa.'); }
    finally { setActionLoading(null); }
  };

  const handleSubmit = async () => {
    if (!submitModal) return;
    if (!submitForm.gestorNotes.trim()) { setModalError('Notas do gestor são obrigatórias.'); return; }
    setActionLoading(submitModal.id + '-submit');
    setModalError('');
    try {
      await api.patch(`/obras/${obraId}/etapas/${submitModal.id}/submit`, {
        gestorNotes: submitForm.gestorNotes,
        evidenciaDescricao: submitForm.evidenciaDescricao || undefined,
        evidenciaFotos: submitForm.evidenciaFotos,
      });
      await refresh();
      setSubmitModal(null);
      setSubmitForm({ gestorNotes: '', evidenciaDescricao: '', evidenciaFotos: [] });
    } catch (e: any) { setModalError(e?.response?.data?.error?.message || 'Erro ao submeter etapa.'); }
    finally { setActionLoading(null); }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    if (!rejectForm.rejectionReason.trim()) { setModalError('Motivo da rejeição é obrigatório.'); return; }
    setActionLoading(rejectModal.id + '-reject');
    setModalError('');
    try {
      await api.patch(`/obras/${obraId}/etapas/${rejectModal.id}/reject`, rejectForm);
      await refresh();
      setRejectModal(null);
      setRejectForm({ rejectionReason: '', coordenadorNotes: '' });
    } catch (e: any) { setModalError(e?.response?.data?.error?.message || 'Erro ao rejeitar etapa.'); }
    finally { setActionLoading(null); }
  };

  const handleFotoEvidencia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingFoto(true);
    try {
      const urls = await Promise.all(files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post('/uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        const url = res.data.data?.url || res.data.url;
        return `${API_BASE.replace('/v1', '')}${url}`;
      }));
      setSubmitForm(prev => ({ ...prev, evidenciaFotos: [...prev.evidenciaFotos, ...urls] }));
    } catch { setModalError('Erro ao fazer upload da foto.'); }
    finally { setUploadingFoto(false); }
  };

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-[var(--ber-carbon-light)]">
      <div className="w-5 h-5 border-2 border-[var(--ber-olive)] border-t-transparent rounded-full animate-spin" />
      Carregando...
    </div>
  );

  const etapas = seq?.etapas || [];
  const total = etapas.length;
  const aprovadas = etapas.filter(e => e.status === 'aprovada').length;
  const progress = total > 0 ? Math.round((aprovadas / total) * 100) : 0;
  const isFrozen = !!seq?.frozenAt;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <button onClick={() => router.push('/sequenciamento')} className="flex items-center gap-2 text-sm text-[var(--ber-carbon-light)] hover:text-[var(--ber-carbon)] mb-4 transition-colors">
          <ArrowLeft size={16} />Sequenciamento
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--ber-carbon)]">{obra?.name || 'Obra'}</h1>
            {seq?.template && <p className="text-sm text-[var(--ber-carbon-light)] mt-1">{seq.template.name} — {seq.template.segment}</p>}
          </div>
          <div className="flex gap-2">
            {isFrozen && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium border border-gray-200">
                <Lock size={12} />Congelado
              </span>
            )}
            {!seq && (
              <button onClick={handleShowCreate} className="flex items-center gap-2 px-4 py-2 bg-[var(--ber-olive)] text-white rounded-lg text-sm font-medium hover:opacity-90">
                <Plus size={16} />Criar Sequenciamento
              </button>
            )}
          </div>
        </div>

        {total > 0 && (
          <div className="mt-4 bg-white rounded-xl border border-[var(--ber-border)] p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-[var(--ber-carbon-light)]">{aprovadas} de {total} etapas aprovadas</span>
              <span className="font-semibold text-[var(--ber-carbon)]">{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-[var(--ber-olive)]'}`} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Sem sequenciamento */}
      {!seq && !showCreate && (
        <div className="bg-white rounded-xl border border-[var(--ber-border)] p-12 text-center">
          <p className="text-[var(--ber-carbon-light)] text-sm mb-4">Nenhum sequenciamento configurado para esta obra.</p>
          <button onClick={handleShowCreate} className="flex items-center gap-2 px-4 py-2 bg-[var(--ber-olive)] text-white rounded-lg text-sm font-medium hover:opacity-90 mx-auto">
            <Plus size={16} />Criar Sequenciamento
          </button>
        </div>
      )}

      {/* Criar sequenciamento */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-[var(--ber-border)] p-6 mb-6">
          <h2 className="text-base font-semibold text-[var(--ber-carbon)] mb-4">Escolha um template</h2>
          {createError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{createError}</div>}
          {templates.length === 0 ? (
            <p className="text-sm text-[var(--ber-carbon-light)]">Nenhum template disponível.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {templates.map(t => (
                <button key={t.id} onClick={() => setSelectedTemplate(t.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${selectedTemplate === t.id ? 'border-[var(--ber-olive)] bg-[var(--ber-olive)]/5' : 'border-[var(--ber-border)] hover:border-[var(--ber-olive)]'}`}>
                  <p className="font-medium text-[var(--ber-carbon)] text-sm">{t.name}</p>
                  <p className="text-xs text-[var(--ber-carbon-light)] mt-0.5">{t.segment} · {t.etapas.length} etapas</p>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-[var(--ber-border)] rounded-lg text-sm text-[var(--ber-carbon-light)] hover:bg-[var(--ber-offwhite)]">Cancelar</button>
            <button onClick={handleCreate} disabled={creating || !selectedTemplate} className="flex-1 px-4 py-2 bg-[var(--ber-olive)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {creating ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de etapas */}
      {seq && etapas.length > 0 && (
        <div className="space-y-2">
          {etapas.map((etapa) => {
            const cfg = statusConfig[etapa.status] || statusConfig.nao_iniciada;
            const Icon = cfg.icon;
            const isOpen = expanded[etapa.id];
            const isActioning = actionLoading?.startsWith(etapa.id);
            return (
              <div key={etapa.id} className="bg-white rounded-xl border border-[var(--ber-border)] overflow-hidden">
                <button onClick={() => setExpanded(prev => ({ ...prev, [etapa.id]: !prev[etapa.id] }))}
                  className="w-full flex items-center gap-4 p-4 hover:bg-[var(--ber-offwhite)] transition-colors text-left">
                  <span className="text-xs font-bold text-[var(--ber-carbon-light)] w-6 text-center">{etapa.order}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-[var(--ber-carbon)]">{etapa.name}</span>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                        <Icon size={10} />{cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--ber-carbon-light)] mt-0.5">{etapa.discipline} · {etapa.estimatedDays} dia{etapa.estimatedDays !== 1 ? 's' : ''}</p>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-[var(--ber-carbon-light)] flex-shrink-0" /> : <ChevronDown size={16} className="text-[var(--ber-carbon-light)] flex-shrink-0" />}
                </button>
                {isOpen && (
                  <div className="border-t border-[var(--ber-border)] p-4 space-y-3">
                    {(etapa.startDate || etapa.estimatedEndDate || etapa.endDate) && (
                      <div className="flex gap-4 flex-wrap text-xs text-[var(--ber-carbon-light)]">
                        {etapa.startDate && <span>Início: {new Date(etapa.startDate).toLocaleDateString('pt-BR')}</span>}
                        {etapa.estimatedEndDate && <span>Previsão: {new Date(etapa.estimatedEndDate).toLocaleDateString('pt-BR')}</span>}
                        {etapa.endDate && <span>Conclusão: {new Date(etapa.endDate).toLocaleDateString('pt-BR')}</span>}
                      </div>
                    )}
                    {etapa.gestorNotes && <div className="text-sm text-[var(--ber-carbon)] bg-[var(--ber-offwhite)] rounded-lg p-3"><span className="text-xs font-medium text-[var(--ber-carbon-light)] block mb-1">Notas do gestor</span>{etapa.gestorNotes}</div>}
                    {etapa.rejectionReason && <div className="text-sm text-red-700 bg-red-50 rounded-lg p-3 border border-red-200"><span className="text-xs font-medium block mb-1">Motivo da rejeição</span>{etapa.rejectionReason}</div>}
                    {etapa.coordenadorNotes && <div className="text-sm text-[var(--ber-carbon)] bg-[var(--ber-offwhite)] rounded-lg p-3"><span className="text-xs font-medium text-[var(--ber-carbon-light)] block mb-1">Notas do coordenador</span>{etapa.coordenadorNotes}</div>}
                    {etapa.evidenciaDescricao && <div className="text-sm text-[var(--ber-carbon)] bg-[var(--ber-offwhite)] rounded-lg p-3"><span className="text-xs font-medium text-[var(--ber-carbon-light)] block mb-1">Evidência</span>{etapa.evidenciaDescricao}</div>}
                    {etapa.evidenciaFotos && etapa.evidenciaFotos.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {etapa.evidenciaFotos.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt={`Evidência ${i+1}`} className="w-16 h-16 object-cover rounded-lg border border-[var(--ber-border)] hover:opacity-80 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap pt-1">
                      {etapa.status === 'nao_iniciada' && isFrozen && (
                        <button onClick={() => handleStart(etapa)} disabled={!!isActioning}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--ber-olive)] text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
                          {isActioning ? <Loader2 size={12} className="animate-spin" /> : <PlayCircle size={12} />}Iniciar
                        </button>
                      )}
                      {etapa.status === 'em_andamento' && (
                        <button onClick={() => { setSubmitModal(etapa); setModalError(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--ber-olive)] text-white rounded-lg text-xs font-medium hover:opacity-90">
                          <CheckCircle size={12} />Submeter para aprovação
                        </button>
                      )}
                      {etapa.status === 'aguardando_aprovacao' && (
                        <>
                          <button onClick={() => handleApprove(etapa)} disabled={!!isActioning}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50">
                            {isActioning ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}Aprovar
                          </button>
                          <button onClick={() => { setRejectModal(etapa); setModalError(''); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:opacity-90">
                            <XCircle size={12} />Rejeitar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Submeter */}
      {submitModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[var(--ber-border)]">
              <h2 className="text-lg font-semibold text-[var(--ber-carbon)]">Submeter: {submitModal.name}</h2>
              <button onClick={() => setSubmitModal(null)}><X size={20} className="text-[var(--ber-carbon-light)]" /></button>
            </div>
            <div className="p-6 space-y-4">
              {modalError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{modalError}</div>}
              <div>
                <label className="block text-xs font-medium text-[var(--ber-carbon-light)] mb-1.5">Notas do gestor <span className="text-red-500">*</span></label>
                <textarea value={submitForm.gestorNotes} onChange={e => setSubmitForm(p => ({ ...p, gestorNotes: e.target.value }))} rows={3} placeholder="Descreva o que foi realizado..." className="w-full border border-[var(--ber-border)] rounded-lg px-3 py-2 text-sm text-[var(--ber-carbon)] focus:outline-none focus:border-[var(--ber-olive)] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ber-carbon-light)] mb-1.5">Descrição da evidência</label>
                <textarea value={submitForm.evidenciaDescricao} onChange={e => setSubmitForm(p => ({ ...p, evidenciaDescricao: e.target.value }))} rows={2} placeholder="Opcional..." className="w-full border border-[var(--ber-border)] rounded-lg px-3 py-2 text-sm text-[var(--ber-carbon)] focus:outline-none focus:border-[var(--ber-olive)] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ber-carbon-light)] mb-1.5">Fotos de evidência</label>
                <input type="file" accept="image/*" multiple onChange={handleFotoEvidencia} className="hidden" id="foto-evidencia" />
                <button type="button" onClick={() => document.getElementById('foto-evidencia')?.click()} disabled={uploadingFoto}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[var(--ber-border)] rounded-lg py-3 text-sm text-[var(--ber-carbon-light)] hover:border-[var(--ber-olive)] hover:text-[var(--ber-olive)] transition-colors disabled:opacity-50">
                  {uploadingFoto ? <><Loader2 size={16} className="animate-spin" />Enviando...</> : <><Camera size={16} />Adicionar fotos</>}
                </button>
                {submitForm.evidenciaFotos.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {submitForm.evidenciaFotos.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} alt={`Evidência ${i+1}`} className="w-16 h-16 object-cover rounded-lg border border-[var(--ber-border)]" />
                        <button onClick={() => setSubmitForm(p => ({ ...p, evidenciaFotos: p.evidenciaFotos.filter((_, idx) => idx !== i) }))}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-[var(--ber-border)]">
              <button onClick={() => setSubmitModal(null)} className="flex-1 px-4 py-2 border border-[var(--ber-border)] rounded-lg text-sm text-[var(--ber-carbon-light)] hover:bg-[var(--ber-offwhite)]">Cancelar</button>
              <button onClick={handleSubmit} disabled={!!actionLoading} className="flex-1 px-4 py-2 bg-[var(--ber-olive)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">{actionLoading ? 'Salvando...' : 'Submeter'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rejeitar */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-[var(--ber-border)]">
              <h2 className="text-lg font-semibold text-[var(--ber-carbon)]">Rejeitar: {rejectModal.name}</h2>
              <button onClick={() => setRejectModal(null)}><X size={20} className="text-[var(--ber-carbon-light)]" /></button>
            </div>
            <div className="p-6 space-y-4">
              {modalError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{modalError}</div>}
              <div>
                <label className="block text-xs font-medium text-[var(--ber-carbon-light)] mb-1.5">Motivo da rejeição <span className="text-red-500">*</span></label>
                <textarea value={rejectForm.rejectionReason} onChange={e => setRejectForm(p => ({ ...p, rejectionReason: e.target.value }))} rows={3} placeholder="Descreva o motivo..." className="w-full border border-[var(--ber-border)] rounded-lg px-3 py-2 text-sm text-[var(--ber-carbon)] focus:outline-none focus:border-[var(--ber-olive)] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ber-carbon-light)] mb-1.5">Notas do coordenador</label>
                <textarea value={rejectForm.coordenadorNotes} onChange={e => setRejectForm(p => ({ ...p, coordenadorNotes: e.target.value }))} rows={2} placeholder="Opcional..." className="w-full border border-[var(--ber-border)] rounded-lg px-3 py-2 text-sm text-[var(--ber-carbon)] focus:outline-none focus:border-[var(--ber-olive)] resize-none" />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-[var(--ber-border)]">
              <button onClick={() => setRejectModal(null)} className="flex-1 px-4 py-2 border border-[var(--ber-border)] rounded-lg text-sm text-[var(--ber-carbon-light)] hover:bg-[var(--ber-offwhite)]">Cancelar</button>
              <button onClick={handleReject} disabled={!!actionLoading} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">{actionLoading ? 'Salvando...' : 'Rejeitar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
