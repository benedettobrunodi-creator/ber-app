'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Plus, Trash2, Download, X, Upload, ChevronDown, ChevronUp, Settings, Camera } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from 'recharts';

interface ObraInfo {
  id: string;
  name: string;
  client: string | null;
  expectedEndDate: string | null;
  startDate: string | null;
  progressPercent: number;
}

interface ObraAmbiente {
  id: string;
  nome: string;
  cor: string;
}

interface RelatorioPendencia {
  id?: string;
  descricao: string;
  responsavel?: string;
  prazo?: string;
  status: string;
  categoria: string;
  ordem: number;
}

interface RelatorioMarco {
  id?: string;
  nome: string;
  data: string;
  tipo: 'concluido' | 'proximo';
}

interface RelatorioFoto {
  id: string;
  url: string;
  legenda?: string;
  anguloId?: string | null;
  angulo?: { id: string; nome: string } | null;
  ordem: number;
}

interface CurvaSPonto {
  id?: string;
  semana: string;
  planejadoPct?: number | null;
  realizadoPct?: number | null;
}

interface EfetivoDisciplina { disciplina: string; quantidade: number; }

interface Relatorio {
  id: string;
  numero: number;
  periodoInicio: string;
  periodoFim: string;
  status: string;
  avancoPct: number;
  avancoDelta?: number | null;
  diasTrabalhados?: number | null;
  diasUteis?: number | null;
  diasImprodutivos?: number | null;
  motivoImprodutivo?: string | null;
  efetivoMedio?: number | null;
  destaques?: string | null;
  proximosSete?: string | null;
  responsavelNome?: string | null;
  dataContrato?: string | null;
  efetivoPorDisciplina?: EfetivoDisciplina[] | null;
  pendencias: RelatorioPendencia[];
  marcos: RelatorioMarco[];
  atividadesSemana?: AtividadeSemana[] | null;
  pontosAtencao?: PontoAtencao[] | null;
  planoAcao?: PlanoAcaoItem[] | null;
  dataInicioObra?: string | null;
  dataPrevistaTermino?: string | null;
  dataRealTermino?: string | null;
  secoesPdf?: Record<string, boolean> | null;
  fotos: RelatorioFoto[];
}

interface TarefaCron { wbs: string; nome: string; inicio: string | null; fim: string | null; percentualConcluido: number; }
interface AtividadeSemana { wbs: string; nome: string; inicio: string | null; fim: string | null; percentualConcluido: number; tipo: 'andamento' | 'proximo'; }
interface PontoAtencao { descricao: string; severidade: 'atencao' | 'critico'; }
interface PlanoAcaoItem { atividadeAtrasada: string; acaoCorretiva: string; responsavel?: string; prazo?: string; }
interface EfetivosDia { data: string; total: number; }

const STATUS_OPTS = [
  { value: 'no_prazo',  label: 'NO PRAZO',  color: 'bg-emerald-100 text-emerald-800' },
  { value: 'em_risco',  label: 'ATENÇÃO',   color: 'bg-amber-100  text-amber-800'   },
  { value: 'atrasado',  label: 'ATRASADO',  color: 'bg-red-100    text-red-800'     },
];

const STATUS_TEMA_OPTS = [
  { value: 'sob_controle', label: 'Sob controle', color: 'bg-green-100 text-green-800'  },
  { value: 'atencao',      label: 'Atenção',      color: 'bg-amber-100 text-amber-800'  },
  { value: 'critico',      label: 'Crítico',      color: 'bg-red-100   text-red-800'    },
];

const DISCIPLINA_OPTS = [
  'Civil', 'Pintura', 'Elétrica', 'Hidráulica', 'Drywall',
  'Ar Condicionado', 'Marcenaria', 'Pedras', 'Serralheria', 'Impermeabilização',
  'Gesso', 'Piso', 'Vidro', 'Paisagismo',
];

const DEFAULT_SECOES_PDF: Record<string, boolean> = {
  fotos: true, curvaS: true, atividades: true, pontosAtencao: true,
  planoAcao: true, equipe: true, histograma: true, marcos: true,
  destaques: true, pendencias: true, proximosSete: true,
};

const SECOES_PDF_LABELS: { key: string; label: string }[] = [
  { key: 'fotos',         label: 'Fotos' },
  { key: 'curvaS',        label: 'Curva S' },
  { key: 'atividades',    label: 'Atividades' },
  { key: 'pontosAtencao', label: 'Pontos de atenção' },
  { key: 'planoAcao',     label: 'Plano de ação' },
  { key: 'equipe',        label: 'Equipe' },
  { key: 'histograma',    label: 'Histograma' },
  { key: 'marcos',        label: 'Marcos' },
  { key: 'destaques',     label: 'Destaques' },
  { key: 'pendencias',    label: 'Itens em aberto' },
  { key: 'proximosSete',  label: 'Próximos 7 dias' },
];

const AMBIENT_COLORS = [
  '#6B7280','#3B82F6','#10B981','#F59E0B','#EF4444',
  '#8B5CF6','#EC4899','#14B8A6','#F97316','#84CC16',
];

function statusLabel(s: string) { return STATUS_OPTS.find(o => o.value === s) ?? STATUS_OPTS[0]; }
function statusTemaLabel(s: string) { return STATUS_TEMA_OPTS.find(o => o.value === s) ?? STATUS_TEMA_OPTS[0]; }
function fmt(iso: string) { return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); }
function fmtFull(iso: string) { return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }

function addDays(iso: string, d: number): string {
  const dt = new Date(iso + 'T12:00:00');
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
}

function weekRange(): { inicio: string; fim: string } {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate() - ((day + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { inicio: mon.toISOString().slice(0, 10), fim: sun.toISOString().slice(0, 10) };
}

function semanaLabel(iso: string, startDate: string | null): string {
  if (!startDate) return fmt(iso);
  const startMs = new Date(startDate + 'T12:00:00').getTime();
  const pointMs = new Date(iso + 'T12:00:00').getTime();
  if (pointMs < startMs) return fmt(iso);
  const wk = Math.round((pointMs - startMs) / (7 * 86400000)) + 1;
  return `Sem. ${wk}`;
}

const emptyForm = (cronPct = 0, prevPct?: number): Omit<Relatorio, 'id' | 'numero'> => {
  const { inicio, fim } = weekRange();
  return {
    periodoInicio: inicio,
    periodoFim: fim,
    status: 'no_prazo',
    avancoPct: cronPct,
    avancoDelta: prevPct != null ? Math.max(0, +(cronPct - prevPct).toFixed(1)) : null,
    diasTrabalhados: null,
    diasUteis: 5,
    diasImprodutivos: 0,
    motivoImprodutivo: null,
    efetivoMedio: null,
    destaques: '',
    proximosSete: '',
    responsavelNome: '',
    dataContrato: null,
    efetivoPorDisciplina: [],
    atividadesSemana: [],
    pontosAtencao: [],
    planoAcao: [],
    dataInicioObra: null,
    dataPrevistaTermino: null,
    dataRealTermino: null,
    secoesPdf: { ...DEFAULT_SECOES_PDF },
    pendencias: [{ descricao: '', status: 'sob_controle', categoria: 'outro', ordem: 0 }],
    marcos: [],
    fotos: [],
  };
};

const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function RelatorioTab({ obraId, obra }: { obraId: string; obra: ObraInfo }) {
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [curvaS, setCurvaS]         = useState<CurvaSPonto[]>([]);
  const [ambientes, setAmbientes]   = useState<ObraAmbiente[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<Relatorio | null>(null);
  const [form, setForm]             = useState(emptyForm(obra.progressPercent));
  const [saving, setSaving]         = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null); // anguloId or 'geral'
  const [tarefasPeriodo, setTarefasPeriodo] = useState<TarefaCron[]>([]);
  const [tarefasProximo, setTarefasProximo] = useState<TarefaCron[]>([]);
  const [efetivos, setEfetivos]     = useState<EfetivosDia[]>([]);
  const [curvaSLocal, setCurvaSLocal] = useState<CurvaSPonto[]>([]);
  const [showAngulosConfig, setShowAngulosConfig] = useState(false);
  const [showSecoesPdf, setShowSecoesPdf] = useState(false);
  const [novoAngulo, setNovoAngulo] = useState('');
  const [selDisciplina, setSelDisciplina] = useState<string>(DISCIPLINA_OPTS[0]);
  const [customDisciplina, setCustomDisciplina] = useState('');
  const [todasTarefas, setTodasTarefas] = useState<TarefaCron[]>([]);
  const [showTarefasPicker, setShowTarefasPicker] = useState(false);
  const fotoRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Chart data
  const curvaSChartData = (() => {
    const map = new Map<string, { semana: string; planejado?: number; realizado?: number }>();
    curvaS.forEach(p => {
      const k = p.semana.slice(0, 10);
      const entry = map.get(k) ?? { semana: k };
      if (p.planejadoPct != null) entry.planejado = +p.planejadoPct;
      if (p.realizadoPct != null) entry.realizado = +p.realizadoPct;
      map.set(k, entry);
    });
    const startIso = obra.startDate?.slice(0, 10) ?? null;
    const endIso   = obra.expectedEndDate?.slice(0, 10) ?? null;
    if (startIso && !map.has(startIso)) map.set(startIso, { semana: startIso });
    if (endIso   && !map.has(endIso))   map.set(endIso,   { semana: endIso });
    const startMs   = startIso ? new Date(startIso + 'T12:00:00').getTime() : null;
    const endMs     = endIso   ? new Date(endIso   + 'T12:00:00').getTime() : null;
    const durationMs = startMs && endMs && endMs > startMs ? endMs - startMs : null;
    return Array.from(map.values())
      .sort((a, b) => a.semana.localeCompare(b.semana))
      .map(p => {
        const pointMs = new Date(p.semana + 'T12:00:00').getTime();
        const label   = semanaLabel(p.semana, startIso);
        let tendencia: number | undefined;
        if (startMs != null && durationMs) {
          tendencia = +Math.min(100, Math.max(0, (pointMs - startMs) / durationMs * 100)).toFixed(1);
        }
        return { ...p, label, tendencia };
      });
  })();

  const histogramaData = efetivos.map(e => ({
    dia: DIAS_PT[new Date(e.data + 'T12:00:00').getDay()],
    data: fmt(e.data.slice(0, 10)),
    trabalhadores: e.total,
  }));

  // ─── Load ───────────────────────────────────────────────────────────────────

  async function load() {
    setLoading(true);
    try {
      const [rRes, cRes, aRes, tRes] = await Promise.all([
        api.get(`/obras/${obraId}/relatorios`),
        api.get(`/obras/${obraId}/relatorios/curva-s`),
        api.get(`/obras/${obraId}/ambientes`),
        api.get(`/obras/${obraId}/relatorios/tarefas`),
      ]);
      setRelatorios(rRes.data.data ?? []);
      setCurvaS(cRes.data.data ?? []);
      setAmbientes((aRes.data.data ?? []).map((a: any) => ({ id: a.id, nome: a.nome, cor: a.cor ?? '#6B7280' })));
      setTodasTarefas(tRes.data.data ?? []);
    } catch { /* empty */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, [obraId]);

  async function loadDadosPeriodo(inicio: string, fim: string) {
    try {
      const res = await api.get(`/obras/${obraId}/relatorios/dados-periodo`, { params: { inicio, fim } });
      const d = res.data.data;
      setTarefasPeriodo(d.tarefasPeriodo ?? []);
      setTarefasProximo(d.tarefasProximo ?? []);
      setEfetivos(d.efetivos ?? []);
    } catch { /* ok */ }
  }

  // ─── Ambientes CRUD ─────────────────────────────────────────────────────────

  async function addAngulo() {
    const nome = novoAngulo.trim();
    if (!nome) return;
    const cor = AMBIENT_COLORS[ambientes.length % AMBIENT_COLORS.length];
    try {
      const res = await api.post(`/obras/${obraId}/ambientes`, { nome, posX: 50, posY: 50, cor });
      const a = res.data.data ?? res.data;
      setAmbientes(prev => [...prev, { id: a.id, nome: a.nome, cor: a.cor }]);
      setNovoAngulo('');
    } catch { alert('Erro ao criar ambiente'); }
  }

  async function removeAngulo(id: string) {
    if (!confirm('Remover este ambiente? As fotos vinculadas a ele serão desvinculadas.')) return;
    try {
      await api.delete(`/obras/${obraId}/ambientes/${id}`);
      setAmbientes(prev => prev.filter(a => a.id !== id));
    } catch { alert('Erro ao remover ambiente'); }
  }

  // ─── Form open/close ────────────────────────────────────────────────────────

  function openNew() {
    const prev = relatorios[0];
    const f = emptyForm(obra.progressPercent, prev ? +prev.avancoPct : undefined);
    f.dataInicioObra = obra.startDate ? obra.startDate.slice(0, 10) : null;
    f.dataPrevistaTermino = obra.expectedEndDate ? obra.expectedEndDate.slice(0, 10) : null;
    f.dataRealTermino = null;
    setForm(f);
    setEditing(null);
    setCurvaSLocal(curvaS.map(p => ({ ...p, semana: p.semana.slice(0, 10) })));
    setShowForm(true);
    loadDadosPeriodo(f.periodoInicio, f.periodoFim);
  }

  function openEdit(r: Relatorio) {
    setForm({
      periodoInicio: r.periodoInicio.slice(0, 10),
      periodoFim:    r.periodoFim.slice(0, 10),
      status:        r.status,
      avancoPct:     +r.avancoPct,
      avancoDelta:   r.avancoDelta != null ? +r.avancoDelta : null,
      diasTrabalhados:  r.diasTrabalhados ?? null,
      diasUteis:        r.diasUteis ?? null,
      diasImprodutivos: r.diasImprodutivos ?? null,
      motivoImprodutivo: r.motivoImprodutivo ?? null,
      efetivoMedio:   r.efetivoMedio != null ? +r.efetivoMedio : null,
      destaques:      r.destaques ?? '',
      proximosSete:   r.proximosSete ?? '',
      responsavelNome: r.responsavelNome ?? '',
      dataContrato:   r.dataContrato ? r.dataContrato.slice(0, 10) : null,
      efetivoPorDisciplina: Array.isArray(r.efetivoPorDisciplina) ? r.efetivoPorDisciplina : [],
      atividadesSemana: Array.isArray(r.atividadesSemana) ? r.atividadesSemana : [],
      pontosAtencao: Array.isArray(r.pontosAtencao) ? r.pontosAtencao : [],
      planoAcao: Array.isArray(r.planoAcao) ? r.planoAcao : [],
      dataInicioObra: r.dataInicioObra ? r.dataInicioObra.slice(0, 10) : null,
      dataPrevistaTermino: r.dataPrevistaTermino ? r.dataPrevistaTermino.slice(0, 10) : null,
      dataRealTermino: r.dataRealTermino ? r.dataRealTermino.slice(0, 10) : null,
      secoesPdf: r.secoesPdf ?? { ...DEFAULT_SECOES_PDF },
      pendencias:     r.pendencias.length ? r.pendencias : [{ descricao: '', status: 'sob_controle', categoria: 'outro', ordem: 0 }],
      marcos:         r.marcos.map(m => ({ ...m, data: m.data.slice(0, 10) })),
      fotos:          r.fotos,
    });
    setEditing(r);
    setCurvaSLocal(curvaS.map(p => ({ ...p, semana: p.semana.slice(0, 10) })));
    setShowForm(true);
    loadDadosPeriodo(r.periodoInicio.slice(0, 10), r.periodoFim.slice(0, 10));
  }

  // ─── Curva S helpers ────────────────────────────────────────────────────────

  function addCurvaSWeek() {
    const last = curvaSLocal[curvaSLocal.length - 1];
    const base = last ? last.semana : (obra.startDate?.slice(0, 10) ?? form.periodoFim);
    const next = addDays(base, 7);
    setCurvaSLocal(prev => [...prev, { semana: next, planejadoPct: null }]);
  }

  function updateCurvaSPonto(i: number, field: 'planejadoPct' | 'realizadoPct' | 'semana', value: string) {
    setCurvaSLocal(prev => {
      const updated = prev.map((p, idx) => {
        if (idx !== i) return p;
        if (field === 'semana') return { ...p, semana: value };
        return { ...p, [field]: value ? +value : null };
      });
      // When the first row's date changes, cascade 7-day intervals to all subsequent rows
      if (field === 'semana' && i === 0 && value) {
        const base = new Date(value + 'T12:00:00');
        if (!isNaN(base.getTime())) {
          return updated.map((p, idx) => {
            if (idx === 0) return p;
            const d = new Date(base);
            d.setDate(d.getDate() + idx * 7);
            return { ...p, semana: d.toISOString().slice(0, 10) };
          });
        }
      }
      return updated;
    });
  }

  function removeCurvaSPonto(i: number) {
    setCurvaSLocal(prev => prev.filter((_, idx) => idx !== i));
  }

  async function saveCurvaS() {
    const pontos = curvaSLocal
      .filter(p => p.semana && (p.planejadoPct != null || p.realizadoPct != null))
      .map(p => ({
        semana: p.semana,
        planejadoPct: p.planejadoPct ?? null,
        realizadoPct: p.realizadoPct ?? null,
      }));
    const cRes = await api.put(`/obras/${obraId}/relatorios/curva-s`, { pontos });
    setCurvaS(cRes.data.data ?? []);
  }

  // ─── Pendências ─────────────────────────────────────────────────────────────

  function addPendencia() {
    setForm(f => ({ ...f, pendencias: [...f.pendencias, { descricao: '', status: 'sob_controle', categoria: 'outro', ordem: f.pendencias.length }] }));
  }
  function updatePendencia(i: number, field: string, value: string) {
    setForm(f => ({ ...f, pendencias: f.pendencias.map((p, idx) => idx === i ? { ...p, [field]: value } : p) }));
  }
  function removePendencia(i: number) {
    setForm(f => ({ ...f, pendencias: f.pendencias.filter((_, idx) => idx !== i) }));
  }

  // ─── Fotos ──────────────────────────────────────────────────────────────────

  async function ensureSaved(): Promise<string | null> {
    if (editing) return editing.id;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { fotos: _fotos, ...formWithoutFotos } = form;
      const payload = {
        ...formWithoutFotos,
        avancoPct:    +form.avancoPct,
        avancoDelta:  form.avancoDelta != null ? +form.avancoDelta : null,
        efetivoMedio: form.efetivoMedio != null ? +form.efetivoMedio : null,
        pendencias:   form.pendencias.filter(p => (p.descricao ?? '').trim()).map(({ descricao, responsavel, prazo, status, categoria, ordem }) => ({ descricao, responsavel: responsavel ?? null, prazo: prazo || null, status, categoria, ordem })),
        marcos:       form.marcos.filter(m => (m.nome ?? '').trim()).map(({ nome, data, tipo }) => ({ nome, data, tipo })),
      };
      const res = await api.post(`/obras/${obraId}/relatorios`, payload);
      const novo = res.data.data as Relatorio;
      setRelatorios(prev => [novo, ...prev]);
      setEditing(novo);
      return novo.id;
    } catch (e: any) {
      alert(e?.response?.data?.error?.message ?? e?.message ?? 'Erro ao salvar relatório');
      return null;
    }
  }

  async function uploadFoto(file: File, anguloId: string | null) {
    const key = anguloId ?? 'geral';
    setUploadingFoto(key);
    try {
      const relId = await ensureSaved();
      if (!relId) { setUploadingFoto(null); return; }
      const fd = new FormData();
      fd.append('file', file);
      if (anguloId) fd.append('anguloId', anguloId);
      const res = await api.post(`/obras/${obraId}/relatorios/${relId}/fotos`, fd);
      const foto = res.data.data as RelatorioFoto;
      setForm(f => ({ ...f, fotos: [...f.fotos, foto] }));
      setRelatorios(prev => prev.map(r => r.id === relId ? { ...r, fotos: [...r.fotos, foto] } : r));
    } catch { alert('Erro ao enviar foto'); }
    setUploadingFoto(null);
  }

  async function deleteFoto(relatorioId: string, fotoId: string) {
    await api.delete(`/obras/${obraId}/relatorios/${relatorioId}/fotos/${fotoId}`);
    setForm(f => ({ ...f, fotos: f.fotos.filter(ft => ft.id !== fotoId) }));
    setRelatorios(prev => prev.map(r => r.id === relatorioId ? { ...r, fotos: r.fotos.filter(ft => ft.id !== fotoId) } : r));
  }

  // ─── Save ───────────────────────────────────────────────────────────────────

  async function save() {
    setSaving(true);
    try {
      try {
        await saveCurvaS();
      } catch (ce: any) {
        console.warn('saveCurvaS falhou (ignorando):', ce?.message);
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { fotos: _fotos, ...formWithoutFotos } = form;
      const payload = {
        ...formWithoutFotos,
        avancoPct:    +form.avancoPct,
        avancoDelta:  form.avancoDelta != null ? +form.avancoDelta : null,
        efetivoMedio: form.efetivoMedio != null ? +form.efetivoMedio : null,
        pendencias:   form.pendencias.filter(p => (p.descricao ?? '').trim()).map(({ descricao, responsavel, prazo, status, categoria, ordem }) => ({ descricao, responsavel: responsavel ?? null, prazo: prazo || null, status, categoria, ordem })),
        marcos:       form.marcos.filter(m => (m.nome ?? '').trim()).map(({ nome, data, tipo }) => ({ nome, data, tipo })),
      };
      if (editing) {
        const res = await api.patch(`/obras/${obraId}/relatorios/${editing.id}`, payload);
        setRelatorios(prev => prev.map(r => r.id === editing.id ? res.data.data : r));
      } else {
        const res = await api.post(`/obras/${obraId}/relatorios`, payload);
        setRelatorios(prev => [res.data.data, ...prev]);
      }
      setShowForm(false);
    } catch (e: any) {
      alert(e?.response?.data?.error?.message ?? e?.message ?? 'Erro ao salvar');
    }
    setSaving(false);
  }

  async function deleteRelatorio(id: string) {
    if (!confirm('Excluir relatório?')) return;
    await api.delete(`/obras/${obraId}/relatorios/${id}`);
    setRelatorios(prev => prev.filter(r => r.id !== id));
  }

  if (loading) return <div className="flex justify-center py-16 text-sm text-ber-gray">Carregando...</div>;

  // ─── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="px-6 py-5 space-y-4 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold uppercase tracking-widest text-ber-gray">
          Relatórios gerenciais · {relatorios.length}
        </p>
        <button onClick={openNew} className="flex items-center gap-1.5 rounded-lg bg-ber-carbon text-white text-xs font-semibold px-3 py-1.5 hover:bg-ber-carbon/80 transition-colors">
          <Plus size={13} /> Novo relatório
        </button>
      </div>

      {/* Curva S chart — visível na lista */}
      {curvaS.length >= 1 && !showForm && (
        <div className="rounded-xl border border-ber-border bg-white px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-ber-gray mb-3">Curva S — Planejado vs. Realizado</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={curvaSChartData} margin={{ top: 4, right: 12, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip
                formatter={(v: any) => `${v}%`}
                labelFormatter={(label: any, payload: any) => {
                  const semana = payload?.[0]?.payload?.semana;
                  return semana ? `${label} (${fmtFull(semana)})` : label;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="tendencia" stroke="#D1D5DB" strokeDasharray="2 4" strokeWidth={1.5} dot={false} name="Tendência" connectNulls />
              <Line type="monotone" dataKey="planejado" stroke="#3B82F6" strokeDasharray="4 2" strokeWidth={2} dot={false} name="Planejado" connectNulls />
              <Line type="monotone" dataKey="realizado" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} name="Realizado" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Empty state */}
      {relatorios.length === 0 && !showForm && (
        <div className="rounded-xl border border-ber-border bg-white px-6 py-10 text-center">
          <p className="text-sm text-ber-gray">Nenhum relatório criado.</p>
          <p className="text-xs text-ber-gray/60 mt-1">Clique em "Novo relatório" para começar.</p>
        </div>
      )}

      {/* List */}
      {!showForm && relatorios.map(r => {
        const st = statusLabel(r.status);
        return (
          <div key={r.id} className="rounded-xl border border-ber-border bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-ber-border">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black text-ber-gray">RT-{String(r.numero).padStart(3, '0')}</span>
                <span className="text-xs text-ber-carbon font-medium">
                  {fmtFull(r.periodoInicio.slice(0, 10))} — {fmtFull(r.periodoFim.slice(0, 10))}
                </span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => window.open(`/obras/${obraId}/relatorios/${r.id}/print`, '_blank')}
                  className="flex items-center gap-1 text-[11px] text-ber-gray hover:text-ber-carbon transition-colors">
                  <Download size={12} /> PDF
                </button>
                <button onClick={() => openEdit(r)} className="text-[11px] text-ber-gray hover:text-ber-carbon transition-colors">Editar</button>
                <button onClick={() => deleteRelatorio(r.id)} className="text-ber-gray/40 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
            <div className="px-4 py-3 grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-lg font-black text-ber-carbon">{+r.avancoPct}%</p>
                <p className="text-[9px] text-ber-gray uppercase tracking-wide">Avanço acumulado</p>
              </div>
              <div>
                <p className="text-lg font-black text-ber-carbon">{r.avancoDelta != null ? `+${+r.avancoDelta}%` : '—'}</p>
                <p className="text-[9px] text-ber-gray uppercase tracking-wide">Na semana</p>
              </div>
              <div>
                <p className="text-lg font-black text-ber-carbon">
                  {r.diasTrabalhados != null && r.diasUteis != null ? `${r.diasTrabalhados}/${r.diasUteis}` : '—'}
                </p>
                <p className="text-[9px] text-ber-gray uppercase tracking-wide">Dias trabalhados</p>
              </div>
              <div>
                <p className="text-lg font-black text-ber-carbon">{r.efetivoMedio != null ? +r.efetivoMedio : '—'}</p>
                <p className="text-[9px] text-ber-gray uppercase tracking-wide">Efetivo médio</p>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── FORM ─────────────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="rounded-xl border border-ber-border bg-white overflow-hidden">

          {/* Form header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-ber-border">
            <div>
              <p className="text-base font-bold text-ber-carbon">
                {editing ? `Editar RT-${String(editing.numero).padStart(3, '0')}` : 'Novo relatório semanal'}
              </p>
              <p className="text-xs text-ber-gray mt-0.5">Preencha as informações do período.</p>
            </div>
            <button onClick={() => setShowForm(false)} className="text-ber-gray hover:text-ber-carbon"><X size={18} /></button>
          </div>

          {/* ── SEÇÕES DO PDF ──────────────────────────────────────────────────── */}
          <div className="px-5 py-3 border-b border-ber-border bg-[#F7F7F5]">
            <button onClick={() => setShowSecoesPdf(v => !v)}
              className="flex items-center gap-2 text-xs font-semibold text-ber-gray hover:text-ber-carbon transition-colors w-full text-left">
              <Settings size={12} />
              Seções do PDF para o cliente
              {showSecoesPdf ? <ChevronUp size={12} className="ml-auto" /> : <ChevronDown size={12} className="ml-auto" />}
            </button>
            {showSecoesPdf && (
              <div className="mt-3 flex flex-wrap gap-2">
                {SECOES_PDF_LABELS.map(({ key, label }) => {
                  const active = (form.secoesPdf ?? DEFAULT_SECOES_PDF)[key] !== false;
                  return (
                    <button key={key} onClick={() => setForm(f => ({ ...f, secoesPdf: { ...(f.secoesPdf ?? DEFAULT_SECOES_PDF), [key]: !active } }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${active ? 'bg-ber-carbon text-white border-ber-carbon' : 'bg-white text-ber-gray border-ber-border'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-ber-gray/30'}`} />
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="divide-y divide-ber-border">

            {/* ── 1. PERÍODO E STATUS ─────────────────────────────────────────── */}
            <FormSection title="Período e situação" desc="Semana de referência e status geral da obra.">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Início">
                    <input type="date" value={form.periodoInicio}
                      onChange={e => { setForm(f => ({ ...f, periodoInicio: e.target.value })); loadDadosPeriodo(e.target.value, form.periodoFim); }}
                      className="fi" />
                  </Field>
                  <Field label="Fim">
                    <input type="date" value={form.periodoFim}
                      onChange={e => { setForm(f => ({ ...f, periodoFim: e.target.value })); loadDadosPeriodo(form.periodoInicio, e.target.value); }}
                      className="fi" />
                  </Field>
                </div>
                <Field label="Situação">
                  <div className="grid grid-cols-3 gap-2">
                    {STATUS_OPTS.map(o => (
                      <button key={o.value} onClick={() => setForm(f => ({ ...f, status: o.value }))}
                        className={`py-2.5 rounded-lg border-2 text-xs font-bold transition-all ${form.status === o.value ? `${o.color} border-current` : 'border-ber-border text-ber-gray hover:border-ber-carbon/30'}`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Field label="Avanço acumulado (%)" hint={`Cronograma atual: ${obra.progressPercent}%`}>
                  <div className="flex items-center gap-3">
                    <input type="number" min={0} max={100} step={1} value={form.avancoPct}
                      onChange={e => setForm(f => ({ ...f, avancoPct: +e.target.value }))}
                      className="fi w-20 text-center text-lg font-bold" />
                    <div className="flex-1 h-2 rounded-full bg-ber-border overflow-hidden">
                      <div className="h-full rounded-full bg-ber-carbon/70" style={{ width: `${form.avancoPct}%` }} />
                    </div>
                    <span className="text-sm font-bold text-ber-carbon">{form.avancoPct}%</span>
                  </div>
                </Field>
                <Field label="Avanço nesta semana (%)">
                  <input type="number" min={0} max={100} step={0.1} value={form.avancoDelta ?? ''}
                    onChange={e => setForm(f => ({ ...f, avancoDelta: e.target.value ? +e.target.value : null }))}
                    placeholder="Ex: 3.5" className="fi w-28" />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <Field label="Início da obra (planejado)">
                  <input type="date" value={form.dataInicioObra ?? ''}
                    onChange={e => setForm(f => ({ ...f, dataInicioObra: e.target.value || null }))}
                    className="fi" />
                </Field>
                <Field label="Previsão de término">
                  <input type="date" value={form.dataPrevistaTermino ?? ''}
                    onChange={e => setForm(f => ({ ...f, dataPrevistaTermino: e.target.value || null }))}
                    className="fi" />
                </Field>
                <Field label="Término real">
                  <input type="date" value={form.dataRealTermino ?? ''}
                    onChange={e => setForm(f => ({ ...f, dataRealTermino: e.target.value || null }))}
                    className="fi" />
                </Field>
              </div>
            </FormSection>

            {/* ── 2. FOTOS POR AMBIENTE ────────────────────────────────────────── */}
            <FormSection title="Fotos por ambiente"
              desc="Fotografe os mesmos ângulos toda semana para acompanhar a evolução.">

              {/* Manage ângulos */}
              <div className="mb-4">
                <button onClick={() => setShowAngulosConfig(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-ber-gray hover:text-ber-carbon transition-colors mb-2">
                  <Settings size={12} />
                  {ambientes.length === 0 ? 'Configurar ângulos da obra' : `${ambientes.length} ângulo(s) configurado(s)`}
                  {showAngulosConfig ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {showAngulosConfig && (
                  <div className="rounded-lg border border-ber-border bg-[#F7F7F5] p-3 mb-3 space-y-2">
                    {ambientes.map(a => (
                      <div key={a.id} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: a.cor }} />
                        <span className="text-sm text-ber-carbon flex-1">{a.nome}</span>
                        <button onClick={() => removeAngulo(a.id)} className="text-ber-gray/40 hover:text-red-500"><X size={13} /></button>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <input value={novoAngulo} onChange={e => setNovoAngulo(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addAngulo()}
                        placeholder="Nome do ângulo (ex: Fachada, Cozinha...)" className="fi flex-1 py-1.5 text-sm" />
                      <button onClick={addAngulo} className="flex items-center gap-1 text-xs font-semibold text-ber-carbon px-3 py-1.5 rounded-lg border border-ber-border hover:border-ber-carbon/40 transition-colors">
                        <Plus size={12} /> Adicionar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card per ângulo */}
                {ambientes.map(angulo => {
                  const fotosAngulo = form.fotos.filter(ft => ft.anguloId === angulo.id);
                  const mainFoto = fotosAngulo[fotosAngulo.length - 1];
                  const isUploading = uploadingFoto === angulo.id;
                  const prevFotos = relatorios
                    .filter(r => r.id !== editing?.id)
                    .sort((a, b) => b.numero - a.numero)
                    .flatMap(r => r.fotos.filter(f => f.anguloId === angulo.id).slice(0, 1))
                    .slice(0, 3);
                  return (
                    <div key={angulo.id} className="rounded-xl border border-ber-border overflow-hidden bg-white">
                      {/* Main photo */}
                      <div className="relative aspect-video bg-[#F0F0ED] cursor-pointer group"
                        onClick={() => fotoRefs.current[angulo.id]?.click()}>
                        {mainFoto ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={mainFoto.url} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-end justify-end p-2">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full px-2 py-1 flex items-center gap-1 text-xs font-medium">
                                <Camera size={12} /> Nova foto
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-ber-gray/30">
                            <Camera size={32} />
                            <span className="text-xs">Clique para fotografar</span>
                          </div>
                        )}
                        {isUploading && (
                          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                            <span className="text-sm text-ber-gray">Enviando...</span>
                          </div>
                        )}
                      </div>
                      {/* Footer */}
                      <div className="px-3 py-2 border-t border-ber-border">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: angulo.cor }} />
                          <span className="text-xs font-semibold text-ber-carbon flex-1">{angulo.nome}</span>
                          {fotosAngulo.length > 0 && <span className="text-[10px] text-ber-gray/50">{fotosAngulo.length} esta semana</span>}
                        </div>
                        {(fotosAngulo.length > 0 || prevFotos.length > 0) && (
                          <div className="flex gap-1.5 flex-wrap items-center">
                            {fotosAngulo.map(ft => (
                              <div key={ft.id} className="relative group/th shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={ft.url} alt="" className="w-9 h-9 rounded object-cover border border-ber-border" />
                                {editing && (
                                  <button onClick={e => { e.stopPropagation(); deleteFoto(editing.id, ft.id); }}
                                    className="absolute -top-1 -right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover/th:opacity-100 transition-opacity">
                                    <X size={8} />
                                  </button>
                                )}
                              </div>
                            ))}
                            {prevFotos.length > 0 && (
                              <>
                                <div className="w-px h-7 bg-ber-border mx-0.5" />
                                {prevFotos.map((ft, i) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img key={ft.id} src={ft.url} alt="" className="w-9 h-9 rounded object-cover border border-ber-border opacity-35 shrink-0" title={`Sem. anterior ${i + 1}`} />
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      <input ref={el => { fotoRefs.current[angulo.id] = el; }} type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadFoto(f, angulo.id); e.target.value = ''; }} />
                    </div>
                  );
                })}

                {/* Fotos gerais */}
                {(() => {
                  const semAngulo = form.fotos.filter(ft => !ft.anguloId);
                  const isUploading = uploadingFoto === 'geral';
                  return (
                    <div className="rounded-xl border border-ber-border overflow-hidden bg-white">
                      <div className="relative aspect-video bg-[#F0F0ED] cursor-pointer group"
                        onClick={() => fotoRefs.current['geral']?.click()}>
                        {semAngulo.length > 0 ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={semAngulo[semAngulo.length - 1].url} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-end justify-end p-2">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full px-2 py-1 flex items-center gap-1 text-xs font-medium">
                                <Camera size={12} /> Nova foto
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-ber-gray/30">
                            <Camera size={32} />
                            <span className="text-xs">Fotos gerais</span>
                          </div>
                        )}
                        {isUploading && (
                          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                            <span className="text-sm text-ber-gray">Enviando...</span>
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2 border-t border-ber-border">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-semibold text-ber-gray flex-1">Fotos gerais</span>
                          {semAngulo.length > 0 && <span className="text-[10px] text-ber-gray/50">{semAngulo.length} foto(s)</span>}
                        </div>
                        {semAngulo.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap">
                            {semAngulo.map(ft => (
                              <div key={ft.id} className="relative group/th shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={ft.url} alt="" className="w-9 h-9 rounded object-cover border border-ber-border" />
                                {editing && (
                                  <button onClick={e => { e.stopPropagation(); deleteFoto(editing.id, ft.id); }}
                                    className="absolute -top-1 -right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover/th:opacity-100 transition-opacity">
                                    <X size={8} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <input ref={el => { fotoRefs.current['geral'] = el; }} type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadFoto(f, null); e.target.value = ''; }} />
                    </div>
                  );
                })()}
              </div>
            </FormSection>

            {/* ── 3. CURVA S ───────────────────────────────────────────────────── */}
            <FormSection title="Curva S — planejado"
              desc="Digite o % de avanço acumulado (previsto e realizado) por semana.">
              <div className="overflow-hidden rounded-lg border border-ber-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F7F7F5] border-b border-ber-border">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-ber-gray w-24">Semana</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-ber-gray w-24">Data</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-ber-gray">Previsto acumulado (%)</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-ber-gray">Realizado acumulado (%)</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ber-border">
                    {curvaSLocal.map((p, i) => {
                      // Use obra startDate if available, otherwise fall back to first row's date
                      const startIso = obra.startDate?.slice(0, 10) ?? curvaSLocal[0]?.semana ?? null;
                      const weekNum  = startIso && p.semana
                        ? Math.round((new Date(p.semana + 'T12:00:00').getTime() - new Date(startIso + 'T12:00:00').getTime()) / (7 * 86400000)) + 1
                        : null;
                      return (
                      <tr key={i} className="bg-white">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-0.5">
                            <span className="text-xs text-ber-gray shrink-0">Sem.</span>
                            <input type="text" inputMode="numeric" value={weekNum ?? ''}
                              onChange={e => {
                                const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
                                if (!n || n < 1 || !startIso) return;
                                const base = new Date(startIso + 'T12:00:00');
                                base.setDate(base.getDate() + (n - 1) * 7);
                                updateCurvaSPonto(i, 'semana', base.toISOString().slice(0, 10));
                              }}
                              className="fi py-1 w-12 text-center text-sm font-medium" />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <input type="date" value={p.semana}
                            onChange={e => updateCurvaSPonto(i, 'semana', e.target.value)}
                            className="fi py-1 text-xs text-ber-gray w-36" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min={0} max={100} step={1} value={p.planejadoPct ?? ''}
                            onChange={e => updateCurvaSPonto(i, 'planejadoPct', e.target.value)}
                            placeholder="0" className="fi py-1.5 w-20 text-center" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min={0} max={100} step={1} value={p.realizadoPct ?? ''}
                            onChange={e => updateCurvaSPonto(i, 'realizadoPct', e.target.value)}
                            placeholder="—" className="fi py-1.5 w-20 text-center text-emerald-700" />
                        </td>
                        <td className="px-2 py-2">
                          <button onClick={() => removeCurvaSPonto(i)} className="text-ber-gray/30 hover:text-red-500"><X size={14} /></button>
                        </td>
                      </tr>
                      );
                    })}
                    {curvaSLocal.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-sm text-ber-gray/50">
                          Nenhuma semana cadastrada. Clique em "Adicionar semana" para começar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <button onClick={addCurvaSWeek}
                className="flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon font-medium mt-3 px-3 py-1.5 rounded-lg border border-ber-border hover:border-ber-carbon/40 transition-colors">
                <Plus size={13} /> Adicionar semana
              </button>
            </FormSection>

            {/* ── 4. ATIVIDADES ────────────────────────────────────────────────── */}
            <FormSection title="Atividades da semana"
              desc="Selecione as atividades do cronograma para esta semana e para o próximo período.">
              {(() => {
                const atividades = form.atividadesSemana ?? [];
                const andamento = atividades.filter(a => a.tipo === 'andamento');
                const proximo   = atividades.filter(a => a.tipo === 'proximo');
                const selecionadas = new Set(atividades.map(a => a.wbs));

                function addAtividade(t: TarefaCron, tipo: 'andamento' | 'proximo') {
                  if (selecionadas.has(t.wbs)) return;
                  setForm(f => ({ ...f, atividadesSemana: [...(f.atividadesSemana ?? []), { ...t, tipo }] }));
                }
                function removeAtividade(wbs: string) {
                  setForm(f => ({ ...f, atividadesSemana: (f.atividadesSemana ?? []).filter(a => a.wbs !== wbs) }));
                }
                function changeTipo(wbs: string, tipo: 'andamento' | 'proximo') {
                  setForm(f => ({ ...f, atividadesSemana: (f.atividadesSemana ?? []).map(a => a.wbs === wbs ? { ...a, tipo } : a) }));
                }

                const sugeridoAndamento = new Set(tarefasPeriodo.map(t => t.wbs));
                const sugeridoProximo   = new Set(tarefasProximo.map(t => t.wbs));

                // Show only tasks that overlap current period + next 2 weeks
                const limiteMs = new Date(form.periodoFim + 'T12:00:00').getTime() + 14 * 86_400_000;
                const inicioMs = new Date(form.periodoInicio + 'T12:00:00').getTime();
                const tarefasFiltradas = todasTarefas.filter(t => {
                  if (sugeridoAndamento.has(t.wbs) || sugeridoProximo.has(t.wbs)) return true;
                  if (!t.inicio && !t.fim) return false;
                  const fimMs  = t.fim   ? new Date(t.fim   + 'T12:00:00').getTime() : Infinity;
                  const iniMs  = t.inicio ? new Date(t.inicio + 'T12:00:00').getTime() : -Infinity;
                  return fimMs >= inicioMs && iniMs <= limiteMs;
                });

                return (
                  <div className="space-y-3">
                    {/* Em andamento */}
                    {andamento.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-2">Em andamento nesta semana</p>
                        <div className="space-y-2">
                          {andamento.map(t => (
                            <div key={t.wbs} className="rounded-lg border border-ber-border bg-white px-3 py-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm text-ber-carbon leading-tight flex-1">{t.nome}</p>
                                <span className="text-xs font-bold text-emerald-700 shrink-0">{t.percentualConcluido}%</span>
                                <button onClick={() => removeAtividade(t.wbs)} className="text-ber-gray/30 hover:text-red-500 shrink-0"><X size={13} /></button>
                              </div>
                              <div className="mt-1.5 h-1.5 w-full rounded-full bg-ber-border overflow-hidden">
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${t.percentualConcluido}%` }} />
                              </div>
                              {t.inicio && t.fim && <p className="text-[10px] text-ber-gray mt-1">{fmt(t.inicio)} → {fmt(t.fim)}</p>}
                              <button onClick={() => changeTipo(t.wbs, 'proximo')} className="text-[10px] text-ber-gray/50 hover:text-amber-600 mt-1">mover para próximo período</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Próximo período */}
                    {proximo.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-2">Próximo período</p>
                        <div className="space-y-1.5">
                          {proximo.map(t => (
                            <div key={t.wbs} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-ber-border bg-amber-50/50">
                              <p className="text-sm text-ber-carbon flex-1">{t.nome}</p>
                              {t.inicio && <p className="text-xs text-ber-gray shrink-0">início {fmt(t.inicio)}</p>}
                              <button onClick={() => changeTipo(t.wbs, 'andamento')} className="text-[10px] text-ber-gray/50 hover:text-emerald-600 shrink-0">em andamento</button>
                              <button onClick={() => removeAtividade(t.wbs)} className="text-ber-gray/30 hover:text-red-500 shrink-0"><X size={13} /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {atividades.length === 0 && (
                      <p className="text-sm text-ber-gray/40 italic">Nenhuma atividade selecionada. Use o botão abaixo para adicionar do cronograma.</p>
                    )}

                    {/* Picker */}
                    <button onClick={() => setShowTarefasPicker(v => !v)}
                      className="flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon font-medium px-3 py-1.5 rounded-lg border border-ber-border hover:border-ber-carbon/40 transition-colors">
                      <Plus size={13} /> {showTarefasPicker ? 'Fechar cronograma' : 'Adicionar do cronograma'}
                      {showTarefasPicker ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {showTarefasPicker && todasTarefas.length > 0 && (
                      <div className="rounded-lg border border-ber-border overflow-hidden">
                        <div className="bg-[#F7F7F5] px-3 py-2 border-b border-ber-border">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-ber-gray">Tarefas do cronograma</p>
                          <p className="text-[10px] text-ber-gray/60 mt-0.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" />em andamento no período ·
                            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mx-1" />próximo período · período atual + 2 semanas
                          </p>
                        </div>
                        <div className="max-h-72 overflow-y-auto divide-y divide-ber-border bg-white">
                          {tarefasFiltradas.map(t => {
                            const jaSelecionada = selecionadas.has(t.wbs);
                            const isAndamento = sugeridoAndamento.has(t.wbs);
                            const isProximo   = sugeridoProximo.has(t.wbs);
                            return (
                              <div key={t.wbs} className={`flex items-center gap-2 px-3 py-2 ${jaSelecionada ? 'opacity-30' : 'hover:bg-[#F7F7F5]'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAndamento ? 'bg-emerald-400' : isProximo ? 'bg-amber-400' : 'bg-transparent'}`} />
                                <p className="text-xs text-ber-carbon flex-1 leading-tight">{t.nome}</p>
                                <span className="text-[10px] text-ber-gray/50 shrink-0">{t.percentualConcluido}%</span>
                                {!jaSelecionada && (
                                  <div className="flex gap-1 shrink-0">
                                    <button onClick={() => addAtividade(t, 'andamento')}
                                      className="text-[10px] px-2 py-0.5 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-medium">
                                      Andamento
                                    </button>
                                    <button onClick={() => addAtividade(t, 'proximo')}
                                      className="text-[10px] px-2 py-0.5 rounded border border-amber-200 text-amber-700 hover:bg-amber-50 font-medium">
                                      Próximo
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {showTarefasPicker && tarefasFiltradas.length === 0 && (
                      <p className="text-xs text-ber-gray/50 italic">{todasTarefas.length === 0 ? 'Nenhum cronograma encontrado.' : 'Nenhuma tarefa nos próximos 14 dias.'}</p>
                    )}
                  </div>
                );
              })()}
            </FormSection>

            {/* ── 4b. PONTOS DE ATENÇÃO ───────────────────────────────────────── */}
            <FormSection title="Pontos de atenção"
              desc="Riscos, bloqueios ou situações que precisam de monitoramento.">
              <div className="space-y-2">
                {(form.pontosAtencao ?? []).map((p, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-ber-border bg-[#F7F7F5]">
                    <input value={p.descricao}
                      onChange={e => setForm(f => ({ ...f, pontosAtencao: (f.pontosAtencao ?? []).map((x, xi) => xi === i ? { ...x, descricao: e.target.value } : x) }))}
                      placeholder="Descreva o ponto de atenção..." className="fi py-1.5 bg-white text-sm flex-1" />
                    <select value={p.severidade}
                      onChange={e => setForm(f => ({ ...f, pontosAtencao: (f.pontosAtencao ?? []).map((x, xi) => xi === i ? { ...x, severidade: e.target.value as 'atencao' | 'critico' } : x) }))}
                      className={`shrink-0 text-[11px] font-bold rounded-md px-2 py-1.5 border-0 cursor-pointer ${p.severidade === 'critico' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                      <option value="atencao">Atenção</option>
                      <option value="critico">Crítico</option>
                    </select>
                    <button onClick={() => setForm(f => ({ ...f, pontosAtencao: (f.pontosAtencao ?? []).filter((_, xi) => xi !== i) }))}
                      className="text-ber-gray/40 hover:text-red-500 shrink-0"><X size={14} /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setForm(f => ({ ...f, pontosAtencao: [...(f.pontosAtencao ?? []), { descricao: '', severidade: 'atencao' }] }))}
                className="flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon font-medium mt-3 px-3 py-1.5 rounded-lg border border-ber-border hover:border-ber-carbon/40 transition-colors">
                <Plus size={13} /> Adicionar ponto
              </button>
            </FormSection>

            {/* ── 4c. PLANO DE AÇÃO ───────────────────────────────────────────── */}
            <FormSection title="Plano de ação para atividades em atraso"
              desc="Ações corretivas para recuperar o cronograma.">
              {(form.planoAcao ?? []).length > 0 && (
                <div className="overflow-hidden rounded-lg border border-ber-border mb-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F7F7F5] border-b border-ber-border">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-ber-gray">Atividade atrasada</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-ber-gray">Ação corretiva</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-ber-gray w-28">Responsável</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-ber-gray w-32">Prazo</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ber-border">
                      {(form.planoAcao ?? []).map((p, i) => (
                        <tr key={i} className="bg-white">
                          <td className="px-3 py-2">
                            <input value={p.atividadeAtrasada}
                              onChange={e => setForm(f => ({ ...f, planoAcao: (f.planoAcao ?? []).map((x, xi) => xi === i ? { ...x, atividadeAtrasada: e.target.value } : x) }))}
                              placeholder="Ex: Instalação elétrica" className="fi py-1.5 text-sm" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={p.acaoCorretiva}
                              onChange={e => setForm(f => ({ ...f, planoAcao: (f.planoAcao ?? []).map((x, xi) => xi === i ? { ...x, acaoCorretiva: e.target.value } : x) }))}
                              placeholder="Ex: Adicionar 2 eletricistas" className="fi py-1.5 text-sm" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={p.responsavel ?? ''}
                              onChange={e => setForm(f => ({ ...f, planoAcao: (f.planoAcao ?? []).map((x, xi) => xi === i ? { ...x, responsavel: e.target.value } : x) }))}
                              placeholder="Nome" className="fi py-1.5 text-sm" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="date" value={p.prazo ?? ''}
                              onChange={e => setForm(f => ({ ...f, planoAcao: (f.planoAcao ?? []).map((x, xi) => xi === i ? { ...x, prazo: e.target.value } : x) }))}
                              className="fi py-1.5 text-sm" />
                          </td>
                          <td className="px-2 py-2">
                            <button onClick={() => setForm(f => ({ ...f, planoAcao: (f.planoAcao ?? []).filter((_, xi) => xi !== i) }))}
                              className="text-ber-gray/30 hover:text-red-500"><X size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button onClick={() => setForm(f => ({ ...f, planoAcao: [...(f.planoAcao ?? []), { atividadeAtrasada: '', acaoCorretiva: '', responsavel: '', prazo: '' }] }))}
                className="flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon font-medium px-3 py-1.5 rounded-lg border border-ber-border hover:border-ber-carbon/40 transition-colors">
                <Plus size={13} /> Adicionar ação
              </button>
            </FormSection>

            {/* ── 5. TEMAS EM ABERTO ───────────────────────────────────────────── */}
            <FormSection title="Temas em aberto"
              desc="Itens que precisam de atenção ou decisão para a obra avançar.">
              <div className="space-y-2">
                {form.pendencias.map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 p-2.5 rounded-lg border border-ber-border bg-[#F7F7F5] items-center">
                    <input value={p.descricao} onChange={e => updatePendencia(i, 'descricao', e.target.value)}
                      placeholder="Descreva o tema..." className="fi py-1.5 bg-white text-sm" />
                    <input value={p.responsavel ?? ''} onChange={e => updatePendencia(i, 'responsavel', e.target.value)}
                      placeholder="Responsável" className="fi w-32 py-1.5 bg-white text-sm" />
                    <select value={p.status} onChange={e => updatePendencia(i, 'status', e.target.value)}
                      className={`shrink-0 text-[11px] font-bold rounded-md px-2 py-1.5 border-0 cursor-pointer ${statusTemaLabel(p.status).color}`}>
                      {STATUS_TEMA_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <div className="flex items-center gap-1.5">
                      <input type="date" value={p.prazo ?? ''} onChange={e => updatePendencia(i, 'prazo', e.target.value)}
                        className="fi py-1.5 bg-white text-sm w-36" title="Data limite" />
                      <button onClick={() => removePendencia(i)} className="text-ber-gray/40 hover:text-red-500 shrink-0"><X size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addPendencia}
                className="flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon font-medium mt-3 px-3 py-1.5 rounded-lg border border-ber-border hover:border-ber-carbon/40 transition-colors">
                <Plus size={13} /> Adicionar tema
              </button>
            </FormSection>

            {/* ── 7. EQUIPE ────────────────────────────────────────────────────── */}
            <FormSection title="Equipe e dias" desc="Dados de produtividade da semana.">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Dias trabalhados">
                  <input type="number" min={0} max={7} value={form.diasTrabalhados ?? ''}
                    onChange={e => setForm(f => ({ ...f, diasTrabalhados: e.target.value ? +e.target.value : null }))}
                    placeholder="4" className="fi text-center" />
                </Field>
                <Field label="Dias úteis">
                  <input type="number" min={0} max={7} value={form.diasUteis ?? ''}
                    onChange={e => setForm(f => ({ ...f, diasUteis: e.target.value ? +e.target.value : null }))}
                    placeholder="5" className="fi text-center" />
                </Field>
                <Field label="Média pessoas/dia">
                  <input type="number" min={0} step={0.5} value={form.efetivoMedio ?? ''}
                    onChange={e => setForm(f => ({ ...f, efetivoMedio: e.target.value ? +e.target.value : null }))}
                    placeholder="12" className="fi text-center" />
                </Field>
              </div>
            </FormSection>

            {/* ── 8. HISTOGRAMA ────────────────────────────────────────────────── */}
            <FormSection title="Histograma de efetivos" desc="Efetivos por disciplina e histograma diário do período.">
              {/* Disciplines table */}
              <div className="space-y-2 mb-4">
                {(form.efetivoPorDisciplina ?? []).length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-ber-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#F7F7F5] border-b border-ber-border">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-ber-gray">Disciplina</th>
                          <th className="text-center px-3 py-2 text-xs font-semibold text-ber-gray w-32">Qtd. pessoas</th>
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ber-border">
                        {(form.efetivoPorDisciplina ?? []).map((d, i) => (
                          <tr key={i} className="bg-white">
                            <td className="px-3 py-2 font-medium text-ber-carbon">{d.disciplina}</td>
                            <td className="px-3 py-2 text-center">
                              <input type="number" min={0} step={1} value={d.quantidade}
                                onChange={e => setForm(f => ({ ...f, efetivoPorDisciplina: (f.efetivoPorDisciplina ?? []).map((x, xi) => xi === i ? { ...x, quantidade: e.target.value ? +e.target.value : 0 } : x) }))}
                                className="fi py-1.5 w-20 text-center" />
                            </td>
                            <td className="px-2 py-2">
                              <button onClick={() => setForm(f => ({ ...f, efetivoPorDisciplina: (f.efetivoPorDisciplina ?? []).filter((_, xi) => xi !== i) }))} className="text-ber-gray/30 hover:text-red-500"><X size={14} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Summary row */}
                    <div className="flex items-center gap-6 px-3 py-2 bg-[#F7F7F5] border-t border-ber-border">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-ber-gray">Efetivo total:</span>
                        <span className="text-sm font-bold text-ber-carbon">
                          {(form.efetivoPorDisciplina ?? []).reduce((s, d) => s + (d.quantidade ?? 0), 0)} pessoas
                        </span>
                      </div>
                      {form.efetivoMedio != null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-ber-gray">Média/dia:</span>
                          <span className="text-sm font-bold text-ber-carbon">{form.efetivoMedio} pessoas</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Add discipline row */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <select value={selDisciplina} onChange={e => setSelDisciplina(e.target.value)}
                      className="fi py-1.5 text-sm">
                      {DISCIPLINA_OPTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <button onClick={() => {
                      if ((form.efetivoPorDisciplina ?? []).some(d => d.disciplina === selDisciplina)) return;
                      setForm(f => ({ ...f, efetivoPorDisciplina: [...(f.efetivoPorDisciplina ?? []), { disciplina: selDisciplina, quantidade: 0 }] }));
                    }} className="flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon font-medium px-3 py-1.5 rounded-lg border border-ber-border hover:border-ber-carbon/40 transition-colors">
                      <Plus size={13} /> Adicionar
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="text" value={customDisciplina} onChange={e => setCustomDisciplina(e.target.value)}
                      onKeyDown={e => {
                        if (e.key !== 'Enter') return;
                        const nome = customDisciplina.trim();
                        if (!nome || (form.efetivoPorDisciplina ?? []).some(d => d.disciplina === nome)) return;
                        setForm(f => ({ ...f, efetivoPorDisciplina: [...(f.efetivoPorDisciplina ?? []), { disciplina: nome, quantidade: 0 }] }));
                        setCustomDisciplina('');
                      }}
                      placeholder="Nova disciplina..." className="fi py-1.5 text-sm w-48" />
                    <button onClick={() => {
                      const nome = customDisciplina.trim();
                      if (!nome || (form.efetivoPorDisciplina ?? []).some(d => d.disciplina === nome)) return;
                      setForm(f => ({ ...f, efetivoPorDisciplina: [...(f.efetivoPorDisciplina ?? []), { disciplina: nome, quantidade: 0 }] }));
                      setCustomDisciplina('');
                    }} className="flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon font-medium px-3 py-1.5 rounded-lg border border-ber-border hover:border-ber-carbon/40 transition-colors">
                      <Plus size={13} /> Adicionar nova
                    </button>
                  </div>
                </div>
              </div>
              {/* Daily histogram */}
              {histogramaData.length > 0 && (
                <div className="rounded-lg border border-ber-border bg-[#F7F7F5] px-3 pt-2 pb-1">
                  <ResponsiveContainer width="100%" height={110}>
                    <BarChart data={histogramaData} margin={{ top: 2, right: 8, bottom: 0, left: -28 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E4" vertical={false} />
                      <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip formatter={(v: any) => [`${v} pessoas`, '']} labelFormatter={(l: any, p: any) => p[0]?.payload?.data ?? l} />
                      <Bar dataKey="trabalhadores" fill="#1a1a1a" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </FormSection>

            {/* ── 9. RESPONSÁVEL ───────────────────────────────────────────────── */}
            <FormSection title="Responsável técnico" desc="Nome de quem assina este relatório.">
              <input type="text" value={form.responsavelNome ?? ''}
                onChange={e => setForm(f => ({ ...f, responsavelNome: e.target.value }))}
                placeholder="Nome completo do engenheiro responsável" className="fi w-full max-w-sm" />
            </FormSection>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-ber-border bg-[#F7F7F5]">
            <p className="text-xs text-ber-gray">Campos opcionais podem ser deixados em branco.</p>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-ber-gray hover:text-ber-carbon transition-colors">Cancelar</button>
              <button onClick={save} disabled={saving}
                className="px-5 py-2 rounded-lg bg-ber-carbon text-white text-sm font-semibold hover:bg-ber-carbon/80 disabled:opacity-50 transition-colors">
                {saving ? 'Salvando...' : 'Salvar relatório'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .fi { width: 100%; border-radius: 8px; border: 1px solid #E8E8E4; padding: 8px 12px; font-size: 14px; outline: none; background: white; }
        .fi:focus { border-color: #1a1a1a; }
      `}</style>
    </div>
  );
}

function FormSection({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-5">
      <div className="mb-4">
        <p className="text-sm font-bold text-ber-carbon">{title}</p>
        <p className="text-xs text-ber-gray mt-0.5">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ber-carbon mb-1">{label}</label>
      {hint && <p className="text-xs text-ber-gray/70 mb-1">{hint}</p>}
      {children}
    </div>
  );
}
