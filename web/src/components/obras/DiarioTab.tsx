'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import {
  Plus, X, Lock, Unlock, Sun, Cloud, CloudSun, CloudRain, Zap,
  Users, ClipboardList, AlertTriangle, UserCheck, Package, Wrench, ChevronDown, ChevronUp,
  Loader2, Camera, Link2, Eye, CheckCircle2, XCircle, Trash2,
} from 'lucide-react';

interface Obra {
  id: string;
  name: string;
  client: string | null;
}

interface DiarioSummary {
  id: string;
  data: string;
  status: 'rascunho' | 'fechado' | 'aprovado' | 'recusado';
  clima: string | null;
  condicaoTrabalho: string | null;
  _count: { efetivos: number; atividades: number; fotos: number };
  criadoPor: { id: string; name: string };
}

interface Efetivo {
  id: string;
  nomeExterno: string | null;
  funcao: string | null;
  categoria: string | null;
  quantidade: number;
  presente: boolean;
  user: { id: string; name: string } | null;
}
interface Atividade { id: string; descricao: string; status: string; obraEtapaId: string | null }
interface Ocorrencia { id: string; tipo: string; descricao: string; visivelCliente: boolean }
interface Visita { id: string; tipo: string; nome: string | null; observacao: string | null }
interface Material { id: string; descricao: string; quantidade: number | null; unidade: string | null }
interface Equipamento { id: string; nome: string }
interface Foto { id: string; fileUrl: string; legenda: string | null; ordem: number }
interface ObraEtapa {
  id: string; name: string; discipline: string; order: number; status: string;
  startDate: string | null; endDate: string | null; estimatedEndDate: string | null; estimatedDays: number;
}

interface CronogramaTarefa {
  wbs: string; nome: string; inicio: string | null; fim: string | null;
  duracaoDias: number | null; percentualConcluido: number; ehResumo: boolean; nivel: number;
}
interface CronogramaData {
  id: string;
  progressPct: number | null;
  parsedData: { progressoGeral: number; tarefas: CronogramaTarefa[] } | null;
}

interface DiarioDetalhe {
  id: string; data: string; clima: string | null; condicaoTrabalho: string | null;
  observacoesInternas: string | null; observacoesCliente: string | null;
  avancoDia: number | null; tokenPublico: string | null;
  status: 'rascunho' | 'fechado' | 'aprovado' | 'recusado';
  fechadoEm: string | null;
  criadoPor: { id: string; name: string };
  fechadoPor: { id: string; name: string } | null;
  efetivos: Efetivo[]; atividades: Atividade[]; ocorrencias: Ocorrencia[];
  visitas: Visita[]; materiais: Material[]; equipamentos: Equipamento[]; fotos: Foto[];
}

const CLIMA_OPTIONS = ['sol', 'parcialmente_nublado', 'nublado', 'chuva', 'tempestade'] as const;
const CLIMA_LABELS: Record<string, string> = {
  sol: 'Sol', parcialmente_nublado: 'Parcialmente nublado', nublado: 'Nublado',
  chuva: 'Chuva', tempestade: 'Tempestade',
};
const CLIMA_SHORT: Record<string, string> = {
  sol: 'Sol', parcialmente_nublado: 'Parcial', nublado: 'Nublado',
  chuva: 'Chuva', tempestade: 'Tempest.',
};
const CLIMA_ICONS: Record<string, React.ReactNode> = {
  sol: <Sun size={14} className="text-yellow-500" />,
  parcialmente_nublado: <CloudSun size={14} className="text-yellow-500" />,
  nublado: <Cloud size={14} className="text-ber-gray" />,
  chuva: <CloudRain size={14} className="text-blue-500" />,
  tempestade: <Zap size={14} className="text-purple-600" />,
};
const CLIMA_ICONS_WHITE: Record<string, React.ReactNode> = {
  sol: <Sun size={14} className="text-white" />,
  parcialmente_nublado: <CloudSun size={14} className="text-white" />,
  nublado: <Cloud size={14} className="text-white" />,
  chuva: <CloudRain size={14} className="text-white" />,
  tempestade: <Zap size={14} className="text-white" />,
};
const COND_OPTIONS = ['normal', 'parcial', 'interrompido'] as const;
const COND_LABELS: Record<string, string> = { normal: 'Normal', parcial: 'Parcial', interrompido: 'Interrompido' };
const ATIVIDADE_STATUS = ['em_andamento', 'concluida', 'nao_realizada', 'parcial'] as const;
const ATIVIDADE_STATUS_LABELS: Record<string, string> = {
  em_andamento: 'Em andamento', concluida: 'Concluída', nao_realizada: 'Não realizada', parcial: 'Parcial',
};
const OCORRENCIA_TIPOS = ['incidente', 'imprevisto', 'atraso', 'qualidade', 'seguranca', 'outro'] as const;
const VISITA_TIPOS = ['cliente', 'fiscalizacao', 'fornecedor', 'projetista', 'outro'] as const;
const EFETIVO_CATEGORIAS = [
  { value: 'pedreiro', label: 'Pedreiro' },
  { value: 'servente', label: 'Servente' },
  { value: 'encarregado', label: 'Encarregado' },
  { value: 'eletricista', label: 'Eletricista' },
  { value: 'carpinteiro', label: 'Carpinteiro' },
  { value: 'armador', label: 'Armador' },
  { value: 'pintor', label: 'Pintor' },
  { value: 'gesseiro', label: 'Gesseiro' },
  { value: 'outro', label: 'Outro' },
];
const UNIDADES = ['un', 'kg', 'm²', 'm³', 'm', 'saco', 'rolo', 'cx', 'lt', 'pç'];

function fmtDate(iso: string) {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDateShort(iso: string) {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

function Section({ title, icon, count, open, onToggle, children }: {
  title: string; icon: React.ReactNode; count: number;
  open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ber-border bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-ber-carbon">{title}</span>
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-ber-gray">{count}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-ber-gray" /> : <ChevronDown size={14} className="text-ber-gray" />}
      </button>
      {open && <div className="border-t border-ber-border px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
}

function PreviewFecharModal({ diario, obraNome, onConfirm, onCancel, saving }: {
  diario: DiarioDetalhe; obraNome: string;
  onConfirm: (enviarWhatsapp: boolean) => void;
  onCancel: () => void; saving: boolean;
}) {
  const totalEfetivos = diario.efetivos.reduce((acc, e) => acc + (e.quantidade || 1), 0);
  const dataFmt = fmtDateShort(diario.data);
  const primeiraAtividade = diario.atividades.find(a => a.status === 'em_andamento' || a.status === 'concluida');

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="px-5 pt-5 pb-3 border-b border-ber-border">
          <p className="text-sm font-bold text-ber-carbon">Preview — o que o cliente vai receber</p>
        </div>
        <div className="px-5 py-4 space-y-1.5 text-sm text-ber-carbon bg-gray-50 mx-4 my-3 rounded-xl border border-ber-border">
          <p>📍 <span className="font-semibold">{obraNome}</span> — {dataFmt}</p>
          {diario.clima && <p>{CLIMA_ICONS[diario.clima]} {CLIMA_LABELS[diario.clima]} · Trabalho {COND_LABELS[diario.condicaoTrabalho ?? 'normal']?.toLowerCase()}</p>}
          <p>👷 <span className="font-semibold">{totalEfetivos}</span> profissionais presentes</p>
          {diario.avancoDia != null && <p>📊 Avanço acumulado: <span className="font-semibold">{diario.avancoDia}%</span></p>}
          {diario.fotos.length > 0 && <p>📸 {diario.fotos.length} fotos adicionadas</p>}
          {diario.observacoesCliente && <p>📝 {diario.observacoesCliente}</p>}
          {primeiraAtividade && <p>➡️ {primeiraAtividade.descricao}</p>}
          <p className="text-xs text-blue-600">🔗 Link público será gerado ao fechar</p>
        </div>
        <div className="px-5 pb-5 space-y-2">
          <button onClick={() => onConfirm(true)} disabled={saving}
            className="w-full rounded-lg bg-ber-olive px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Fechar e enviar para cliente
          </button>
          <button onClick={() => onConfirm(false)} disabled={saving}
            className="w-full rounded-lg border border-ber-border px-4 py-2 text-sm text-ber-gray hover:bg-gray-50 disabled:opacity-60">
            Fechar sem enviar
          </button>
          <button onClick={onCancel} className="w-full text-xs text-ber-gray hover:text-ber-carbon py-1">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default function DiarioTab({ obraId, obraNome }: { obraId: string; obraNome?: string }) {
  const [obra, setObra] = useState<Obra | null>(null);
  const [diarios, setDiarios] = useState<DiarioSummary[]>([]);
  const [selected, setSelected] = useState<DiarioDetalhe | null>(null);
  const [etapas, setEtapas] = useState<ObraEtapa[]>([]);
  const [cronograma, setCronograma] = useState<CronogramaData | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patchingHeader, setPatchingHeader] = useState(false);
  const [obsInternas, setObsInternas] = useState('');
  const [obsCliente, setObsCliente] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    fotos: true, efetivos: true, atividades: true, ocorrencias: false, visitas: false, materiais: false, equipamentos: false,
  });
  const [addingAtividade, setAddingAtividade] = useState(false);
  const [addingOcorrencia, setAddingOcorrencia] = useState(false);
  const [addingVisita, setAddingVisita] = useState(false);
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [addingEquipamento, setAddingEquipamento] = useState(false);

  const currentUser = useAuthStore((s) => s.user);
  const isCoordenacao = ['coordenacao', 'pmo', 'diretoria'].includes(currentUser?.role ?? '');
  const fechado = selected ? selected.status !== 'rascunho' : false;

  useEffect(() => {
    setObsInternas(selected?.observacoesInternas ?? '');
    setObsCliente(selected?.observacoesCliente ?? '');
  }, [selected?.id]);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const [obraRes, diariosRes, cronogramaRes] = await Promise.all([
        api.get(`/obras/${obraId}`),
        api.get(`/obras/${obraId}/diario`),
        api.get(`/obras/${obraId}/cronograma`).catch(() => ({ data: { data: null } })),
      ]);
      setObra(obraRes.data?.data ?? null);
      setDiarios(diariosRes.data?.data ?? []);
      setCronograma(cronogramaRes.data?.data ?? null);
    } finally {
      setLoadingList(false);
    }
  }, [obraId]);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const [res, etapasRes] = await Promise.all([
        api.get(`/diario/${id}`),
        api.get(`/obras/${obraId}/etapas`).catch(() => ({ data: { data: [] } })),
      ]);
      setSelected(res.data?.data ?? null);
      setEtapas(etapasRes.data?.data ?? []);
    } finally {
      setLoadingDetail(false);
    }
  }, [obraId]);

  useEffect(() => { loadList(); }, [loadList]);

  async function criarDiarioHoje() {
    setSaving(true);
    try {
      const res = await api.post(`/obras/${obraId}/diario`, { data: todayISO() });
      const novo: DiarioDetalhe = res.data?.data;
      setDiarios(prev => [{ ...novo, _count: { efetivos: 0, atividades: 0, fotos: 0 }, criadoPor: novo.criadoPor }, ...prev]);
      setSelected(novo);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erro ao criar diário');
    } finally {
      setSaving(false);
    }
  }

  async function fecharDiario(enviarWhatsapp: boolean) {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.post(`/diario/${selected.id}/fechar`, { enviarWhatsapp });
      setSelected(res.data?.data);
      setShowPreview(false);
      await loadList();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erro');
    } finally {
      setSaving(false);
    }
  }

  async function reabrirDiario() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.post(`/diario/${selected.id}/reabrir`);
      setSelected(res.data?.data);
      await loadList();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erro');
    } finally {
      setSaving(false);
    }
  }

  async function aprovarDiario() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.post(`/diario/${selected.id}/aprovar`);
      setSelected(res.data?.data);
      await loadList();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erro');
    } finally {
      setSaving(false);
    }
  }

  async function recusarDiario() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.post(`/diario/${selected.id}/recusar`);
      setSelected(res.data?.data);
      await loadList();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erro');
    } finally {
      setSaving(false);
    }
  }

  async function excluirDiario() {
    if (!selected) return;
    if (!confirm('Excluir este diário permanentemente?')) return;
    setSaving(true);
    try {
      await api.delete(`/diario/${selected.id}`);
      setSelected(null);
      await loadList();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erro');
    } finally {
      setSaving(false);
    }
  }

  async function patchHeader(data: Partial<{ clima: string; condicaoTrabalho: string; observacoesInternas: string; observacoesCliente: string; avancoDia: number }>) {
    if (!selected) return;
    setPatchingHeader(true);
    try {
      const res = await api.patch(`/diario/${selected.id}`, data);
      setSelected(res.data?.data);
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erro ao salvar');
    } finally {
      setPatchingHeader(false);
    }
  }

  function toggleSection(key: string) {
    setOpenSections(s => ({ ...s, [key]: !s[key] }));
  }

  async function deleteItem(endpoint: string, refresh: () => void) {
    if (!confirm('Remover item?')) return;
    try {
      await api.delete(endpoint);
      refresh();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erro');
    }
  }

  function refreshDetail() {
    if (selected) loadDetail(selected.id);
  }

  function FotosSection() {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploadingFoto, setUploadingFoto] = useState(false);

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
      if (!selected || !e.target.files?.length) return;
      setUploadingFoto(true);
      try {
        for (const file of Array.from(e.target.files)) {
          const form = new FormData();
          form.append('file', file);
          await api.post(`/diario/${selected.id}/fotos`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
        refreshDetail();
      } catch (ex: any) {
        alert(ex?.response?.data?.message ?? 'Erro no upload');
      } finally {
        setUploadingFoto(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    }

    return (
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {selected?.fotos.map(foto => (
            <div key={foto.id} className="relative group rounded-lg overflow-hidden border border-ber-border aspect-square bg-gray-100">
              <img src={foto.fileUrl} alt={foto.legenda ?? ''} className="w-full h-full object-cover" />
              {foto.legenda && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                  <p className="text-white text-[10px] truncate">{foto.legenda}</p>
                </div>
              )}
              {!fechado && (
                <button
                  onClick={() => deleteItem(`/diario/${selected!.id}/fotos/${foto.id}`, refreshDetail)}
                  className="absolute top-1 right-1 bg-black/60 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} className="text-white" />
                </button>
              )}
            </div>
          ))}
          {!fechado && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingFoto}
              className="aspect-square rounded-lg border-2 border-dashed border-ber-border flex flex-col items-center justify-center gap-1 hover:border-ber-olive hover:bg-ber-olive/5 transition-colors disabled:opacity-50"
            >
              {uploadingFoto ? <Loader2 size={20} className="text-ber-olive animate-spin" /> : <Camera size={20} className="text-ber-gray" />}
              <span className="text-xs text-ber-gray">{uploadingFoto ? 'Enviando…' : 'Adicionar'}</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        {selected?.fotos.length === 0 && fechado && (
          <p className="text-xs text-ber-gray text-center py-2">Nenhuma foto adicionada.</p>
        )}
      </div>
    );
  }

  function EfetivosSection() {
    const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<{ categoria: string; quantidade: number }[]>([]);
    const [showForm, setShowForm] = useState(false);
    const totalEfetivos = selected?.efetivos.reduce((acc, e) => acc + (e.quantidade || 1), 0) ?? 0;
    const porCategoria: Record<string, number> = {};
    for (const ef of selected?.efetivos ?? []) {
      const key = ef.categoria ?? ef.funcao ?? ef.user?.name ?? ef.nomeExterno ?? 'outro';
      porCategoria[key] = (porCategoria[key] ?? 0) + (ef.quantidade || 1);
    }

    async function addCategoria(categoria: string, quantidade: number) {
      if (!selected || quantidade < 1) return;
      try {
        await api.post(`/diario/${selected.id}/efetivos`, { categoria, quantidade });
        refreshDetail();
      } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
    }

    function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
      return (
        <div className="flex items-center gap-1">
          <button onClick={() => onChange(Math.max(0, value - 1))} className="w-6 h-6 rounded-md border border-ber-border text-ber-gray hover:bg-gray-100 flex items-center justify-center text-sm font-bold">−</button>
          <span className="w-6 text-center text-sm font-semibold text-ber-carbon">{value}</span>
          <button onClick={() => onChange(value + 1)} className="w-6 h-6 rounded-md border border-ber-border text-ber-gray hover:bg-gray-100 flex items-center justify-center text-sm font-bold">+</button>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {Object.entries(porCategoria).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1">
            {Object.entries(porCategoria).map(([cat, qtd]) => (
              <span key={cat} className="flex items-center gap-1 rounded-full bg-ber-olive/10 px-3 py-1 text-xs font-medium text-ber-olive">
                <span className="font-bold">{qtd}</span> {cat}
              </span>
            ))}
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-ber-carbon">{totalEfetivos} total</span>
          </div>
        )}
        {selected?.efetivos.map(ef => (
          <div key={ef.id} className="flex items-center justify-between rounded-lg bg-gray-50 border border-ber-border/50 px-3 py-2 text-sm">
            <div>
              <span className="text-ber-carbon font-medium capitalize">{ef.categoria ?? ef.user?.name ?? ef.nomeExterno ?? '—'}</span>
              {ef.quantidade > 1 && <span className="ml-2 text-xs text-ber-gray">× {ef.quantidade}</span>}
            </div>
            {!fechado && (
              <button onClick={() => deleteItem(`/diario/${selected!.id}/efetivos/${ef.id}`, refreshDetail)} className="text-ber-gray hover:text-ber-red ml-2">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!fechado && !showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1 text-xs text-ber-olive hover:underline mt-1">
            <Plus size={12} /> Adicionar por categoria
          </button>
        )}
        {!fechado && showForm && (
          <div className="rounded-lg bg-gray-50 border border-ber-border p-3 space-y-2">
            <p className="text-xs font-semibold text-ber-gray uppercase tracking-wide">Selecione quantidade por categoria</p>
            <div className="grid grid-cols-1 gap-2">
              {EFETIVO_CATEGORIAS.map(cat => {
                const item = categoriasSelecionadas.find(c => c.categoria === cat.value);
                const qtd = item?.quantidade ?? 0;
                return (
                  <div key={cat.value} className="flex items-center justify-between">
                    <span className="text-sm text-ber-carbon">{cat.label}</span>
                    <Stepper value={qtd} onChange={n => {
                      setCategoriasSelecionadas(prev => {
                        const filtered = prev.filter(c => c.categoria !== cat.value);
                        return n > 0 ? [...filtered, { categoria: cat.value, quantidade: n }] : filtered;
                      });
                    }} />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={async () => {
                  for (const { categoria, quantidade } of categoriasSelecionadas) {
                    if (quantidade > 0) await addCategoria(categoria, quantidade);
                  }
                  setCategoriasSelecionadas([]);
                  setShowForm(false);
                }}
                disabled={categoriasSelecionadas.length === 0}
                className="rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Adicionar
              </button>
              <button onClick={() => { setCategoriasSelecionadas([]); setShowForm(false); }} className="text-xs text-ber-gray hover:text-ber-carbon">Cancelar</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function AtividadesSection() {
    const [desc, setDesc] = useState('');
    const [status, setStatus] = useState<typeof ATIVIDADE_STATUS[number]>('em_andamento');
    const [etapaId, setEtapaId] = useState('');
    const diarioDate = selected?.data.slice(0, 10) ?? '';
    const etapasLinkedIds = new Set(selected?.atividades.map(a => a.obraEtapaId).filter(Boolean));
    const etapasAtivas = etapas.filter(e => {
      if (etapasLinkedIds.has(e.id)) return false;
      const inicio = e.startDate?.slice(0, 10);
      const fim = (e.endDate ?? e.estimatedEndDate)?.slice(0, 10);
      if (!inicio) return false;
      return diarioDate >= inicio && (!fim || diarioDate <= fim);
    });
    // Cronograma tarefas em andamento (iniciadas e não concluídas)
    const jaImportados = new Set(selected?.atividades.map(a => a.descricao) ?? []);
    const cronogramaAtivas = (cronograma?.parsedData?.tarefas ?? []).filter(t => {
      if (t.ehResumo || t.percentualConcluido >= 100) return false;
      if (!t.inicio) return false;
      // Mostrar se já iniciou (independente de fim — inclui atrasadas)
      return diarioDate >= t.inicio.slice(0, 10) && !jaImportados.has(t.nome);
    }).slice(0, 10); // limitar para não poluir

    async function add() {
      if (!desc.trim() || !selected) return;
      try {
        await api.post(`/diario/${selected.id}/atividades`, { descricao: desc, status, obraEtapaId: etapaId || undefined });
        setDesc(''); setAddingAtividade(false);
        refreshDetail();
      } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
    }

    async function importarEtapa(etapa: ObraEtapa) {
      if (!selected) return;
      try {
        await api.post(`/diario/${selected.id}/atividades`, { descricao: etapa.name, status: 'em_andamento', obraEtapaId: etapa.id });
        refreshDetail();
      } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
    }

    async function importarTarefaCronograma(tarefa: CronogramaTarefa) {
      if (!selected) return;
      try {
        await api.post(`/diario/${selected.id}/atividades`, { descricao: tarefa.nome, status: 'em_andamento' });
        refreshDetail();
      } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
    }

    const statusColors: Record<string, string> = {
      em_andamento: 'text-blue-600', concluida: 'text-green-600',
      nao_realizada: 'text-ber-red', parcial: 'text-amber-600',
    };

    return (
      <div className="space-y-2">
        {!fechado && (cronogramaAtivas.length > 0 || etapasAtivas.length > 0) && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 mb-2">Previstas hoje no cronograma</p>
            <div className="flex flex-wrap gap-1.5">
              {cronogramaAtivas.map(t => (
                <button key={t.wbs || t.nome} onClick={() => importarTarefaCronograma(t)}
                  className="flex items-center gap-1 rounded-full bg-white border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors">
                  <Plus size={10} /> {t.nome}
                  {t.percentualConcluido > 0 && <span className="text-[9px] text-blue-500 ml-0.5">{t.percentualConcluido}%</span>}
                </button>
              ))}
              {etapasAtivas.map(e => (
                <button key={e.id} onClick={() => importarEtapa(e)}
                  className="flex items-center gap-1 rounded-full bg-white border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors">
                  <Plus size={10} /> {e.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {selected?.atividades.map(at => (
          <div key={at.id} className="flex items-start justify-between rounded-lg bg-gray-50 border border-ber-border/50 px-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="text-ber-carbon text-sm">{at.descricao}</p>
              <p className={`text-xs mt-0.5 font-medium ${statusColors[at.status] ?? 'text-ber-gray'}`}>{ATIVIDADE_STATUS_LABELS[at.status] ?? at.status}</p>
              {at.obraEtapaId && (() => {
                const etapa = etapas.find(e => e.id === at.obraEtapaId);
                return etapa ? <p className="text-[10px] text-ber-gray mt-0.5">Etapa: {etapa.name}</p> : null;
              })()}
            </div>
            {!fechado && (
              <button onClick={() => deleteItem(`/diario/${selected!.id}/atividades/${at.id}`, refreshDetail)} className="text-ber-gray hover:text-ber-red ml-2 shrink-0">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!fechado && addingAtividade ? (
          <div className="space-y-2 rounded-lg bg-gray-50 border border-ber-border p-3">
            <input placeholder="Descrição da atividade" value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm text-ber-carbon placeholder-ber-gray/60 outline-none focus:border-ber-olive" />
            <select value={status} onChange={e => setStatus(e.target.value as any)}
              className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive">
              {ATIVIDADE_STATUS.map(s => <option key={s} value={s}>{ATIVIDADE_STATUS_LABELS[s]}</option>)}
            </select>
            {etapas.length > 0 && (
              <select value={etapaId} onChange={e => setEtapaId(e.target.value)}
                className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive">
                <option value="">Etapa do cronograma (opcional)</option>
                {etapas.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            )}
            <div className="flex gap-2">
              <button onClick={add} className="rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-white">Adicionar</button>
              <button onClick={() => setAddingAtividade(false)} className="text-xs text-ber-gray hover:text-ber-carbon">Cancelar</button>
            </div>
          </div>
        ) : !fechado ? (
          <button onClick={() => setAddingAtividade(true)} className="flex items-center gap-1 text-xs text-ber-olive hover:underline mt-1">
            <Plus size={12} /> Adicionar atividade
          </button>
        ) : null}
      </div>
    );
  }

  function OcorrenciasSection() {
    const [tipo, setTipo] = useState<typeof OCORRENCIA_TIPOS[number]>('imprevisto');
    const [desc, setDesc] = useState('');
    const [visivelCliente, setVisivelCliente] = useState(false);

    async function add() {
      if (!desc.trim() || !selected) return;
      try {
        await api.post(`/diario/${selected.id}/ocorrencias`, { tipo, descricao: desc, visivelCliente });
        setDesc(''); setAddingOcorrencia(false);
        refreshDetail();
      } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
    }

    return (
      <div className="space-y-2">
        {selected?.ocorrencias.map(oc => (
          <div key={oc.id} className="flex items-start justify-between rounded-lg bg-gray-50 border border-ber-border/50 px-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">{oc.tipo}</p>
              <p className="text-ber-carbon text-sm mt-0.5">{oc.descricao}</p>
              {oc.visivelCliente && <p className="text-[10px] text-blue-600 mt-0.5 font-medium">Visível ao cliente</p>}
            </div>
            {!fechado && (
              <button onClick={() => deleteItem(`/diario/${selected!.id}/ocorrencias/${oc.id}`, refreshDetail)} className="text-ber-gray hover:text-ber-red ml-2 shrink-0">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!fechado && addingOcorrencia ? (
          <div className="space-y-2 rounded-lg bg-gray-50 border border-ber-border p-3">
            <select value={tipo} onChange={e => setTipo(e.target.value as any)}
              className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive">
              {OCORRENCIA_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Descrição" value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm text-ber-carbon placeholder-ber-gray/60 outline-none focus:border-ber-olive" />
            <label className="flex items-center gap-2 text-xs text-ber-gray cursor-pointer">
              <input type="checkbox" checked={visivelCliente} onChange={e => setVisivelCliente(e.target.checked)} />
              Visível ao cliente
            </label>
            <div className="flex gap-2">
              <button onClick={add} className="rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-white">Adicionar</button>
              <button onClick={() => setAddingOcorrencia(false)} className="text-xs text-ber-gray hover:text-ber-carbon">Cancelar</button>
            </div>
          </div>
        ) : !fechado ? (
          <button onClick={() => setAddingOcorrencia(true)} className="flex items-center gap-1 text-xs text-ber-olive hover:underline mt-1">
            <Plus size={12} /> Adicionar ocorrência
          </button>
        ) : null}
      </div>
    );
  }

  function VisitasSection() {
    const [tipo, setTipo] = useState<typeof VISITA_TIPOS[number]>('cliente');
    const [nome, setNome] = useState('');
    const [obs, setObs] = useState('');

    async function add() {
      if (!selected) return;
      try {
        await api.post(`/diario/${selected.id}/visitas`, { tipo, nome: nome || undefined, observacao: obs || undefined });
        setNome(''); setObs(''); setAddingVisita(false);
        refreshDetail();
      } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
    }

    return (
      <div className="space-y-2">
        {selected?.visitas.map(vi => (
          <div key={vi.id} className="flex items-start justify-between rounded-lg bg-gray-50 border border-ber-border/50 px-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{vi.tipo}</p>
              {vi.nome && <p className="text-ber-carbon text-sm mt-0.5">{vi.nome}</p>}
              {vi.observacao && <p className="text-xs text-ber-gray mt-0.5">{vi.observacao}</p>}
            </div>
            {!fechado && (
              <button onClick={() => deleteItem(`/diario/${selected!.id}/visitas/${vi.id}`, refreshDetail)} className="text-ber-gray hover:text-ber-red ml-2 shrink-0">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!fechado && addingVisita ? (
          <div className="space-y-2 rounded-lg bg-gray-50 border border-ber-border p-3">
            <select value={tipo} onChange={e => setTipo(e.target.value as any)}
              className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive">
              {VISITA_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Nome (opcional)" value={nome} onChange={e => setNome(e.target.value)}
              className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm text-ber-carbon placeholder-ber-gray/60 outline-none focus:border-ber-olive" />
            <input placeholder="Observação (opcional)" value={obs} onChange={e => setObs(e.target.value)}
              className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm text-ber-carbon placeholder-ber-gray/60 outline-none focus:border-ber-olive" />
            <div className="flex gap-2">
              <button onClick={add} className="rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-white">Adicionar</button>
              <button onClick={() => setAddingVisita(false)} className="text-xs text-ber-gray hover:text-ber-carbon">Cancelar</button>
            </div>
          </div>
        ) : !fechado ? (
          <button onClick={() => setAddingVisita(true)} className="flex items-center gap-1 text-xs text-ber-olive hover:underline mt-1">
            <Plus size={12} /> Adicionar visita
          </button>
        ) : null}
      </div>
    );
  }

  function MateriaisSection() {
    const [desc, setDesc] = useState('');
    const [qtd, setQtd] = useState('');
    const [unidade, setUnidade] = useState('un');

    async function add() {
      if (!desc.trim() || !selected) return;
      try {
        await api.post(`/diario/${selected.id}/materiais`, {
          descricao: desc, quantidade: qtd ? Number(qtd) : undefined, unidade: qtd ? unidade : undefined,
        });
        setDesc(''); setQtd(''); setAddingMaterial(false);
        refreshDetail();
      } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
    }

    return (
      <div className="space-y-2">
        {selected?.materiais.map(mat => (
          <div key={mat.id} className="flex items-center justify-between rounded-lg bg-gray-50 border border-ber-border/50 px-3 py-2 text-sm">
            <div>
              <span className="text-ber-carbon">{mat.descricao}</span>
              {mat.quantidade != null && <span className="ml-2 text-xs text-ber-gray">{mat.quantidade} {mat.unidade}</span>}
            </div>
            {!fechado && (
              <button onClick={() => deleteItem(`/diario/${selected!.id}/materiais/${mat.id}`, refreshDetail)} className="text-ber-gray hover:text-ber-red ml-2">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!fechado && addingMaterial ? (
          <div className="space-y-2 rounded-lg bg-gray-50 border border-ber-border p-3">
            <input placeholder="Descrição do material" value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm text-ber-carbon placeholder-ber-gray/60 outline-none focus:border-ber-olive" />
            <div className="flex gap-2">
              <input placeholder="Qtd." value={qtd} onChange={e => setQtd(e.target.value)} type="number" min="0"
                className="w-24 rounded-lg border border-ber-border bg-white px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive" />
              <select value={unidade} onChange={e => setUnidade(e.target.value)}
                className="flex-1 rounded-lg border border-ber-border bg-white px-3 py-2 text-sm text-ber-carbon outline-none focus:border-ber-olive">
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={add} className="rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-white">Adicionar</button>
              <button onClick={() => setAddingMaterial(false)} className="text-xs text-ber-gray hover:text-ber-carbon">Cancelar</button>
            </div>
          </div>
        ) : !fechado ? (
          <button onClick={() => setAddingMaterial(true)} className="flex items-center gap-1 text-xs text-ber-olive hover:underline mt-1">
            <Plus size={12} /> Adicionar material
          </button>
        ) : null}
      </div>
    );
  }

  function EquipamentosSection() {
    const [nome, setNome] = useState('');

    async function add() {
      if (!nome.trim() || !selected) return;
      try {
        await api.post(`/diario/${selected.id}/equipamentos`, { nome });
        setNome(''); setAddingEquipamento(false);
        refreshDetail();
      } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
    }

    return (
      <div className="space-y-2">
        {selected?.equipamentos.map(eq => (
          <div key={eq.id} className="flex items-center justify-between rounded-lg bg-gray-50 border border-ber-border/50 px-3 py-2 text-sm">
            <span className="text-ber-carbon">{eq.nome}</span>
            {!fechado && (
              <button onClick={() => deleteItem(`/diario/${selected!.id}/equipamentos/${eq.id}`, refreshDetail)} className="text-ber-gray hover:text-ber-red ml-2">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!fechado && addingEquipamento ? (
          <div className="space-y-2 rounded-lg bg-gray-50 border border-ber-border p-3">
            <input placeholder="Nome do equipamento" value={nome} onChange={e => setNome(e.target.value)}
              className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm text-ber-carbon placeholder-ber-gray/60 outline-none focus:border-ber-olive" />
            <div className="flex gap-2">
              <button onClick={add} className="rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-white">Adicionar</button>
              <button onClick={() => setAddingEquipamento(false)} className="text-xs text-ber-gray hover:text-ber-carbon">Cancelar</button>
            </div>
          </div>
        ) : !fechado ? (
          <button onClick={() => setAddingEquipamento(true)} className="flex items-center gap-1 text-xs text-ber-olive hover:underline mt-1">
            <Plus size={12} /> Adicionar equipamento
          </button>
        ) : null}
      </div>
    );
  }

  const temDiarioHoje = diarios.some(d => d.data.slice(0, 10) === todayISO());
  const nomeObra = obraNome ?? obra?.name ?? '';

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {showPreview && selected && (
        <PreviewFecharModal
          diario={selected}
          obraNome={nomeObra}
          onConfirm={fecharDiario}
          onCancel={() => setShowPreview(false)}
          saving={saving}
        />
      )}

      {/* Top bar: title + new diário button */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-ber-gray">Diário de Obra</p>
        {!temDiarioHoje && (
          <button
            onClick={criarDiarioHoje}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-ber-olive px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Novo diário — hoje
          </button>
        )}
      </div>

      {loadingList ? (
        <div className="flex h-24 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ber-olive border-t-transparent" />
        </div>
      ) : (
        <div className="mb-6 space-y-2">
          {diarios.length === 0 && (
            <p className="text-center text-sm text-ber-gray py-6">Nenhum diário registrado. Crie o primeiro acima.</p>
          )}
          {diarios.map(d => (
            <button
              key={d.id}
              onClick={() => loadDetail(d.id)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                selected?.id === d.id
                  ? 'border-ber-olive bg-ber-olive/5'
                  : 'border-ber-border bg-white hover:shadow-md hover:border-ber-olive/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {d.clima && CLIMA_ICONS[d.clima]}
                  <span className="text-sm font-semibold text-ber-carbon">{fmtDate(d.data)}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  d.status === 'aprovado' ? 'bg-green-100 text-green-700' :
                  d.status === 'fechado'  ? 'bg-blue-100 text-blue-700' :
                  d.status === 'recusado' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {d.status}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-ber-gray">
                <span>{d._count.efetivos} efetivos</span>
                <span>{d._count.atividades} atividades</span>
                <span>{d._count.fotos} fotos</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {loadingDetail && (
        <div className="flex h-24 items-center justify-center">
          <Loader2 size={20} className="animate-spin text-ber-olive" />
        </div>
      )}

      {selected && !loadingDetail && (
        <div className="space-y-4">
          {/* Header card */}
          <div className="rounded-xl border border-ber-border bg-white p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-bold text-ber-carbon">{fmtDate(selected.data)}</p>
                <p className="text-xs text-ber-gray mt-0.5">por {selected.criadoPor.name}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  selected.status === 'aprovado' ? 'bg-green-100 text-green-700' :
                  selected.status === 'fechado'  ? 'bg-blue-100 text-blue-700' :
                  selected.status === 'recusado' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{selected.status}</span>

                {selected.status !== 'rascunho' && selected.tokenPublico && (
                  <a href={`/atualizacao/${selected.tokenPublico}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
                    <Eye size={12} /> Ver cliente
                  </a>
                )}

                {selected.status === 'rascunho' && (
                  <button onClick={() => setShowPreview(true)} disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 disabled:opacity-60">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />} Fechar
                  </button>
                )}
                {(selected.status === 'fechado' || selected.status === 'recusado') && (
                  <button onClick={reabrirDiario} disabled={saving}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 disabled:opacity-60">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Unlock size={12} />} Reabrir
                  </button>
                )}
                {isCoordenacao && selected.status === 'fechado' && (
                  <>
                    <button onClick={aprovarDiario} disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border bg-green-50 text-green-700 border-green-200 hover:bg-green-100 disabled:opacity-60">
                      <CheckCircle2 size={12} /> Aprovar
                    </button>
                    <button onClick={recusarDiario} disabled={saving}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border bg-red-50 text-red-700 border-red-200 hover:bg-red-100 disabled:opacity-60">
                      <XCircle size={12} /> Recusar
                    </button>
                  </>
                )}
                <button onClick={excluirDiario} disabled={saving}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-ber-gray border border-ber-border hover:text-ber-red hover:border-red-200 hover:bg-red-50 disabled:opacity-60">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* Clima */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Clima</p>
                {patchingHeader && <Loader2 size={10} className="animate-spin text-ber-gray" />}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {CLIMA_OPTIONS.map(c => {
                  const isSelected = selected.clima === c;
                  return (
                    <button key={c} disabled={fechado || patchingHeader} onClick={() => patchHeader({ clima: c })} title={CLIMA_LABELS[c]}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected ? 'bg-ber-olive text-white' : 'bg-gray-100 text-ber-gray hover:bg-gray-200'
                      }`}>
                      {isSelected ? CLIMA_ICONS_WHITE[c] : CLIMA_ICONS[c]}
                      {CLIMA_SHORT[c]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Condição */}
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray mb-2">Condição de trabalho</p>
              <div className="flex gap-1.5">
                {COND_OPTIONS.map(c => (
                  <button key={c} disabled={fechado || patchingHeader} onClick={() => patchHeader({ condicaoTrabalho: c })}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      selected.condicaoTrabalho === c ? 'bg-ber-olive text-white' : 'bg-gray-100 text-ber-gray hover:bg-gray-200'
                    }`}>
                    {COND_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            {/* Avanço físico — cronograma */}
            {(() => {
              const progressoCronograma = cronograma?.progressPct
                ?? (cronograma?.parsedData?.progressoGeral != null ? cronograma.parsedData.progressoGeral : null);
              if (progressoCronograma == null) return null;
              return (
                <div className="mb-3 rounded-lg bg-ber-olive/5 border border-ber-olive/20 px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ber-olive">Progresso da obra</p>
                    <span className="text-sm font-bold text-ber-olive">{progressoCronograma}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-ber-olive/20 overflow-hidden">
                    <div className="h-full rounded-full bg-ber-olive transition-all" style={{ width: `${progressoCronograma}%` }} />
                  </div>
                  <p className="text-[9px] text-ber-gray mt-1">Média ponderada por duração — cronograma</p>
                </div>
              );
            })()}

            {/* Observações ao cliente */}
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray">Observações ao cliente</p>
                <span className="text-[10px] text-ber-gray/50 flex items-center gap-0.5">👁️ Visível ao cliente</span>
              </div>
              <textarea value={obsCliente} onChange={e => setObsCliente(e.target.value)}
                onBlur={() => { if (obsCliente !== (selected.observacoesCliente ?? '')) patchHeader({ observacoesCliente: obsCliente }); }}
                disabled={fechado || patchingHeader} rows={2} placeholder="Notas para o cliente..."
                className="w-full rounded-lg border border-ber-border bg-gray-50 px-3 py-2 text-sm text-ber-carbon placeholder-ber-gray/50 outline-none focus:border-ber-olive focus:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-none" />
            </div>

            {/* Observações internas */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ber-gray mb-1">Observações internas</p>
              <textarea value={obsInternas} onChange={e => setObsInternas(e.target.value)}
                onBlur={() => { if (obsInternas !== (selected.observacoesInternas ?? '')) patchHeader({ observacoesInternas: obsInternas }); }}
                disabled={fechado || patchingHeader} rows={2} placeholder="Anotações internas..."
                className="w-full rounded-lg border border-ber-border bg-gray-50 px-3 py-2 text-sm text-ber-carbon placeholder-ber-gray/50 outline-none focus:border-ber-olive focus:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-none" />
            </div>

            {fechado && selected.fechadoPor && (
              <p className="mt-3 text-xs text-ber-gray border-t border-ber-border pt-3">
                Fechado por {selected.fechadoPor.name}
                {selected.tokenPublico && (
                  <span className="ml-2 text-blue-600 flex items-center gap-1 inline-flex">
                    <Link2 size={10} />
                    <a href={`/atualizacao/${selected.tokenPublico}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      link do cliente
                    </a>
                  </span>
                )}
              </p>
            )}
          </div>

          <Section title="Fotos" icon={<Camera size={14} className="text-pink-500" />}
            count={selected.fotos.length} open={openSections.fotos} onToggle={() => toggleSection('fotos')}>
            <FotosSection />
          </Section>

          <Section title="Atividades" icon={<ClipboardList size={14} className="text-blue-500" />}
            count={selected.atividades.length} open={openSections.atividades} onToggle={() => toggleSection('atividades')}>
            <AtividadesSection />
          </Section>

          <Section title="Efetivos" icon={<Users size={14} className="text-ber-olive" />}
            count={selected.efetivos.length} open={openSections.efetivos} onToggle={() => toggleSection('efetivos')}>
            <EfetivosSection />
          </Section>

          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-ber-border" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-ber-gray/50 px-2">Interno</span>
            <div className="flex-1 h-px bg-ber-border" />
          </div>

          <Section title="Ocorrências" icon={<AlertTriangle size={14} className="text-amber-500" />}
            count={selected.ocorrencias.length} open={openSections.ocorrencias} onToggle={() => toggleSection('ocorrencias')}>
            <OcorrenciasSection />
          </Section>

          <Section title="Visitas" icon={<UserCheck size={14} className="text-purple-500" />}
            count={selected.visitas.length} open={openSections.visitas} onToggle={() => toggleSection('visitas')}>
            <VisitasSection />
          </Section>

          <Section title="Materiais" icon={<Package size={14} className="text-orange-500" />}
            count={selected.materiais.length} open={openSections.materiais} onToggle={() => toggleSection('materiais')}>
            <MateriaisSection />
          </Section>

          <Section title="Equipamentos" icon={<Wrench size={14} className="text-ber-gray" />}
            count={selected.equipamentos.length} open={openSections.equipamentos} onToggle={() => toggleSection('equipamentos')}>
            <EquipamentosSection />
          </Section>
        </div>
      )}
    </div>
  );
}
