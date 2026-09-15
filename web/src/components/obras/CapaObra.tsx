'use client';

/**
 * Capa da Obra — one-pager executivo estilo planilha BÈR.
 *
 * Reproduz a "primeira aba da planilha" que Bruno enviava ao cliente:
 *   Header (info da obra) + Painel de Controle:
 *     [PRAZOS] · [RESULTADO + CONTRATAÇÕES (donut)] · [TEMPERATURA]
 *   + Curva S (planejado vs. realizado, do módulo de Relatórios)
 *
 * Usado em dois lugares:
 *   1. `/obras/[id]`        — aba inicial da obra (embedded)
 *   2. `/obras/[id]/capa`   — página dedicada, imprime em A4 paisagem
 *
 * A prop `embedded` remove o header de navegação/impressão e o padding de
 * página, pra Capa encaixar dentro do layout de abas da obra.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer, Plus, Trash2, X, RefreshCw } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import api from '@/lib/api';
import { confirmar } from '@/lib/confirmar';
import { useBackToObra } from '@/hooks/useBackToObra';

const TIPOS_TEMPERATURA = [
  { value: 'pos_venda',           label: 'Pós-venda' },
  { value: 'pos_kickoff',         label: 'Pós-kickoff' },
  { value: 'quinzenal',           label: 'Quinzenal (durante obra)' },
  { value: 'entrega_substancial', label: 'Entrega substancial (TAP)' },
  { value: 'entrega_final',       label: 'Entrega final' },
] as const;
type TemperaturaTipo = typeof TIPOS_TEMPERATURA[number]['value'];

const AVALIACOES = ['Muito Ruim', 'Ruim', 'Regular', 'Bom', 'Muito Bom', 'Ótimo'] as const;
type Avaliacao = typeof AVALIACOES[number];

const TEMP_COLORS: Record<Avaliacao, string> = {
  'Muito Ruim': 'bg-red-900 text-white',
  'Ruim':       'bg-red-500 text-white',
  'Regular':    'bg-yellow-400 text-yellow-900',
  'Bom':        'bg-lime-500 text-white',
  'Muito Bom':  'bg-green-600 text-white',
  'Ótimo':      'bg-sky-400 text-white',
};

interface TemperaturaRow {
  id: string;
  tipo: TemperaturaTipo;
  data: string;
  avaliacao: Avaliacao;
  observacao: string | null;
  preenchidoPor: { id: string; name: string; avatarUrl: string | null };
}

interface ObraInfo {
  id: string; name: string; client: string | null; address: string | null;
  status: string; progressPercent: number;
  startDate: string | null; expectedEndDate: string | null;
  dataInicioProjeto: string | null; dataFimProjeto: string | null;
  dataInicioObra: string | null; dataFimObra: string | null;
  valorContrato: number | null;
  arquiteturaEscritorio: string | null;
  gerenciadora: string | null;
  areaM2: number | null;
}

interface Contratacao { status: string }
interface ContratacoesResp { contratacoes: Contratacao[]; totals: { total: number; byStatus: Record<string, number> } }
/** Pacote do Cronograma de Contratações (contratacao-plano) — fonte primária do donut (10/09/26). */
interface PlanoLite { status: string; dataLimite: string | null }

/** Atividade do relatório semanal. `tipo` separa o período atual do próximo. */
interface AtividadeSemana {
  wbs: string;
  nome: string;
  inicio: string | null;
  fim: string | null;
  percentualConcluido: number;
  tipo: 'andamento' | 'proximo';
}

/** Subconjunto do RelatorioSemanal que a Capa consome. */
interface RelatorioLite {
  id: string;
  numero: number;
  periodoInicio: string;
  periodoFim: string;
  status: string;
  avancoPct: number | string;
  avancoDelta: number | string | null;
  responsavelNome: string | null;
  atividadesSemana: AtividadeSemana[] | null;
}

const RELATORIO_STATUS: Record<string, { label: string; badge: string; bar: string }> = {
  no_prazo: { label: 'NO PRAZO', badge: 'bg-emerald-100 text-emerald-800', bar: 'linear-gradient(90deg,#B5B820,#8a8c10)' },
  em_risco: { label: 'ATENÇÃO',  badge: 'bg-amber-100 text-amber-800',    bar: 'linear-gradient(90deg,#fbbf24,#d97706)' },
  atrasado: { label: 'ATRASADO', badge: 'bg-red-100 text-red-800',        bar: 'linear-gradient(90deg,#f87171,#dc2626)' },
};

const OBRA_STATUS: Record<string, { label: string; cor: string }> = {
  nao_iniciada: { label: 'Não iniciada',            cor: 'text-ber-gray/70' },
  planejamento: { label: 'Pré Obra - Planejamento', cor: 'text-ber-gray' },
  em_andamento: { label: 'Em andamento',            cor: 'text-ber-teal' },
  pos_obra:     { label: 'Pós Obra',                cor: 'text-ber-olive/80' },
  pausada:      { label: 'Pausada',                 cor: 'text-amber-600' },
  concluida:    { label: 'Concluída',               cor: 'text-ber-olive' },
  cancelada:    { label: 'Arquivada',               cor: 'text-red-500' },
};

/** Fase do Passo a Passo (obra_fvs) — só o que a Capa precisa pra dar o status. */
interface FaseLite {
  id: string;
  status: string;
  template: { code: string; name: string } | null;
  items: { checked: boolean; na: boolean }[];
}

/** Ponto da curva S mantida no módulo de relatórios (tabela relatorio_curva_s). */
interface CurvaSPonto {
  semana: string;
  planejadoPct?: number | string | null;
  realizadoPct?: number | string | null;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v);
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const daysBetween = (a: Date | null, b: Date | null): number | null => {
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
};

export default function CapaObra({ obraId, embedded = false }: { obraId: string; embedded?: boolean }) {
  const backHref = useBackToObra();
  type LiberacaoLinhaLite = { planoId: string; pacote: string; fornecedor?: string | null; status: 'liberado' | 'bloqueado' | 'aguardando_execucao' | 'liberado_excecao' | 'bloqueado_manual'; motivos: string[] };

  const [obra, setObra] = useState<ObraInfo | null>(null);
  const [contratos, setContratos] = useState<ContratacoesResp | null>(null);
  const [planos, setPlanos] = useState<PlanoLite[]>([]);
  const [curvaS, setCurvaS] = useState<CurvaSPonto[]>([]);
  const [temperaturas, setTemperaturas] = useState<TemperaturaRow[]>([]);
  const [ultimoRelatorio, setUltimoRelatorio] = useState<RelatorioLite | null>(null);
  const [fases, setFases] = useState<FaseLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [liberacao, setLiberacao] = useState<LiberacaoLinhaLite[]>([]);
  const [tempModalOpen, setTempModalOpen] = useState(false);
  const [tempEditing, setTempEditing] = useState<TemperaturaRow | null>(null);

  async function load() {
    setLoading(true);
    const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
    const [o, c, pl, curva, temps, rels, fvs, lib] = await Promise.all([
      safe(api.get<{ data: ObraInfo }>(`/obras/${obraId}`).then(r => r.data.data)),
      safe(api.get<{ data: ContratacoesResp }>(`/obras/${obraId}/contratacoes`).then(r => r.data.data)),
      safe(api.get<{ data: PlanoLite[] }>(`/obras/${obraId}/contratacao-plano`).then(r => r.data.data)),
      safe(api.get<{ data: CurvaSPonto[] }>(`/obras/${obraId}/relatorios/curva-s`).then(r => r.data.data)),
      safe(api.get<{ data: TemperaturaRow[] }>(`/obras/${obraId}/temperatura`).then(r => r.data.data)),
      safe(api.get<{ data: RelatorioLite[] }>(`/obras/${obraId}/relatorios`).then(r => r.data.data)),
      safe(api.get<{ data: FaseLite[] }>(`/obras/${obraId}/fvs`).then(r => r.data.data)),
      safe(api.get<{ data: { linhas: LiberacaoLinhaLite[] } }>(`/obras/${obraId}/liberacao-medicao`).then(r => r.data.data)),
    ]);
    setObra(o);
    setContratos(c);
    setPlanos(pl ?? []);
    setCurvaS(curva ?? []);
    setTemperaturas(temps ?? []);
    setFases(fvs ?? []);
    setLiberacao(lib?.linhas ?? []);
    // O backend já devolve ordenado por numero desc — o último emitido é o primeiro.
    // Reordena defensivamente caso a ordenação do endpoint mude.
    const ordenados = [...(rels ?? [])].sort((a, b) => b.numero - a.numero);
    setUltimoRelatorio(ordenados[0] ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, [obraId]);

  async function deleteTemperatura(id: string) {
    if (!(await confirmar('Remover esta avaliação de temperatura?', { confirmarLabel: 'Remover' }))) return;
    try { await api.delete(`/temperatura/${id}`); load(); }
    catch (err) { alert(((err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error as { message?: string } | string | undefined)?.toString() ?? 'Erro ao remover'); }
  }

  // Fase de CONSTRUÇÃO do cronograma pro fallback da curva (Bruno 10/09):
  // pré/pós-obra fora da régua. HOOKS AQUI NO TOPO — nunca depois do return
  // de loading (violação de Rules of Hooks derrubou a página em 10/09 21h).
  const [faseObra, setFaseObra] = useState<{ inicio: string; fim: string } | null>(null);
  useEffect(() => {
    let vivo = true;
    api.get(`/obras/${obraId}/cronograma`).then(r => {
      const tarefas = (r.data.data?.parsedData?.tarefas ?? []) as { nome: string; inicio?: string | null; fim?: string | null; ehResumo?: boolean }[];
      const ehConstrucao = (nome: string) => {
        const n = nome.toLowerCase();
        if (/pr[eé][\s-]*(obra|constru)|p[oó]s[\s-]*(obra|constru)|pre[\s-]*construction|post[\s-]*construction|planejament|mobiliza|close[\s-]*out|encerramento|punch/.test(n)) return false;
        return /constru|execu[cç]|\bobra(s)?\b/.test(n);
      };
      const fase = tarefas.find(t => t.ehResumo && t.inicio && t.fim && ehConstrucao(t.nome));
      if (vivo && fase) setFaseObra({ inicio: fase.inicio!.slice(0, 10), fim: fase.fim!.slice(0, 10) });
    }).catch(() => { /* sem cronograma processado: fallback usa as datas da obra */ });
    return () => { vivo = false; };
  }, [obraId]);

  if (loading || !obra) {
    return <div className={embedded ? 'py-6 text-sm text-ber-gray' : 'p-6 text-sm text-ber-gray'}>Carregando capa…</div>;
  }

  // ─── Cálculos de Prazos ────────────────────────────────────────────────
  const startD = obra.dataInicioObra ? new Date(obra.dataInicioObra) : (obra.startDate ? new Date(obra.startDate) : null);
  const entrega1D = obra.dataFimProjeto ? new Date(obra.dataFimProjeto) : (obra.expectedEndDate ? new Date(obra.expectedEndDate) : null);
  const entrega2D = obra.dataFimObra ? new Date(obra.dataFimObra) : entrega1D;
  const prazoObra = daysBetween(startD, entrega2D);
  const diasDecorridos = daysBetween(startD, today());
  const diasFalt1 = daysBetween(today(), entrega1D);
  const diasFalt2 = daysBetween(today(), entrega2D);

  // ─── Contratações (donut) ──────────────────────────────────────────────
  // Fonte primária: CRONOGRAMA DE CONTRATAÇÕES (contratacao-plano) — é onde o
  // time opera (Bruno 10/09/26). Fallback: módulo antigo de contratações.
  const { previstos, contratados, emCotacao, aContratar, emAtraso } = (() => {
    if (planos.length > 0) {
      const agora = Date.now();
      const atrasado = (pl: PlanoLite) => pl.status !== 'contratado' && !!pl.dataLimite && new Date(pl.dataLimite).getTime() < agora;
      const contratadosN = planos.filter(pl => pl.status === 'contratado').length;
      const atrasadosN = planos.filter(atrasado).length;
      const emCotacaoN = planos.filter(pl => pl.status === 'em_cotacao' && !atrasado(pl)).length;
      const aContratarN = planos.length - contratadosN - atrasadosN - emCotacaoN;
      return { previstos: planos.length, contratados: contratadosN, emCotacao: emCotacaoN, aContratar: Math.max(0, aContratarN), emAtraso: atrasadosN };
    }
    const total = contratos?.totals.total ?? 0;
    const byStatus = contratos?.totals.byStatus ?? {};
    const contratadosN = (Number(byStatus['ativo'] ?? 0) + Number(byStatus['contratado'] ?? 0));
    return { previstos: total, contratados: contratadosN, emCotacao: 0, aContratar: total - contratadosN, emAtraso: Number(byStatus['atrasado'] ?? 0) };
  })();
  const total = previstos;

  const donutData = total > 0
    ? [
        { name: 'CONTRATADO', value: contratados, color: '#3B82F6' },
        { name: 'EM CONTRATAÇÃO', value: emCotacao, color: '#F59E0B' },
        { name: 'A CONTRATAR', value: aContratar, color: '#9CA3AF' },
        { name: 'EM ATRASO', value: emAtraso, color: '#DC2626' },
      ].filter(d => d.value > 0)
    : [{ name: 'sem dados', value: 1, color: '#E5E5E5' }];

  // ─── Curva S ───────────────────────────────────────────────────────────
  // Fonte: a curva mantida no módulo de Relatórios (tabela relatorio_curva_s),
  // a mesma que sai no PDF enviado ao cliente. Não é derivada do cronograma.
  type CurvaPt = { label: string; semana: string; planejado?: number; realizado?: number };

  // Obra em PLANEJAMENTO: início ainda não firmado (Bruno 10/09/26) — curva em
  // semanas relativas (Sem. 1..N, sem datas) e sem "planejado para hoje".
  const emPlanejamento = (obra.status ?? '').toLowerCase().includes('planejamento');
  const startIso = (obra.dataInicioObra ?? obra.startDate ?? '').slice(0, 10) || null;
  const endIso = (obra.dataFimObra ?? obra.expectedEndDate ?? '').slice(0, 10) || null;
  const startMs = startIso ? new Date(startIso + 'T12:00:00').getTime() : null;
  const fbStartIso = faseObra?.inicio ?? startIso;
  const fbEndIso = faseObra?.fim ?? endIso;

  // Sem curva cadastrada mas com datas da obra → curva PLANEJADA linear gerada
  // na hora (Bruno 10/09/26: cockpit nunca fica sem a curva do planejado).
  const curvaEhFallback = curvaS.length === 0 && !!fbStartIso && !!fbEndIso;
  const curva: CurvaPt[] = (() => {
    const map = new Map<string, { semana: string; planejado?: number; realizado?: number }>();
    curvaS.forEach(p => {
      const k = String(p.semana).slice(0, 10);
      const entry = map.get(k) ?? { semana: k };
      if (p.planejadoPct != null) entry.planejado = Number(p.planejadoPct);
      if (p.realizadoPct != null) entry.realizado = Number(p.realizadoPct);
      map.set(k, entry);
    });
    if (map.size === 0 && curvaEhFallback) {
      const ini = new Date(fbStartIso + 'T00:00:00');
      const fim = new Date(fbEndIso + 'T00:00:00');
      const span = fim.getTime() - ini.getTime();
      if (span > 0) {
        // começa na segunda-feira anterior ao início
        const w = new Date(ini);
        const dow = w.getDay();
        w.setDate(w.getDate() - (dow === 0 ? 6 : dow - 1));
        while (w <= fim) {
          const fimSemana = new Date(w); fimSemana.setDate(fimSemana.getDate() + 6);
          const pct = Math.min(100, Math.max(0, Math.round((fimSemana.getTime() - ini.getTime()) / span * 1000) / 10));
          map.set(w.toISOString().slice(0, 10), { semana: w.toISOString().slice(0, 10), planejado: pct });
          w.setDate(w.getDate() + 7);
        }
      }
    }
    if (map.size === 0) return [];
    // Âncora: curva oficial cobre o projeto inteiro; fallback ancora na fase de obra
    const ancIni = curvaEhFallback ? fbStartIso : startIso;
    const ancFim = curvaEhFallback ? fbEndIso : endIso;
    if (ancIni && !map.has(ancIni)) map.set(ancIni, { semana: ancIni });
    if (ancFim && !map.has(ancFim)) map.set(ancFim, { semana: ancFim });
    return Array.from(map.values())
      .sort((a, b) => a.semana.localeCompare(b.semana))
      .map((pt, i) => {
        if (emPlanejamento) return { ...pt, label: `Sem. ${i + 1}` };
        const pointMs = new Date(pt.semana + 'T12:00:00').getTime();
        const label = startMs != null && pointMs >= startMs
          ? `Sem. ${Math.round((pointMs - startMs) / (7 * 86_400_000)) + 1}`
          : new Date(pt.semana + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        return { ...pt, label };
      });
  })();

  // % planejado para hoje — interpolação linear entre os pontos cadastrados.
  // Vira a referência do "adiantado/atrasado" na faixa de progresso.
  const planejadoHoje: number | null = (() => {
    if (emPlanejamento) return null; // obra não iniciou — não existe "planejado para hoje"
    const pts = curva
      .filter(p => p.planejado != null)
      .map(p => ({ ms: new Date(p.semana + 'T12:00:00').getTime(), v: p.planejado! }))
      .sort((a, b) => a.ms - b.ms);
    if (pts.length === 0) return null;
    const hoje = today().getTime();
    if (hoje <= pts[0].ms) return Math.round(pts[0].v);
    if (hoje >= pts[pts.length - 1].ms) return Math.round(pts[pts.length - 1].v);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (hoje >= a.ms && hoje <= b.ms) {
        const span = b.ms - a.ms;
        if (span <= 0) return Math.round(a.v);
        return Math.round(a.v + (b.v - a.v) * ((hoje - a.ms) / span));
      }
    }
    return null;
  })();

  // ─── Temperatura (ordenada por data crescente) ─────────────────────────
  const tempOrdenadas = [...temperaturas].sort((a, b) => a.data.localeCompare(b.data));
  const tipoLabel = (t: TemperaturaTipo): string => TIPOS_TEMPERATURA.find(x => x.value === t)?.label ?? t;

  // Mapeamento qualitativo → numérico pra plotagem (1 = Muito Ruim ... 6 = Ótimo)
  const avalScale: Record<Avaliacao, number> = {
    'Muito Ruim': 1, 'Ruim': 2, 'Regular': 3, 'Bom': 4, 'Muito Bom': 5, 'Ótimo': 6,
  };
  const tempPoints = tempOrdenadas.map(t => ({
    label: new Date(t.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    valor: avalScale[t.avaliacao],
    avaliacao: t.avaliacao,
    tipo: tipoLabel(t.tipo),
    observacao: t.observacao,
  }));
  const ultimaAval = tempOrdenadas[tempOrdenadas.length - 1]?.avaliacao;
  const mediaAval = tempOrdenadas.length > 0
    ? tempOrdenadas.reduce((s, t) => s + avalScale[t.avaliacao], 0) / tempOrdenadas.length
    : 0;
  const mediaLabel = mediaAval >= 5.5 ? 'Ótimo'
    : mediaAval >= 4.5 ? 'Muito Bom'
    : mediaAval >= 3.5 ? 'Bom'
    : mediaAval >= 2.5 ? 'Regular'
    : mediaAval >= 1.5 ? 'Ruim'
    : mediaAval > 0 ? 'Muito Ruim' : '—';
  const AVAL_HEX: Record<Avaliacao, string> = {
    'Muito Ruim': '#7f1d1d', 'Ruim': '#ef4444', 'Regular': '#facc15',
    'Bom': '#84cc16', 'Muito Bom': '#16a34a', 'Ótimo': '#38bdf8',
  };

  // ─── Progresso da obra ─────────────────────────────────────────────────
  // Fonte única da verdade: o avanço informado no último relatório semanal
  // emitido. Não há mais sincronismo automático sobrescrevendo esse número.
  const avancoPct = ultimoRelatorio ? Number(ultimoRelatorio.avancoPct) : null;
  const avancoDelta = ultimoRelatorio?.avancoDelta != null ? Number(ultimoRelatorio.avancoDelta) : null;
  const relStatus = ultimoRelatorio ? (RELATORIO_STATUS[ultimoRelatorio.status] ?? null) : null;

  // ─── Atividades do período (do último relatório) ────────────────────────
  const atividades = ultimoRelatorio?.atividadesSemana ?? [];
  const atvAndamento = atividades.filter(a => a.tipo === 'andamento');
  const atvProximo = atividades.filter(a => a.tipo === 'proximo');

  // ─── Controle de coordenação (Passo a Passo) ───────────────────────────
  // Atraso = item aberto em fase que a obra JÁ passou. É o que não se recupera
  // sozinho. Item aberto na fase corrente é trabalho normal, não alarme.
  const ordemFase = (code?: string | null) => Number(String(code ?? '').replace(/\D/g, '')) || 0;
  const faseAtualCode: string | null = (() => {
    if (obra.status === 'nao_iniciada' || obra.status === 'planejamento') return 'PP1';
    if (obra.status === 'pos_obra' || obra.status === 'concluida') return 'PP6';
    if (avancoPct == null) return null;
    if (avancoPct >= 100) return 'PP6';
    if (avancoPct >= 75) return 'PP5';
    if (avancoPct >= 50) return 'PP4';
    if (avancoPct >= 25) return 'PP3';
    return 'PP2';
  })();
  const ordemAtual = ordemFase(faseAtualCode);
  const abertosDe = (f: FaseLite) => f.items.filter(i => !i.checked && !i.na).length;
  const fasesAtrasadas = ordemAtual > 0
    ? fases.filter(f => {
        const o = ordemFase(f.template?.code);
        return o > 0 && o < ordemAtual && abertosDe(f) > 0;
      })
    : [];
  const itensAtrasados = fasesAtrasadas.reduce((acc, f) => acc + abertosDe(f), 0);
  const faseCorrente = fases.find(f => f.template?.code === faseAtualCode) ?? null;
  const itensFaseAtual = faseCorrente ? abertosDe(faseCorrente) : 0;
  const semDados = fases.length === 0 || faseAtualCode == null;

  const coordStatus = semDados
    ? { tom: 'neutro' as const, titulo: 'SEM LEITURA', frase: 'Depende do primeiro relatório emitido' }
    : itensAtrasados > 0
      ? { tom: 'ruim' as const, titulo: 'ATRASADO', frase: `${itensAtrasados} ${itensAtrasados === 1 ? 'item ficou' : 'itens ficaram'} para trás` }
      : itensFaseAtual > 0
        ? { tom: 'atencao' as const, titulo: 'EM ANDAMENTO', frase: `${itensFaseAtual} ${itensFaseAtual === 1 ? 'item a preencher' : 'itens a preencher'} na fase atual` }
        : { tom: 'bom' as const, titulo: 'EM DIA', frase: 'Nada pendente até aqui' };

  const COORD_TOM = {
    ruim:    { bg: 'bg-red-600',     texto: 'text-white', sub: 'text-red-50' },
    atencao: { bg: 'bg-amber-500',   texto: 'text-white', sub: 'text-amber-50' },
    bom:     { bg: 'bg-emerald-600', texto: 'text-white', sub: 'text-emerald-50' },
    neutro:  { bg: 'bg-ber-gray/25', texto: 'text-ber-carbon', sub: 'text-ber-gray' },
  }[coordStatus.tom];

  // ─── Linha do tempo (régua Início → Hoje → Prazo) ──────────────────────
  // % do prazo já consumido. Serve de referência visual contra o avanço real.
  // Obra em PLANEJAMENTO ainda não consome prazo — régua zerada (Bruno 10/09/26)
  const tempoPct = emPlanejamento
    ? 0
    : prazoObra != null && prazoObra > 0 && diasDecorridos != null
      ? Math.min(100, Math.max(0, Math.round(diasDecorridos / prazoObra * 100)))
      : null;

  return (
    <div className={embedded ? 'bg-white' : 'p-3 md:p-6 print:p-0 bg-white min-h-screen'}>
      {/* Header navegação (só na página dedicada; esconde na impressão) */}
      {!embedded && (
        <div className="mb-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-sm text-ber-gray">
            <Link href={backHref} className="inline-flex items-center gap-1 hover:text-ber-carbon">
              <ArrowLeft size={14} /> {obra.name}
            </Link>
            <span>/</span><span className="text-ber-carbon font-medium">Capa</span>
          </div>
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md border border-ber-gray/30 px-3 py-1.5 text-xs font-medium text-ber-gray hover:bg-ber-bg/40 hover:text-ber-carbon">
            <Printer size={13} /> Imprimir
          </button>
        </div>
      )}

      {/* Atalho pra versão imprimível quando embutida na aba da obra */}
      {embedded && (
        <div className="mb-3 flex justify-end print:hidden">
          <Link
            href={`/obras/${obraId}/capa`}
            className="inline-flex items-center gap-1.5 rounded-md border border-ber-gray/30 px-3 py-1.5 text-xs font-medium text-ber-gray hover:bg-ber-bg/40 hover:text-ber-carbon"
          >
            <Printer size={13} /> Versão para impressão
          </Link>
        </div>
      )}

      {/* ─── HEADER OBRA ────────────────────────────────────────────────── */}
      <div className="border border-ber-gray/30 mb-4">
        <div className="bg-[#1F4E78] text-white px-4 py-1.5 text-xs font-bold tracking-wider">OBRA</div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 p-4">
          <table className="text-[12px] w-full">
            <tbody className="[&_td]:py-0.5">
              <tr><td className="text-ber-gray font-medium w-[120px]">Obra</td><td className="font-bold text-ber-carbon">{obra.name}</td></tr>
              <tr><td className="text-ber-gray font-medium">Endereço</td><td>{obra.address || '—'}</td></tr>
              <tr><td className="text-ber-gray font-medium">Arquitetura</td><td>{obra.arquiteturaEscritorio || '—'}</td></tr>
              <tr><td className="text-ber-gray font-medium">Gerenciadora</td><td>{obra.gerenciadora || '—'}</td></tr>
              <tr><td className="text-ber-gray font-medium">Área Projeto</td><td>{obra.areaM2 ? `${obra.areaM2} m²` : '—'}</td></tr>
              <tr>
                <td className="text-ber-gray font-medium">Data Início</td>
                <td className="flex flex-wrap gap-x-6 gap-y-0.5">
                  <span>{fmtDate(obra.startDate)}</span>
                  <span className="text-ber-gray">PRAZO <span className="font-bold text-ber-carbon">{prazoObra ?? '—'}</span></span>
                  <span>Data Fim <span className="font-bold">{fmtDate(obra.dataFimObra ?? obra.expectedEndDate)}</span></span>
                  <span>Percentual de Obra <span className="font-bold text-ber-carbon">{avancoPct != null ? `${avancoPct}%` : '—'}</span></span>
                </td>
              </tr>
              <tr><td className="text-ber-gray font-medium">Status</td><td className="uppercase font-medium">{obra.status.replace(/_/g, ' ')}</td></tr>
            </tbody>
          </table>
          <div className="flex items-center justify-center min-w-[120px]">
            <div className="text-right">
              <div className="text-[10px] tracking-widest text-ber-gray font-bold">STATUS</div>
              <div className={`text-2xl font-black uppercase leading-tight ${OBRA_STATUS[obra.status]?.cor ?? 'text-ber-carbon'}`}>
                {OBRA_STATUS[obra.status]?.label ?? obra.status.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── PROGRESSO DA OBRA ──────────────────────────────────────────── */}
      {/* Vem do avanço informado no último relatório semanal emitido. */}
      <div className="border border-ber-gray/30 mb-4">
        <div className="bg-[#1F4E78] text-white px-4 py-1.5 text-xs font-bold tracking-wider">PROGRESSO DA OBRA</div>
        <div className="p-4">
          {avancoPct == null ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="h-3 w-full max-w-lg overflow-hidden rounded-full bg-ber-gray/10">
                <div className="h-full w-0 rounded-full" />
              </div>
              <p className="text-[12px] text-ber-gray italic">
                Aguardando primeiro relatório semanal — o avanço aparece aqui assim que o relatório nº 1 for emitido.
              </p>
              <Link href={`/obras/${obraId}?tab=relatorios`} className="print:hidden text-[11px] font-medium text-ber-teal hover:underline">
                Ir para Relatórios
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 md:gap-6 items-center">
              {/* Número grande */}
              <div className="flex items-end gap-1.5">
                <span className="text-5xl font-black leading-none text-ber-carbon">{avancoPct}</span>
                <span className="mb-1 text-2xl font-bold text-ber-gray">%</span>
                {avancoDelta != null && avancoDelta !== 0 && (
                  <span className={`mb-1.5 ml-2 text-[12px] font-bold ${avancoDelta > 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {avancoDelta > 0 ? '+' : ''}{avancoDelta}% na semana
                  </span>
                )}
              </div>

              <div className="min-w-0">
                {/* Barra de avanço (do relatório semanal) */}
                <div className="relative h-3 w-full overflow-hidden rounded-full bg-ber-offwhite">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, avancoPct))}%`,
                      background: relStatus?.bar ?? 'linear-gradient(90deg,#B5B820,#8a8c10)',
                    }}
                  />
                </div>

                {/* Legenda */}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ber-gray">
                  <span>
                    Relatório <span className="font-bold text-ber-carbon">#{ultimoRelatorio!.numero}</span>
                    {' · '}semana de {fmtDate(ultimoRelatorio!.periodoInicio)} a {fmtDate(ultimoRelatorio!.periodoFim)}
                  </span>
                  {relStatus && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${relStatus.badge}`}>
                      {relStatus.label}
                    </span>
                  )}
                  {ultimoRelatorio!.responsavelNome && (
                    <span>por {ultimoRelatorio!.responsavelNome}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── PAINEL DE CONTROLE ─────────────────────────────────────────── */}
      <div className="bg-[#1F4E78] text-white px-4 py-1.5 text-xs font-bold tracking-wider mb-3">PAINEL DE CONTROLE</div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">

        {/* PRAZOS */}
        <div className="border border-ber-gray/20 p-4 bg-white">
          <h3 className="text-lg font-black text-ber-carbon mb-3">PRAZOS</h3>
          <PrazoRow label="PRAZO DE OBRA" value={prazoObra != null ? String(prazoObra) : '—'} />
          <PrazoRow label="INÍCIO DE OBRA" value={fmtDate(obra.dataInicioObra ?? obra.startDate)} color="green" />
          <PrazoRow label="DATA DE ENTREGA #1" value={fmtDate(obra.dataFimProjeto ?? obra.expectedEndDate)} color="red" />
          <PrazoRow label="DATA DA ENTREGA #2" value={fmtDate(obra.dataFimObra ?? obra.expectedEndDate)} color="red" />
          <div className="my-2 border-t border-ber-gray/10" />
          <PrazoRow label="DIAS DECORRIDOS" value={diasDecorridos != null ? String(diasDecorridos) : '—'} />
          <PrazoRow label="DIAS FALTANTES FASE 1" value={diasFalt1 != null ? String(diasFalt1) : '—'} color={diasFalt1 != null && diasFalt1 < 0 ? 'red' : 'normal'} />
          <PrazoRow label="DIAS FALTANTES FASE 2" value={diasFalt2 != null ? String(diasFalt2) : '—'} color={diasFalt2 != null && diasFalt2 < 0 ? 'red' : 'normal'} />

          {/* Destaque: quanto falta pra entrega final */}
          <div className="mt-3 border-t border-ber-gray/10 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ber-gray">Dias restantes</p>
            <p className={`text-3xl font-black leading-none ${
              diasFalt2 == null ? 'text-ber-gray'
                : diasFalt2 < 0 ? 'text-red-600'
                : diasFalt2 < 14 ? 'text-amber-600'
                : 'text-ber-carbon'
            }`}>
              {diasFalt2 == null ? '—' : diasFalt2 < 0 ? `${Math.abs(diasFalt2)}d` : diasFalt2}
              {diasFalt2 != null && diasFalt2 < 0 && (
                <span className="ml-1.5 text-sm font-bold">em atraso</span>
              )}
            </p>

            {/* Régua Início → Hoje → Prazo — só tempo consumido (sem comparar com
                execução, que era um comparativo linear enganoso). */}
            {tempoPct != null && (
              <div className="mt-3">
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-ber-offwhite">
                  <div className="h-full rounded-full bg-ber-carbon/25" style={{ width: `${tempoPct}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[9px] text-ber-gray">
                  <span>Início</span>
                  <span className="font-semibold text-ber-carbon">{emPlanejamento ? 'Pré-obra · prazo não iniciado' : `Hoje · ${tempoPct}% do prazo`}</span>
                  <span>Prazo</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RESULTADO + CONTRATAÇÕES */}
        <div className="border border-ber-gray/20 p-4 bg-white">
          <h3 className="text-lg font-black text-ber-carbon mb-3">RESULTADO</h3>
          <div className="text-3xl font-black text-ber-carbon mb-3">
            {obra.valorContrato ? fmtBRL(Number(obra.valorContrato)) : '—'}
            <div className="text-[10px] font-medium text-ber-gray tracking-wide uppercase">Valor do contrato</div>
          </div>
          <div className="border-t border-ber-gray/15 pt-3">
            <h4 className="text-sm font-bold tracking-wide bg-blue-100 px-2 py-1 inline-block text-blue-900 mb-2">CONTRATAÇÕES</h4>
            <div className="grid grid-cols-[1fr_auto] gap-1 text-[12px]">
              <div className="text-ber-carbon">FORNECEDORES PREVISTOS</div><div className="text-right font-bold text-blue-500">{previstos}</div>
              <div className="text-ber-carbon">CONTRATADO</div><div className="text-right font-bold text-blue-700">{contratados}</div>
              <div className="text-ber-carbon">EM CONTRATAÇÃO</div><div className="text-right font-bold text-amber-600">{emCotacao}</div>
              <div className="text-ber-carbon">A CONTRATAR</div><div className="text-right font-bold text-ber-gray">{aContratar}</div>
              <div className="text-ber-carbon">EM ATRASO</div><div className="text-right font-bold text-red-600">{emAtraso}</div>
            </div>
            {/* gráfico maior + % comprado grande ao lado (Bruno 10/09/26) */}
            <div className="mt-2 flex items-center gap-2">
              <div className="h-[190px] flex-1 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" innerRadius={48} outerRadius={85} paddingAngle={2}>
                      {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {total > 0 && (
                <div className="shrink-0 text-center pr-1">
                  <div className="text-4xl font-black leading-none text-ber-carbon">{Math.round(contratados / total * 100)}%</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-ber-gray">comprado<br/>da obra</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TEMPERATURA */}
        <div className="border border-ber-gray/20 p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-black text-ber-carbon">TEMPERATURA</h3>
            <button
              onClick={() => { setTempEditing(null); setTempModalOpen(true); }}
              className="print:hidden inline-flex items-center gap-1 rounded-md bg-ber-carbon px-2 py-1 text-[11px] font-semibold text-white hover:bg-ber-black"
            >
              <Plus size={11} /> Adicionar
            </button>
          </div>

          {/* Headline: média + última */}
          {tempOrdenadas.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-ber-gray/10">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-ber-gray">Média</p>
                <p className={`text-sm font-semibold inline-block rounded px-2 py-0.5 mt-0.5 ${mediaLabel !== '—' ? TEMP_COLORS[mediaLabel as Avaliacao] : 'text-ber-gray'}`}>{mediaLabel}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-ber-gray">Última</p>
                <p className={`text-sm font-semibold inline-block rounded px-2 py-0.5 mt-0.5 ${ultimaAval ? TEMP_COLORS[ultimaAval] : 'text-ber-gray'}`}>{ultimaAval ?? '—'}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-[10px] font-bold uppercase tracking-wide text-ber-gray pb-1 border-b border-ber-gray/20">
            <span>Momento</span>
            <span className="text-center">Data</span>
            <span className="text-center">Avaliação</span>
          </div>
          {tempOrdenadas.length === 0 ? (
            <p className="text-[11px] text-ber-gray italic py-3 text-center">
              Nenhuma avaliação registrada ainda. Clique em + Adicionar.
            </p>
          ) : (
            tempOrdenadas.map(t => (
              <div key={t.id} className="grid grid-cols-[1fr_auto_auto] gap-2 text-[12px] py-1 border-b border-ber-gray/10 items-center group/temp">
                <button
                  onClick={() => { setTempEditing(t); setTempModalOpen(true); }}
                  className="text-left text-ber-carbon hover:text-ber-teal truncate"
                  title={t.observacao ?? undefined}
                >
                  {tipoLabel(t.tipo)}
                </button>
                <span className="text-center text-ber-gray tabular-nums whitespace-nowrap">
                  {new Date(t.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </span>
                <span className="flex items-center gap-1">
                  <span className={`inline-block text-center text-[11px] font-medium rounded px-2 py-0.5 ${TEMP_COLORS[t.avaliacao]}`}>
                    {t.avaliacao}
                  </span>
                  <button
                    onClick={() => deleteTemperatura(t.id)}
                    className="print:hidden opacity-100 md:opacity-0 md:group-hover/temp:opacity-100 text-ber-gray hover:text-red-600 transition-opacity"
                    title="Remover"
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              </div>
            ))
          )}

          {/* Gráfico de evolução */}
          {tempOrdenadas.length >= 2 && (
            <div className="mt-3 pt-3 border-t border-ber-gray/10">
              <p className="text-[9px] font-bold uppercase tracking-wide text-ber-gray mb-1">Evolução</p>
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={tempPoints} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="#EEE" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                    <YAxis domain={[0.5, 6.5]} ticks={[1, 2, 3, 4, 5, 6]} tick={{ fontSize: 9 }} tickFormatter={v => ['', 'MR', 'R', 'Reg', 'B', 'MB', 'Ot'][v as number] ?? ''} width={30} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const p = payload[0].payload as typeof tempPoints[0];
                        return (
                          <div className="bg-white border border-ber-gray/20 rounded shadow-md p-2 text-[11px]">
                            <p className="font-bold text-ber-carbon">{p.tipo}</p>
                            <p className="text-ber-gray">{p.label}</p>
                            <p className="font-medium mt-0.5">{p.avaliacao}</p>
                            {p.observacao && <p className="text-[10px] text-ber-gray italic mt-1 max-w-[200px]">{p.observacao}</p>}
                          </div>
                        );
                      }}
                    />
                    <Line type="monotone" dataKey="valor" stroke="#3B82F6" strokeWidth={2}
                      dot={(props: { cx?: number; cy?: number; payload?: typeof tempPoints[0]; index?: number }) => {
                        const cx = props.cx, cy = props.cy, p = props.payload;
                        if (cx == null || cy == null || !p) return <g />;
                        return <circle key={props.index} cx={cx} cy={cy} r={5} fill={AVAL_HEX[p.avaliacao]} stroke="white" strokeWidth={2} />;
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── ATIVIDADES DO PERÍODO ──────────────────────────────────────── */}
      {/* Vêm do campo atividadesSemana do último relatório emitido. */}
      <div className="border border-ber-gray/30 mb-4">
        <div className="bg-[#1F4E78] text-white px-4 py-1.5 text-xs font-bold tracking-wider flex items-center justify-between">
          <span>ATIVIDADES DO PERÍODO</span>
          {ultimoRelatorio && (
            <span className="font-medium tracking-normal text-white/70 normal-case">
              Relatório #{ultimoRelatorio.numero} · {fmtDate(ultimoRelatorio.periodoInicio)} a {fmtDate(ultimoRelatorio.periodoFim)}
            </span>
          )}
        </div>
        <div className="p-4">
          {atividades.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-ber-gray italic">
              {ultimoRelatorio
                ? 'O último relatório não trouxe atividades cadastradas.'
                : 'Aguardando primeiro relatório semanal — as atividades do período aparecem aqui.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AtividadesColuna
                titulo="PERÍODO ATUAL"
                subtitulo="em andamento"
                items={atvAndamento}
                dotClass="bg-blue-500"
                vazio="Nenhuma atividade em andamento no período."
              />
              <AtividadesColuna
                titulo="PRÓXIMO PERÍODO"
                subtitulo="previstas"
                items={atvProximo}
                dotClass="bg-amber-400"
                vazio="Nenhuma atividade prevista para o próximo período."
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── CURVA S + CONTROLE DE COORDENAÇÃO ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-3">

      {/* Mesma curva do PDF do relatório (módulo Relatórios → aba Curva S). */}
      <div className="border border-ber-gray/30">
        <div className="bg-[#1F4E78] text-white px-4 py-1.5 text-xs font-bold tracking-wider flex items-center justify-between">
          <span>{curva.some(p => p.realizado != null) ? 'CURVA S — PLANEJADO VS. REALIZADO' : 'CURVA S — PLANEJADO'}</span>
          <button onClick={load}
            className="print:hidden inline-flex items-center gap-1 rounded border border-white/30 px-2 py-0.5 text-[10px] font-medium text-white/90 hover:bg-white/10">
            <RefreshCw size={10} /> Atualizar
          </button>
        </div>
        <div className="p-4 bg-white">
          {curva.length === 0 ? (
            <div className="py-12 text-center text-sm text-ber-gray italic">
              Curva S ainda não cadastrada para esta obra — ela é preenchida na aba Relatórios, em Curva S.
              <div className="mt-2 print:hidden">
                <Link href={`/obras/${obraId}?tab=relatorios`} className="text-[12px] font-medium text-ber-teal hover:underline not-italic">
                  Ir para Relatórios
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="h-[300px]" style={{ width: Math.max(600, curva.length * 55) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={curva} margin={{ top: 16, right: 12, bottom: 4, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={52} />
                    <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip
                      formatter={((v: unknown, name: unknown) => [
                        `${typeof v === 'number' ? v.toFixed(1) : String(v)}%`,
                        String(name),
                      ]) as never}
                      labelFormatter={(l, payload) => {
                        const first = (payload as unknown as { payload?: CurvaPt }[] | undefined)?.[0];
                        const semana = first?.payload?.semana;
                        return semana ? `${l} · ${fmtDate(semana + 'T12:00:00')}` : String(l);
                      }}
                      contentStyle={{ fontSize: 11, padding: '6px 10px' }} />
                    <Line type="monotone" dataKey="planejado" stroke="#3B82F6" strokeDasharray="4 2" strokeWidth={2}
                      dot={{ r: 2.5, fill: '#3B82F6' }} name="Planejado acumulado" connectNulls />
                    <Line type="monotone" dataKey="realizado" stroke="#22C55E" strokeWidth={3}
                      dot={{ r: 3.5, fill: '#22C55E' }} activeDot={{ r: 5 }} name="Realizado acumulado" connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Legenda */}
          {curva.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-ber-gray">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-[#3B82F6]" /> Planejado acumulado
              </span>
              {curvaEhFallback && (
                <span className="italic">curva linear {faseObra ? 'da fase de construção do cronograma' : 'das datas da obra'} — gere a oficial no Cronograma (botão Gerar Curva S)</span>
              )}
              {curva.some(p => p.realizado != null) ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-0.5 w-5 bg-[#22C55E]" /> Realizado acumulado
                </span>
              ) : (
                <span className="italic">Realizado entra quando o 1º relatório semanal for emitido</span>
              )}
              {planejadoHoje != null && (
                <span className="ml-auto">Planejado para hoje: <span className="font-bold text-ber-carbon">{planejadoHoje}%</span></span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Controle de coordenação — o processo acompanhou o avanço? */}
      <div className="border border-ber-gray/30 flex flex-col">
        <div className="bg-[#1F4E78] text-white px-4 py-1.5 text-xs font-bold tracking-wider">
          CONTROLE DE COORDENAÇÃO
        </div>
        <div className="flex flex-1 flex-col bg-white p-4">
          {/* Semáforo: cor forte e palavra pronta, sem legenda pra decorar */}
          <div className={`rounded-lg ${COORD_TOM.bg} px-4 py-3`}>
            <p className={`text-2xl font-black leading-none ${COORD_TOM.texto}`}>{coordStatus.titulo}</p>
            <p className={`mt-1 text-[12px] font-medium ${COORD_TOM.sub}`}>{coordStatus.frase}</p>
          </div>

          {/* Detalhe por fase — só o que merece atenção */}
          <div className="mt-3 flex-1 space-y-1.5">
            {fasesAtrasadas.length > 0 && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ber-gray">Ficaram para trás</p>
                {fasesAtrasadas.map(f => (
                  <div key={f.id} className="flex items-start justify-between gap-2 text-[12px]">
                    <span className="min-w-0 truncate text-ber-carbon">{f.template?.name}</span>
                    <span className="shrink-0 font-bold tabular-nums text-red-600">{abertosDe(f)}</span>
                  </div>
                ))}
              </>
            )}
            {faseCorrente && (
              <div className={fasesAtrasadas.length > 0 ? 'border-t border-ber-gray/10 pt-2 mt-2' : ''}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ber-gray">Fase atual</p>
                <div className="flex items-start justify-between gap-2 text-[12px]">
                  <span className="min-w-0 truncate text-ber-carbon">{faseCorrente.template?.name}</span>
                  <span className={`shrink-0 font-bold tabular-nums ${itensFaseAtual > 0 ? 'text-amber-600' : 'text-green-700'}`}>
                    {itensFaseAtual > 0 ? itensFaseAtual : '✓'}
                  </span>
                </div>
              </div>
            )}
            {semDados && (
              <p className="text-[11px] italic text-ber-gray">
                A fase vigente sai do avanço do relatório semanal. Sem relatório emitido, não dá pra dizer o que está atrasado.
              </p>
            )}
          </div>

          <Link
            href={`/obras/${obraId}?tab=fvs`}
            className="print:hidden mt-3 block rounded-md border border-ber-gray/25 px-3 py-2 text-center text-[12px] font-semibold text-ber-carbon hover:bg-ber-bg/40"
          >
            Abrir Passo a Passo
          </Link>
        </div>
      </div>

      </div>

      {/* ─── LIBERAÇÃO DE MEDIÇÃO — semáforo por fornecedor (Bruno 15/09: seção no cockpit) ── */}
      {(() => {
        const bloqueados = liberacao.filter(l => l.status === 'bloqueado' || l.status === 'bloqueado_manual');
        const liberados = liberacao.filter(l => l.status === 'liberado' || l.status === 'liberado_excecao');
        const aguardando = liberacao.filter(l => l.status === 'aguardando_execucao');
        return (
          <div className="border border-ber-gray/30 mt-3">
            <div className="bg-[#1F4E78] text-white px-4 py-1.5 text-xs font-bold tracking-wider flex items-center justify-between">
              <span>LIBERAÇÃO DE MEDIÇÃO</span>
              <span className="text-[10px] font-medium text-white/80">{liberados.length} liberado(s) · {aguardando.length} aguardando execução · {bloqueados.length} bloqueado(s)</span>
            </div>
            <div className="bg-white p-4">
              {liberacao.length === 0 ? (
                <p className="text-[12px] text-ber-gray">
                  Nenhum pacote contratado ainda nesta obra — o semáforo acende quando o Cronograma de
                  Contratações tiver fornecedor com status <span className="font-semibold">contratado</span>.
                </p>
              ) : bloqueados.length === 0 ? (
                liberados.length > 0 ? (
                  <div className="rounded-lg bg-emerald-600 px-4 py-3">
                    <p className="text-2xl font-black leading-none text-white">SEM BLOQUEIOS</p>
                    <p className="mt-1 text-[12px] font-medium text-emerald-50">{liberados.length} liberado(s) pra medir{aguardando.length > 0 ? ` · ${aguardando.length} aguardando execução` : ''}</p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-amber-500 px-4 py-3">
                    <p className="text-2xl font-black leading-none text-white">AGUARDANDO EXECUÇÃO</p>
                    <p className="mt-1 text-[12px] font-medium text-amber-50">Nenhum pacote com execução verificada (FVS preenchida) — nada a medir ainda</p>
                  </div>
                )
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-red-600">🔴 Bloqueados pra medir</p>
                  {bloqueados.map(l => (
                    <div key={l.planoId} className="flex items-start justify-between gap-3 border-b border-ber-gray/10 pb-1.5 text-[12px]">
                      <div className="min-w-0">
                        <p className="font-semibold text-ber-carbon truncate">{l.pacote}{l.fornecedor ? ` — ${l.fornecedor}` : ''}</p>
                        {l.motivos.slice(0, 2).map((m, i) => <p key={i} className="text-[11px] text-ber-gray truncate">{m}</p>)}
                        {l.status === 'bloqueado_manual' && <p className="text-[11px] text-ber-gray">Bloqueio manual (PMO)</p>}
                      </div>
                      <span className="shrink-0 rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">BLOQUEADO</span>
                    </div>
                  ))}
                  {liberados.length > 0 && (
                    <p className="pt-1 text-[11px] text-ber-gray">🟢 Liberados: {liberados.map(l => l.pacote).join(' · ')}</p>
                  )}
                  {aguardando.length > 0 && (
                    <p className="pt-1 text-[11px] text-ber-gray">⏳ Aguardando execução: {aguardando.map(l => l.pacote).join(' · ')}</p>
                  )}
                </div>
              )}
              <Link
                href={`/obras/${obraId}/liberacao-medicao`}
                className="print:hidden mt-3 block rounded-md border border-ber-gray/25 px-3 py-2 text-center text-[12px] font-semibold text-ber-carbon hover:bg-ber-bg/40"
              >
                Abrir Liberação de Medição
              </Link>
            </div>
          </div>
        );
      })()}

      {tempModalOpen && (
        <TemperaturaModal
          obraId={obraId}
          editing={tempEditing}
          onClose={() => setTempModalOpen(false)}
          onSaved={() => { setTempModalOpen(false); load(); }}
        />
      )}

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}

function TemperaturaModal({
  obraId, editing, onClose, onSaved,
}: {
  obraId: string;
  editing: TemperaturaRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tipo,       setTipo]       = useState<TemperaturaTipo>(editing?.tipo ?? 'pos_venda');
  const [data,       setData]       = useState(editing?.data?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [avaliacao,  setAvaliacao]  = useState<Avaliacao>(editing?.avaliacao ?? 'Bom');
  const [observacao, setObservacao] = useState(editing?.observacao ?? '');
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState<string | null>(null);

  async function save() {
    setSaving(true); setErr(null);
    try {
      const body = { tipo, data, avaliacao, observacao: observacao.trim() || null };
      if (editing) await api.patch(`/temperatura/${editing.id}`, body);
      else await api.post(`/obras/${obraId}/temperatura`, body);
      onSaved();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
      setErr(typeof msg === 'string' ? msg : msg?.message || 'Erro ao salvar');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-t-2xl md:rounded-lg bg-white max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-ber-gray/15 px-5 py-3">
          <h2 className="text-base font-black text-ber-carbon">
            {editing ? 'Editar avaliação' : 'Nova avaliação'}
          </h2>
          <button onClick={onClose} className="text-ber-gray hover:text-ber-carbon"><X size={16} /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {err && <div className="rounded-md bg-red-50 p-2 text-xs text-red-700">{err}</div>}
          <div>
            <label className="block text-xs font-semibold text-ber-gray uppercase tracking-wide mb-1">Momento</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TemperaturaTipo)} className={inputCls}>
              {TIPOS_TEMPERATURA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ber-gray uppercase tracking-wide mb-1">Data da coleta</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ber-gray uppercase tracking-wide mb-1">Avaliação</label>
            <div className="grid grid-cols-3 gap-1.5">
              {AVALIACOES.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvaliacao(a)}
                  className={`text-[11px] font-medium rounded px-2 py-2 border-2 transition-all ${
                    avaliacao === a ? `${TEMP_COLORS[a]} border-ber-carbon` : 'bg-white text-ber-gray border-ber-gray/20 hover:border-ber-gray/40'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ber-gray uppercase tracking-wide mb-1">Observação (opcional)</label>
            <textarea rows={3} value={observacao} onChange={e => setObservacao(e.target.value)}
              placeholder="Contexto, falas do cliente, ações pendentes…"
              className={inputCls + ' resize-none'} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-ber-gray/15 px-5 py-3">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm font-medium text-ber-gray hover:bg-ber-bg/40">
            Cancelar
          </button>
          <button onClick={save} disabled={saving} className="rounded-md bg-ber-carbon px-3 py-1.5 text-sm font-semibold text-white hover:bg-ber-black disabled:opacity-50">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = 'block w-full rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none';

/** Coluna de atividades (período atual ou próximo) do relatório semanal. */
function AtividadesColuna({
  titulo, subtitulo, items, dotClass, vazio,
}: {
  titulo: string;
  subtitulo: string;
  items: AtividadeSemana[];
  dotClass: string;
  vazio: string;
}) {
  return (
    <div className="border border-ber-gray/20 p-3">
      <div className="mb-2 flex items-baseline gap-2 border-b border-ber-gray/15 pb-1.5">
        <h4 className="text-[13px] font-black text-ber-carbon">{titulo}</h4>
        <span className="text-[10px] font-bold uppercase tracking-wide text-ber-gray">{subtitulo}</span>
        <span className="ml-auto text-[11px] font-bold tabular-nums text-ber-gray">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="py-3 text-[11px] text-ber-gray italic">{vazio}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((a, i) => (
            <li key={`${a.wbs}-${i}`} className="flex items-start gap-2">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] leading-snug text-ber-carbon">{a.nome}</p>
                <div className="flex flex-wrap items-center gap-x-3 text-[10px] text-ber-gray">
                  {a.wbs && <span className="tabular-nums">{a.wbs}</span>}
                  {(a.inicio || a.fim) && (
                    <span className="tabular-nums">
                      {a.inicio ? fmtDate(a.inicio) : '—'} a {a.fim ? fmtDate(a.fim) : '—'}
                    </span>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-[11px] font-bold tabular-nums text-ber-carbon">
                {Math.round(a.percentualConcluido ?? 0)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PrazoRow({ label, value, color = 'normal' }: { label: string; value: string; color?: 'normal' | 'green' | 'red' }) {
  const c = color === 'green' ? 'text-green-700' : color === 'red' ? 'text-red-600' : 'text-ber-carbon';
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 text-[12px] py-0.5">
      <span className="text-ber-carbon">{label}</span>
      <span className={`font-bold tabular-nums ${c}`}>{value}</span>
    </div>
  );
}
