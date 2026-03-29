'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
  Package, ArrowLeft, Plus, X, CheckCircle, AlertTriangle,
  XCircle, FileText, StickyNote, Camera, ImagePlus, Loader2,
} from 'lucide-react';

interface Recebimento {
  id: string;
  fornecedor: string;
  material: string;
  quantidade: number;
  unidade: string;
  numeroNF?: string;
  dataNF?: string;
  dataEntrega: string;
  condicao: 'aprovado' | 'aprovado_com_ressalva' | 'reprovado';
  observacao?: string;
  fotosMaterial?: string[];
  fotoNF?: string;
  createdAt: string;
}

interface Obra {
  id: string;
  name: string;
  status: string;
}

const condicaoConfig = {
  aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle, iconColor: 'text-green-500' },
  aprovado_com_ressalva: { label: 'Com Ressalva', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: AlertTriangle, iconColor: 'text-yellow-500' },
  reprovado: { label: 'Reprovado', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, iconColor: 'text-red-500' },
};

const emptyForm = {
  fornecedor: '', material: '', quantidade: '', unidade: '',
  numeroNF: '', dataNF: '', dataEntrega: '',
  condicao: 'aprovado' as const, observacao: '',
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

export default function RecebimentosObraPage() {
  const params = useParams();
  const router = useRouter();
  const obraId = params.id as string;

  const [obra, setObra] = useState<Obra | null>(null);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterCondicao, setFilterCondicao] = useState<string>('todos');
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  // Foto state
  const [fotosMaterial, setFotosMaterial] = useState<string[]>([]);
  const [fotoNF, setFotoNF] = useState<string>('');
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [uploadingNF, setUploadingNF] = useState(false);

  const fotoMaterialRef = useRef<HTMLInputElement>(null);
  const fotoNFRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!obraId) return;
    Promise.all([api.get(`/obras/${obraId}`), api.get(`/obras/${obraId}/recebimentos`)])
      .then(([obraRes, recRes]) => {
        setObra(obraRes.data.data || obraRes.data);
        const data = recRes.data.data || recRes.data;
        setRecebimentos(Array.isArray(data) ? data : []);
      })
      .catch(() => setRecebimentos([]))
      .finally(() => setLoading(false));
  }, [obraId]);

  const uploadFoto = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const url = res.data.data?.url || res.data.url;
    return `${API_BASE.replace('/v1', '')}${url}`;
  };

  const handleFotoMaterial = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingMaterial(true);
    try {
      const urls = await Promise.all(files.map(uploadFoto));
      setFotosMaterial(prev => [...prev, ...urls]);
    } catch {
      setError('Erro ao fazer upload da foto do material.');
    } finally {
      setUploadingMaterial(false);
      if (fotoMaterialRef.current) fotoMaterialRef.current.value = '';
    }
  };

  const handleFotoNF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingNF(true);
    try {
      const url = await uploadFoto(file);
      setFotoNF(url);
    } catch {
      setError('Erro ao fazer upload da foto da NF.');
    } finally {
      setUploadingNF(false);
      if (fotoNFRef.current) fotoNFRef.current.value = '';
    }
  };

  const resetForm = () => {
    setForm(emptyForm);
    setFotosMaterial([]);
    setFotoNF('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!form.fornecedor || !form.material || !form.quantidade || !form.unidade || !form.dataEntrega) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post(`/obras/${obraId}/recebimentos`, {
        ...form,
        quantidade: parseFloat(form.quantidade),
        dataNF: form.dataNF || undefined,
        numeroNF: form.numeroNF || undefined,
        observacao: form.observacao || undefined,
        fotosMaterial,
        fotoNF: fotoNF || undefined,
      });
      const novo = res.data.data || res.data;
      setRecebimentos(prev => [novo, ...prev]);
      resetForm();
      setShowForm(false);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || 'Erro ao salvar recebimento.');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = filterCondicao === 'todos' ? recebimentos : recebimentos.filter(r => r.condicao === filterCondicao);

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-[var(--ber-carbon-light)]">
      <div className="w-5 h-5 border-2 border-[var(--ber-olive)] border-t-transparent rounded-full animate-spin" />
      Carregando...
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <button onClick={() => router.push('/recebimentos')} className="flex items-center gap-2 text-sm text-[var(--ber-carbon-light)] hover:text-[var(--ber-carbon)] mb-4 transition-colors">
          <ArrowLeft size={16} />
          Recebimentos
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[var(--ber-carbon)]">{obra?.name || 'Obra'}</h1>
            <p className="text-sm text-[var(--ber-carbon-light)] mt-1">{recebimentos.length} recebimento{recebimentos.length !== 1 ? 's' : ''} registrado{recebimentos.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-[var(--ber-olive)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={16} />
            Novo Recebimento
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['todos', 'aprovado', 'aprovado_com_ressalva', 'reprovado'].map(f => (
          <button key={f} onClick={() => setFilterCondicao(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filterCondicao === f ? 'bg-[var(--ber-olive)] text-white border-[var(--ber-olive)]' : 'bg-white text-[var(--ber-carbon-light)] border-[var(--ber-border)] hover:border-[var(--ber-olive)]'}`}>
            {f === 'todos' ? 'Todos' : condicaoConfig[f as keyof typeof condicaoConfig]?.label}
            {f !== 'todos' && <span className="ml-1.5 opacity-70">({recebimentos.filter(r => r.condicao === f).length})</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--ber-border)] p-12 text-center">
          <Package size={32} className="text-[var(--ber-carbon-light)] mx-auto mb-3 opacity-40" />
          <p className="text-[var(--ber-carbon-light)] text-sm">{filterCondicao === 'todos' ? 'Nenhum recebimento registrado.' : 'Nenhum recebimento com este filtro.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const cfg = condicaoConfig[item.condicao];
            const Icon = cfg.icon;
            return (
              <div key={item.id} className="bg-white rounded-xl border border-[var(--ber-border)] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Icon size={20} className={`mt-0.5 flex-shrink-0 ${cfg.iconColor}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[var(--ber-carbon)]">{item.material}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <p className="text-sm text-[var(--ber-carbon-light)] mt-0.5">{item.fornecedor}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-medium text-[var(--ber-carbon)]">{item.quantidade} {item.unidade}</p>
                    <p className="text-xs text-[var(--ber-carbon-light)] mt-0.5">{new Date(item.dataEntrega).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                {(item.numeroNF || item.observacao || (item.fotosMaterial && item.fotosMaterial.length > 0) || item.fotoNF) && (
                  <div className="mt-3 pt-3 border-t border-[var(--ber-border)] space-y-2">
                    <div className="flex gap-4 flex-wrap">
                      {item.numeroNF && <span className="flex items-center gap-1.5 text-xs text-[var(--ber-carbon-light)]"><FileText size={12} />NF {item.numeroNF}</span>}
                      {item.observacao && <span className="flex items-center gap-1.5 text-xs text-[var(--ber-carbon-light)]"><StickyNote size={12} />{item.observacao}</span>}
                    </div>
                    {item.fotosMaterial && item.fotosMaterial.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {item.fotosMaterial.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt={`Material ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-[var(--ber-border)] hover:opacity-80 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    )}
                    {item.fotoNF && (
                      <a href={item.fotoNF} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-[var(--ber-olive)] hover:underline">
                        <FileText size={12} />Ver Nota Fiscal
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl w-full max-w-lg max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[var(--ber-border)]">
              <h2 className="text-lg font-semibold text-[var(--ber-carbon)]">Novo Recebimento</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }}><X size={20} className="text-[var(--ber-carbon-light)]" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

              <div>
                <label className="block text-xs font-medium text-[var(--ber-carbon-light)] mb-1.5">Material <span className="text-red-500">*</span></label>
                <input type="text" value={form.material} onChange={e => setForm(p => ({ ...p, material: e.target.value }))} placeholder="Ex: Cimento CP-II, Vergalhão 10mm..." className="w-full border border-[var(--ber-border)] rounded-lg px-3 py-2 text-sm text-[var(--ber-carbon)] focus:outline-none focus:border-[var(--ber-olive)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ber-carbon-light)] mb-1.5">Fornecedor <span className="text-red-500">*</span></label>
                <input type="text" value={form.fornecedor} onChange={e => setForm(p => ({ ...p, fornecedor: e.target.value }))} placeholder="Nome do fornecedor" className="w-full border border-[var(--ber-border)] rounded-lg px-3 py-2 text-sm text-[var(--ber-carbon)] focus:outline-none focus:border-[var(--ber-olive)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ber-carbon-light)] mb-1.5">Quantidade <span className="text-red-500">*</span></label>
                  <input type="number" value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} placeholder="0" min="0" className="w-full border border-[var(--ber-border)] rounded-lg px-3 py-2 text-sm text-[var(--ber-carbon)] focus:outline-none focus:border-[var(--ber-olive)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ber-carbon-light)] mb-1.5">Unidade <span className="text-red-500">*</span></label>
                  <input type="text" value={form.unidade} onChange={e => setForm(p => ({ ...p, unidade: e.target.value }))} placeholder="kg, m², un, saco..." className="w-full border border-[var(--ber-border)] rounded-lg px-3 py-2 text-sm text-[var(--ber-carbon)] focus:outline-none focus:border-[var(--ber-olive)]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ber-carbon-light)] mb-1.5">Data de Entrega <span className="text-red-500">*</span></label>
                <input type="date" value={form.dataEntrega} onChange={e => setForm(p => ({ ...p, dataEntrega: e.target.value }))} className="w-full border border-[var(--ber-border)] rounded-lg px-3 py-2 text-sm text-[var(--ber-carbon)] focus:outline-none focus:border-[var(--ber-olive)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--ber-carbon-light)] mb-1.5">Nº Nota Fiscal</label>
                  <input type="text" value={form.numeroNF} onChange={e => setForm(p => ({ ...p, numeroNF: e.target.value }))} placeholder="Opcional" className="w-full border border-[var(--ber-border)] rounded-lg px-3 py-2 text-sm text-[var(--ber-carbon)] focus:outline-none focus:border-[var(--ber-olive)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--ber-carbon-light)] mb-1.5">Data NF</label>
                  <input type="date" value={form.dataNF} onChange={e => setForm(p => ({ ...p, dataNF: e.target.value }))} className="w-full border border-[var(--ber-border)] rounded-lg px-3 py-2 text-sm text-[var(--ber-carbon)] focus:outline-none focus:border-[var(--ber-olive)]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ber-carbon-light)] mb-1.5">Condição</label>
                <select value={form.condicao} onChange={e => setForm(p => ({ ...p, condicao: e.target.value as any }))} className="w-full border border-[var(--ber-border)] rounded-lg px-3 py-2 text-sm text-[var(--ber-carbon)] focus:outline-none focus:border-[var(--ber-olive)] bg-white">
                  <option value="aprovado">Aprovado</option>
                  <option value="aprovado_com_ressalva">Com Ressalva</option>
                  <option value="reprovado">Reprovado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--ber-carbon-light)] mb-1.5">Observação</label>
                <textarea value={form.observacao} onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))} placeholder="Observações sobre o recebimento..." rows={3} className="w-full border border-[var(--ber-border)] rounded-lg px-3 py-2 text-sm text-[var(--ber-carbon)] focus:outline-none focus:border-[var(--ber-olive)] resize-none" />
              </div>

              {/* Fotos do Material */}
              <div>
                <label className="block text-xs font-medium text-[var(--ber-carbon-light)] mb-1.5">Fotos do Material</label>
                <input ref={fotoMaterialRef} type="file" accept="image/*" multiple capture="environment" onChange={handleFotoMaterial} className="hidden" />
                <button type="button" onClick={() => fotoMaterialRef.current?.click()}
                  disabled={uploadingMaterial}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[var(--ber-border)] rounded-lg py-3 text-sm text-[var(--ber-carbon-light)] hover:border-[var(--ber-olive)] hover:text-[var(--ber-olive)] transition-colors disabled:opacity-50">
                  {uploadingMaterial ? <><Loader2 size={16} className="animate-spin" />Enviando...</> : <><Camera size={16} />Tirar foto ou selecionar imagem</>}
                </button>
                {fotosMaterial.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {fotosMaterial.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} alt={`Material ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-[var(--ber-border)]" />
                        <button onClick={() => setFotosMaterial(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Foto da NF */}
              <div>
                <label className="block text-xs font-medium text-[var(--ber-carbon-light)] mb-1.5">Foto da Nota Fiscal</label>
                <input ref={fotoNFRef} type="file" accept="image/*" onChange={handleFotoNF} className="hidden" id="fotoNF-gallery" />
                <input ref={fotoNFRef} type="file" accept="image/*" capture="environment" onChange={handleFotoNF} className="hidden" id="fotoNF-camera" />
                {fotoNF ? (
                  <div className="relative inline-block">
                    <img src={fotoNF} alt="NF" className="w-24 h-24 object-cover rounded-lg border border-[var(--ber-border)]" />
                    <button onClick={() => setFotoNF('')}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => document.getElementById('fotoNF-camera')?.click()}
                      disabled={uploadingNF}
                      className="flex items-center justify-center gap-2 border-2 border-dashed border-[var(--ber-border)] rounded-lg py-3 text-sm text-[var(--ber-carbon-light)] hover:border-[var(--ber-olive)] hover:text-[var(--ber-olive)] transition-colors disabled:opacity-50">
                      {uploadingNF ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                      Tirar foto
                    </button>
                    <button type="button" onClick={() => document.getElementById('fotoNF-gallery')?.click()}
                      disabled={uploadingNF}
                      className="flex items-center justify-center gap-2 border-2 border-dashed border-[var(--ber-border)] rounded-lg py-3 text-sm text-[var(--ber-carbon-light)] hover:border-[var(--ber-olive)] hover:text-[var(--ber-olive)] transition-colors disabled:opacity-50">
                      {uploadingNF ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                      Galeria
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-[var(--ber-border)]">
              <button onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 px-4 py-2 border border-[var(--ber-border)] rounded-lg text-sm text-[var(--ber-carbon-light)] hover:bg-[var(--ber-offwhite)] transition-colors">Cancelar</button>
              <button onClick={handleSubmit} disabled={submitting} className="flex-1 px-4 py-2 bg-[var(--ber-olive)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
