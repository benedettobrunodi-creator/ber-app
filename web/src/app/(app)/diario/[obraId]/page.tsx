'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
  ArrowLeft, Plus, X, Lock, Unlock, Sun, Cloud, CloudSun, CloudRain, Zap,
  Users, ClipboardList, AlertTriangle, UserCheck, Package, Wrench, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Obra { id: string; name: string; client: string | null }

interface DiarioSummary {
  id: string;
  data: string;
  status: 'rascunho' | 'fechado';
  clima: string | null;
  condicaoTrabalho: string | null;
  _count: { efetivos: number; atividades: number; fotos: number };
  criadoPor: { id: string; name: string };
}

interface Efetivo { id: string; nomeExterno: string | null; funcao: string | null; presente: boolean; user: { id: string; name: string } | null }
interface Atividade { id: string; descricao: string; status: string }
interface Ocorrencia { id: string; tipo: string; descricao: string; visivelCliente: boolean }
interface Visita { id: string; tipo: string; nome: string | null; observacao: string | null }
interface Material { id: string; descricao: string }
interface Equipamento { id: string; nome: string }

interface DiarioDetalhe {
  id: string;
  data: string;
  clima: string | null;
  condicaoTrabalho: string | null;
  observacoesInternas: string | null;
  observacoesCliente: string | null;
  status: 'rascunho' | 'fechado';
  fechadoEm: string | null;
  criadoPor: { id: string; name: string };
  fechadoPor: { id: string; name: string } | null;
  efetivos: Efetivo[];
  atividades: Atividade[];
  ocorrencias: Ocorrencia[];
  visitas: Visita[];
  materiais: Material[];
  equipamentos: Equipamento[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CLIMA_OPTIONS = ['sol', 'parcialmente_nublado', 'nublado', 'chuva', 'tempestade'] as const;
const CLIMA_LABELS: Record<string, string> = {
  sol: 'Sol', parcialmente_nublado: 'Parcialmente nublado', nublado: 'Nublado', chuva: 'Chuva', tempestade: 'Tempestade',
};
const CLIMA_ICONS: Record<string, React.ReactNode> = {
  sol: <Sun size={14} className="text-yellow-400" />,
  parcialmente_nublado: <CloudSun size={14} className="text-yellow-300" />,
  nublado: <Cloud size={14} className="text-gray-400" />,
  chuva: <CloudRain size={14} className="text-blue-400" />,
  tempestade: <Zap size={14} className="text-purple-400" />,
};
const COND_OPTIONS = ['normal', 'parcial', 'interrompido'] as const;
const COND_LABELS: Record<string, string> = { normal: 'Normal', parcial: 'Parcial', interrompido: 'Interrompido' };
const ATIVIDADE_STATUS = ['em_andamento', 'concluida', 'nao_realizada', 'parcial'] as const;
const ATIVIDADE_STATUS_LABELS: Record<string, string> = {
  em_andamento: 'Em andamento', concluida: 'Concluída', nao_realizada: 'Não realizada', parcial: 'Parcial',
};
const OCORRENCIA_TIPOS = ['incidente', 'imprevisto', 'atraso', 'qualidade', 'seguranca', 'outro'] as const;
const VISITA_TIPOS = ['cliente', 'fiscalizacao', 'fornecedor', 'projetista', 'outro'] as const;

function fmtDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Section accordion ────────────────────────────────────────────────────────

function Section({ title, icon, count, open, onToggle, children }: {
  title: string; icon: React.ReactNode; count: number;
  open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ber-border bg-ber-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-white">{title}</span>
          <span className="rounded-full bg-ber-border px-1.5 py-0.5 text-[10px] font-bold text-gray-400">{count}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
      </button>
      {open && <div className="border-t border-ber-border px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DiarioObraPage() {
  const params = useParams();
  const router = useRouter();
  const obraId = params.obraId as string;

  const [obra, setObra] = useState<Obra | null>(null);
  const [diarios, setDiarios] = useState<DiarioSummary[]>([]);
  const [selected, setSelected] = useState<DiarioDetalhe | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    efetivos: true, atividades: true, ocorrencias: false, visitas: false, materiais: false, equipamentos: false,
  });

  // Add forms
  const [addingEfetivo, setAddingEfetivo] = useState(false);
  const [addingAtividade, setAddingAtividade] = useState(false);
  const [addingOcorrencia, setAddingOcorrencia] = useState(false);
  const [addingVisita, setAddingVisita] = useState(false);
  const [addingMaterial, setAddingMaterial] = useState(false);
  const [addingEquipamento, setAddingEquipamento] = useState(false);

  const fechado = selected?.status === 'fechado';

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const [obraRes, diariosRes] = await Promise.all([
        api.get(`/obras/${obraId}`),
        api.get(`/obras/${obraId}/diario`),
      ]);
      setObra(obraRes.data?.data ?? null);
      setDiarios(diariosRes.data?.data ?? []);
    } finally {
      setLoadingList(false);
    }
  }, [obraId]);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/diario/${id}`);
      setSelected(res.data?.data ?? null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

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

  async function fecharReabrir() {
    if (!selected) return;
    setSaving(true);
    try {
      const endpoint = fechado ? `/diario/${selected.id}/reabrir` : `/diario/${selected.id}/fechar`;
      const res = await api.post(endpoint);
      setSelected(res.data?.data);
      await loadList();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erro');
    } finally {
      setSaving(false);
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

  // ── Efetivos ──
  function EfetivosSection() {
    const [nome, setNome] = useState('');
    const [funcao, setFuncao] = useState('');

    async function add() {
      if (!nome.trim() || !selected) return;
      try {
        await api.post(`/diario/${selected.id}/efetivos`, { nomeExterno: nome, funcao: funcao || undefined });
        setNome(''); setFuncao(''); setAddingEfetivo(false);
        refreshDetail();
      } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
    }

    return (
      <div className="space-y-2">
        {selected?.efetivos.map(ef => (
          <div key={ef.id} className="flex items-center justify-between rounded-lg bg-ber-bg px-3 py-2 text-sm">
            <div>
              <span className="text-white font-medium">{ef.user?.name ?? ef.nomeExterno ?? '—'}</span>
              {ef.funcao && <span className="ml-2 text-xs text-gray-500">{ef.funcao}</span>}
            </div>
            {!fechado && (
              <button onClick={() => deleteItem(`/diario/${selected.id}/efetivos/${ef.id}`, refreshDetail)}
                className="text-gray-600 hover:text-ber-red ml-2">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!fechado && addingEfetivo ? (
          <div className="space-y-2 rounded-lg bg-ber-bg p-3">
            <input placeholder="Nome" value={nome} onChange={e => setNome(e.target.value)}
              className="w-full rounded-lg bg-ber-border px-3 py-2 text-sm text-white placeholder-gray-600 outline-none" />
            <input placeholder="Função (opcional)" value={funcao} onChange={e => setFuncao(e.target.value)}
              className="w-full rounded-lg bg-ber-border px-3 py-2 text-sm text-white placeholder-gray-600 outline-none" />
            <div className="flex gap-2">
              <button onClick={add} className="rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-white">Adicionar</button>
              <button onClick={() => setAddingEfetivo(false)} className="text-xs text-gray-500">Cancelar</button>
            </div>
          </div>
        ) : !fechado ? (
          <button onClick={() => setAddingEfetivo(true)}
            className="flex items-center gap-1 text-xs text-ber-olive hover:underline mt-1">
            <Plus size={12} /> Adicionar efetivo
          </button>
        ) : null}
      </div>
    );
  }

  // ── Atividades ──
  function AtividadesSection() {
    const [desc, setDesc] = useState('');
    const [status, setStatus] = useState<typeof ATIVIDADE_STATUS[number]>('em_andamento');

    async function add() {
      if (!desc.trim() || !selected) return;
      try {
        await api.post(`/diario/${selected.id}/atividades`, { descricao: desc, status });
        setDesc(''); setAddingAtividade(false);
        refreshDetail();
      } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
    }

    const statusColors: Record<string, string> = {
      em_andamento: 'text-blue-400', concluida: 'text-green-400',
      nao_realizada: 'text-red-400', parcial: 'text-yellow-400',
    };

    return (
      <div className="space-y-2">
        {selected?.atividades.map(at => (
          <div key={at.id} className="flex items-start justify-between rounded-lg bg-ber-bg px-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm">{at.descricao}</p>
              <p className={`text-xs mt-0.5 ${statusColors[at.status] ?? 'text-gray-400'}`}>
                {ATIVIDADE_STATUS_LABELS[at.status] ?? at.status}
              </p>
            </div>
            {!fechado && (
              <button onClick={() => deleteItem(`/diario/${selected.id}/atividades/${at.id}`, refreshDetail)}
                className="text-gray-600 hover:text-ber-red ml-2 shrink-0">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!fechado && addingAtividade ? (
          <div className="space-y-2 rounded-lg bg-ber-bg p-3">
            <input placeholder="Descrição da atividade" value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full rounded-lg bg-ber-border px-3 py-2 text-sm text-white placeholder-gray-600 outline-none" />
            <select value={status} onChange={e => setStatus(e.target.value as any)}
              className="w-full rounded-lg bg-ber-border px-3 py-2 text-sm text-white outline-none">
              {ATIVIDADE_STATUS.map(s => <option key={s} value={s}>{ATIVIDADE_STATUS_LABELS[s]}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={add} className="rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-white">Adicionar</button>
              <button onClick={() => setAddingAtividade(false)} className="text-xs text-gray-500">Cancelar</button>
            </div>
          </div>
        ) : !fechado ? (
          <button onClick={() => setAddingAtividade(true)}
            className="flex items-center gap-1 text-xs text-ber-olive hover:underline mt-1">
            <Plus size={12} /> Adicionar atividade
          </button>
        ) : null}
      </div>
    );
  }

  // ── Ocorrências ──
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
          <div key={oc.id} className="flex items-start justify-between rounded-lg bg-ber-bg px-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-yellow-500">{oc.tipo}</p>
              <p className="text-white text-sm mt-0.5">{oc.descricao}</p>
              {oc.visivelCliente && <p className="text-[10px] text-blue-400 mt-0.5">Visível ao cliente</p>}
            </div>
            {!fechado && (
              <button onClick={() => deleteItem(`/diario/${selected.id}/ocorrencias/${oc.id}`, refreshDetail)}
                className="text-gray-600 hover:text-ber-red ml-2 shrink-0">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!fechado && addingOcorrencia ? (
          <div className="space-y-2 rounded-lg bg-ber-bg p-3">
            <select value={tipo} onChange={e => setTipo(e.target.value as any)}
              className="w-full rounded-lg bg-ber-border px-3 py-2 text-sm text-white outline-none">
              {OCORRENCIA_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Descrição" value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full rounded-lg bg-ber-border px-3 py-2 text-sm text-white placeholder-gray-600 outline-none" />
            <label className="flex items-center gap-2 text-xs text-gray-400">
              <input type="checkbox" checked={visivelCliente} onChange={e => setVisivelCliente(e.target.checked)} />
              Visível ao cliente
            </label>
            <div className="flex gap-2">
              <button onClick={add} className="rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-white">Adicionar</button>
              <button onClick={() => setAddingOcorrencia(false)} className="text-xs text-gray-500">Cancelar</button>
            </div>
          </div>
        ) : !fechado ? (
          <button onClick={() => setAddingOcorrencia(true)}
            className="flex items-center gap-1 text-xs text-ber-olive hover:underline mt-1">
            <Plus size={12} /> Adicionar ocorrência
          </button>
        ) : null}
      </div>
    );
  }

  // ── Visitas ──
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
          <div key={vi.id} className="flex items-start justify-between rounded-lg bg-ber-bg px-3 py-2 text-sm">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">{vi.tipo}</p>
              {vi.nome && <p className="text-white text-sm mt-0.5">{vi.nome}</p>}
              {vi.observacao && <p className="text-xs text-gray-500 mt-0.5">{vi.observacao}</p>}
            </div>
            {!fechado && (
              <button onClick={() => deleteItem(`/diario/${selected.id}/visitas/${vi.id}`, refreshDetail)}
                className="text-gray-600 hover:text-ber-red ml-2 shrink-0">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!fechado && addingVisita ? (
          <div className="space-y-2 rounded-lg bg-ber-bg p-3">
            <select value={tipo} onChange={e => setTipo(e.target.value as any)}
              className="w-full rounded-lg bg-ber-border px-3 py-2 text-sm text-white outline-none">
              {VISITA_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Nome (opcional)" value={nome} onChange={e => setNome(e.target.value)}
              className="w-full rounded-lg bg-ber-border px-3 py-2 text-sm text-white placeholder-gray-600 outline-none" />
            <input placeholder="Observação (opcional)" value={obs} onChange={e => setObs(e.target.value)}
              className="w-full rounded-lg bg-ber-border px-3 py-2 text-sm text-white placeholder-gray-600 outline-none" />
            <div className="flex gap-2">
              <button onClick={add} className="rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-white">Adicionar</button>
              <button onClick={() => setAddingVisita(false)} className="text-xs text-gray-500">Cancelar</button>
            </div>
          </div>
        ) : !fechado ? (
          <button onClick={() => setAddingVisita(true)}
            className="flex items-center gap-1 text-xs text-ber-olive hover:underline mt-1">
            <Plus size={12} /> Adicionar visita
          </button>
        ) : null}
      </div>
    );
  }

  // ── Materiais ──
  function MateriaisSection() {
    const [desc, setDesc] = useState('');

    async function add() {
      if (!desc.trim() || !selected) return;
      try {
        await api.post(`/diario/${selected.id}/materiais`, { descricao: desc });
        setDesc(''); setAddingMaterial(false);
        refreshDetail();
      } catch (e: any) { alert(e?.response?.data?.message ?? 'Erro'); }
    }

    return (
      <div className="space-y-2">
        {selected?.materiais.map(mat => (
          <div key={mat.id} className="flex items-center justify-between rounded-lg bg-ber-bg px-3 py-2 text-sm">
            <span className="text-white">{mat.descricao}</span>
            {!fechado && (
              <button onClick={() => deleteItem(`/diario/${selected.id}/materiais/${mat.id}`, refreshDetail)}
                className="text-gray-600 hover:text-ber-red ml-2">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!fechado && addingMaterial ? (
          <div className="space-y-2 rounded-lg bg-ber-bg p-3">
            <input placeholder="Descrição do material" value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full rounded-lg bg-ber-border px-3 py-2 text-sm text-white placeholder-gray-600 outline-none" />
            <div className="flex gap-2">
              <button onClick={add} className="rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-white">Adicionar</button>
              <button onClick={() => setAddingMaterial(false)} className="text-xs text-gray-500">Cancelar</button>
            </div>
          </div>
        ) : !fechado ? (
          <button onClick={() => setAddingMaterial(true)}
            className="flex items-center gap-1 text-xs text-ber-olive hover:underline mt-1">
            <Plus size={12} /> Adicionar material
          </button>
        ) : null}
      </div>
    );
  }

  // ── Equipamentos ──
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
          <div key={eq.id} className="flex items-center justify-between rounded-lg bg-ber-bg px-3 py-2 text-sm">
            <span className="text-white">{eq.nome}</span>
            {!fechado && (
              <button onClick={() => deleteItem(`/diario/${selected.id}/equipamentos/${eq.id}`, refreshDetail)}
                className="text-gray-600 hover:text-ber-red ml-2">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
        {!fechado && addingEquipamento ? (
          <div className="space-y-2 rounded-lg bg-ber-bg p-3">
            <input placeholder="Nome do equipamento" value={nome} onChange={e => setNome(e.target.value)}
              className="w-full rounded-lg bg-ber-border px-3 py-2 text-sm text-white placeholder-gray-600 outline-none" />
            <div className="flex gap-2">
              <button onClick={add} className="rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-white">Adicionar</button>
              <button onClick={() => setAddingEquipamento(false)} className="text-xs text-gray-500">Cancelar</button>
            </div>
          </div>
        ) : !fechado ? (
          <button onClick={() => setAddingEquipamento(true)}
            className="flex items-center gap-1 text-xs text-ber-olive hover:underline mt-1">
            <Plus size={12} /> Adicionar equipamento
          </button>
        ) : null}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const temDiarioHoje = diarios.some(d => d.data.slice(0, 10) === todayISO());

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => router.push('/diario')} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:text-white">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white truncate">{obra?.name ?? 'Carregando...'}</h1>
          {obra?.client && <p className="text-xs text-gray-500">{obra.client}</p>}
        </div>
        {!temDiarioHoje && (
          <button
            onClick={criarDiarioHoje}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-ber-olive px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Hoje
          </button>
        )}
      </div>

      {/* List of diários */}
      {loadingList ? (
        <div className="flex h-24 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-ber-olive border-t-transparent" />
        </div>
      ) : (
        <div className="mb-6 space-y-2">
          {diarios.length === 0 && (
            <p className="text-center text-sm text-gray-600 py-6">Nenhum diário registrado. Crie o primeiro acima.</p>
          )}
          {diarios.map(d => (
            <button
              key={d.id}
              onClick={() => loadDetail(d.id)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                selected?.id === d.id
                  ? 'border-ber-olive bg-ber-olive/10'
                  : 'border-ber-border bg-ber-card hover:border-ber-olive/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {d.clima && CLIMA_ICONS[d.clima]}
                  <span className="text-sm font-semibold text-white">{fmtDate(d.data)}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  d.status === 'fechado' ? 'bg-green-900/40 text-green-400' : 'bg-yellow-900/40 text-yellow-400'
                }`}>
                  {d.status}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                <span>{d._count.efetivos} efetivos</span>
                <span>{d._count.atividades} atividades</span>
                <span>{d._count.fotos} fotos</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {loadingDetail && (
        <div className="flex h-24 items-center justify-center">
          <Loader2 size={20} className="animate-spin text-ber-olive" />
        </div>
      )}

      {selected && !loadingDetail && (
        <div className="space-y-4">
          {/* Diário header card */}
          <div className="rounded-xl border border-ber-border bg-ber-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-white">{fmtDate(selected.data)}</p>
                <p className="text-xs text-gray-500">por {selected.criadoPor.name}</p>
              </div>
              <button
                onClick={fecharReabrir}
                disabled={saving}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                  fechado
                    ? 'bg-yellow-900/40 text-yellow-400 hover:bg-yellow-900/60'
                    : 'bg-green-900/40 text-green-400 hover:bg-green-900/60'
                }`}
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : fechado ? <Unlock size={12} /> : <Lock size={12} />}
                {fechado ? 'Reabrir' : 'Fechar'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-600 mb-1">Clima</p>
                <div className="flex items-center gap-1.5">
                  {selected.clima && CLIMA_ICONS[selected.clima]}
                  <span className="text-sm text-white">{selected.clima ? CLIMA_LABELS[selected.clima] : '—'}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-600 mb-1">Condição</p>
                <span className="text-sm text-white">{selected.condicaoTrabalho ? COND_LABELS[selected.condicaoTrabalho] : '—'}</span>
              </div>
            </div>

            {selected.observacoesInternas && (
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-600 mb-1">Observações internas</p>
                <p className="text-sm text-gray-300">{selected.observacoesInternas}</p>
              </div>
            )}
            {selected.observacoesCliente && (
              <div className="mt-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-600 mb-1">Observações ao cliente</p>
                <p className="text-sm text-gray-300">{selected.observacoesCliente}</p>
              </div>
            )}
            {fechado && selected.fechadoPor && (
              <p className="mt-3 text-xs text-gray-600">
                Fechado por {selected.fechadoPor.name}
              </p>
            )}
          </div>

          {/* Accordion sections */}
          <Section title="Efetivos" icon={<Users size={14} className="text-ber-olive" />}
            count={selected.efetivos.length} open={openSections.efetivos} onToggle={() => toggleSection('efetivos')}>
            <EfetivosSection />
          </Section>

          <Section title="Atividades" icon={<ClipboardList size={14} className="text-blue-400" />}
            count={selected.atividades.length} open={openSections.atividades} onToggle={() => toggleSection('atividades')}>
            <AtividadesSection />
          </Section>

          <Section title="Ocorrências" icon={<AlertTriangle size={14} className="text-yellow-400" />}
            count={selected.ocorrencias.length} open={openSections.ocorrencias} onToggle={() => toggleSection('ocorrencias')}>
            <OcorrenciasSection />
          </Section>

          <Section title="Visitas" icon={<UserCheck size={14} className="text-purple-400" />}
            count={selected.visitas.length} open={openSections.visitas} onToggle={() => toggleSection('visitas')}>
            <VisitasSection />
          </Section>

          <Section title="Materiais" icon={<Package size={14} className="text-orange-400" />}
            count={selected.materiais.length} open={openSections.materiais} onToggle={() => toggleSection('materiais')}>
            <MateriaisSection />
          </Section>

          <Section title="Equipamentos" icon={<Wrench size={14} className="text-gray-400" />}
            count={selected.equipamentos.length} open={openSections.equipamentos} onToggle={() => toggleSection('equipamentos')}>
            <EquipamentosSection />
          </Section>
        </div>
      )}
    </div>
  );
}
