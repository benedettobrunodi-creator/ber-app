'use client';

/**
 * Capa da Obra — one-pager executivo estilo planilha BÈR.
 *
 * Reproduz a "primeira aba da planilha" que Bruno enviava ao cliente:
 *   Header (info da obra) + Painel de Controle:
 *     [PRAZOS] · [RESULTADO + CONTRATAÇÕES (donut)] · [TEMPERATURA]
 *   + Linha do Tempo / Cronograma (curva S)
 *
 * Imprime bem em A4 paisagem (para anexar em apresentações).
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Printer, Plus, Trash2, X, RefreshCw } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import api from '@/lib/api';
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

interface CronogramaTarefa { i?: string | null; inicio?: string | null; f?: string | null; fim?: string | null; d?: number | null; duracaoDias?: number | null; p?: number; percentualConcluido?: number; r?: boolean; ehResumo?: boolean }
interface Cronograma { progressPct?: number | null; parsedData: { tarefas?: CronogramaTarefa[] } | null }

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(v);
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const daysBetween = (a: Date | null, b: Date | null): number | null => {
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
};

export default function CapaObraPage() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;
  const backHref = useBackToObra();

  const [obra, setObra] = useState<ObraInfo | null>(null);
  const [contratos, setContratos] = useState<ContratacoesResp | null>(null);
  const [cronograma, setCronograma] = useState<Cronograma | null>(null);
  const [temperaturas, setTemperaturas] = useState<TemperaturaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tempModalOpen, setTempModalOpen] = useState(false);
  const [tempEditing, setTempEditing] = useState<TemperaturaRow | null>(null);

  async function load() {
    setLoading(true);
    const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
    const [o, c, cron, temps] = await Promise.all([
      safe(api.get<{ data: ObraInfo }>(`/obras/${obraId}`).then(r => r.data.data)),
      safe(api.get<{ data: ContratacoesResp }>(`/obras/${obraId}/contratacoes`).then(r => r.data.data)),
      safe(api.get<{ data: Cronograma }>(`/obras/${obraId}/cronograma`).then(r => r.data.data)),
      safe(api.get<{ data: TemperaturaRow[] }>(`/obras/${obraId}/temperatura`).then(r => r.data.data)),
    ]);
    setObra(o);
    setContratos(c);
    setCronograma(cron);
    setTemperaturas(temps ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [obraId]);

  async function deleteTemperatura(id: string) {
    if (!confirm('Remover esta avaliação?')) return;
    try { await api.delete(`/temperatura/${id}`); load(); }
    catch (err) { alert(((err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error as { message?: string } | string | undefined)?.toString() ?? 'Erro ao remover'); }
  }

  if (loading || !obra) {
    return <div className="p-6 text-sm text-ber-gray">Carregando capa…</div>;
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
  const total = contratos?.totals.total ?? 0;
  const byStatus = contratos?.totals.byStatus ?? {};
  const contratados = (Number(byStatus['ativo'] ?? 0) + Number(byStatus['contratado'] ?? 0));
  const aContratar = total - contratados;
  // "Em atraso" = contratações que não estão ativas/contratadas e cujo plano deve estar atrasado.
  // Sem campo direto, aproximação: usa Math.min(aContratar, contratos.contratacoes.filter status === 'atrasado').length
  const emAtraso = Number(byStatus['atrasado'] ?? 0);
  const previstos = total > 0 ? total : 35; // fallback do exemplo da planilha enquanto não há dados

  const donutData = total > 0
    ? [
        { name: 'CONTRATADOS', value: contratados, color: '#3B82F6' },
        { name: 'A CONTRATAR', value: Math.max(0, aContratar - emAtraso), color: '#F59E0B' },
        { name: 'EM ATRASO', value: emAtraso, color: '#DC2626' },
      ].filter(d => d.value > 0)
    : [{ name: 'sem dados', value: 1, color: '#E5E5E5' }];

  // ─── Curva S do cronograma ─────────────────────────────────────────────
  // Mesma fórmula da Curva S "oficial" (web/.../obras/[id]/page.tsx — generateCurvaS):
  // planejado = % linear do tempo decorrido dentro do span da tarefa-raiz;
  // realizado = currentPct na semana atual; proporção planejado×currentPct/planTodayPct nas passadas.
  type CurvaPt = { label: string; planejado: number; real: number | null };
  const tarefas = cronograma?.parsedData?.tarefas ?? [];
  const tFim = (t: typeof tarefas[number]) => (t.f ?? t.fim) ?? null;
  const tIni = (t: typeof tarefas[number]) => (t.i ?? t.inicio) ?? null;
  const tDur = (t: typeof tarefas[number]) => (t.d ?? t.duracaoDias) ?? 0;
  const tPct = (t: typeof tarefas[number]) => (t.p ?? t.percentualConcluido) ?? 0;
  const isResumo = (t: typeof tarefas[number]) => !!(t.r ?? t.ehResumo);

  const folhas = tarefas.filter(t => !isResumo(t) && tDur(t) > 0 && tIni(t) && tFim(t));
  const totalDias = folhas.reduce((s, t) => s + tDur(t), 0);
  // Span do projeto = min/max entre TODAS as tarefas com data (resumo + folha).
  // Não confia em "achar a raiz" — parsers podem não marcar a linha 0 como
  // ehResumo, ou pegar um sub-pacote que termina antes do projeto real.
  const comDatas = tarefas.filter(t => tIni(t) && tFim(t));
  const raizIni = comDatas.reduce((min, t) => {
    const i = tIni(t)!; return !min || i < min ? i : min;
  }, '' as string);
  const raizFim = comDatas.reduce((max, t) => {
    const f = tFim(t)!; return !max || f > max ? f : max;
  }, '' as string);

  const curva: CurvaPt[] = [];
  if (folhas.length > 0 && totalDias > 0 && raizIni && raizFim) {
    const raizStartMs = new Date(raizIni + 'T00:00:00').getTime();
    const raizEndMs   = new Date(raizFim + 'T00:00:00').getTime();
    if (raizEndMs > raizStartMs) {
      // Pré-computa inicio/fim/duracao em ms pra cada folha
      const folhasMs = folhas.map(t => ({
        iniMs: new Date(tIni(t)! + 'T00:00:00').getTime(),
        fimMs: new Date(tFim(t)! + 'T00:00:00').getTime(),
        dur:   tDur(t),
      }));
      // % planejado de uma folha numa data (= coluna "% Planejado" do MS Project)
      const leafPlanAt = (ms: number, iniMs: number, fimMs: number) => {
        if (ms >= fimMs) return 1;
        if (ms <= iniMs) return 0;
        return (ms - iniMs) / (fimMs - iniMs);
      };
      const planAt = (ms: number) => {
        const acc = folhasMs.reduce((s, f) => s + f.dur * leafPlanAt(ms, f.iniMs, f.fimMs), 0);
        return acc / totalDias * 100;
      };

      const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
      const todayMs = todayD.getTime();
      const currentPct = cronograma?.progressPct ?? Math.round(
        folhas.reduce((s, t) => s + tDur(t) * tPct(t) / 100, 0) / totalDias * 100,
      );
      const planTodayPct = planAt(todayMs);

      const firstDay = new Date(raizIni + 'T00:00:00');
      const dow = firstDay.getDay();
      firstDay.setDate(firstDay.getDate() - (dow === 0 ? 6 : dow - 1));
      const loopEnd = new Date(raizFim + 'T00:00:00');
      const cursor = new Date(firstDay);
      while (cursor <= loopEnd) {
        const weekEnd = new Date(cursor); weekEnd.setDate(weekEnd.getDate() + 6); weekEnd.setHours(23, 59, 59);
        const planejado = Math.round(planAt(weekEnd.getTime()) * 10) / 10;
        let real: number | null;
        const isCurrentWeek = cursor <= todayD && todayD <= weekEnd;
        const isPast = weekEnd.getTime() < todayMs;
        if (isCurrentWeek) real = currentPct;
        else if (isPast && planTodayPct > 0) real = Math.round(planejado * currentPct / planTodayPct * 10) / 10;
        else real = null;
        const k = cursor.toISOString().slice(0, 10);
        const [, m, day] = k.split('-');
        curva.push({ label: `${day}/${m}`, planejado, real });
        cursor.setDate(cursor.getDate() + 7);
      }
    }
  }

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

  return (
    <div className="p-3 md:p-6 print:p-0 bg-white min-h-screen">
      {/* Header navegação (esconde na impressão) */}
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
                  <span>Percentual de Obra <span className="font-bold text-ber-carbon">{obra.progressPercent}%</span></span>
                </td>
              </tr>
              <tr><td className="text-ber-gray font-medium">Status</td><td className="uppercase font-medium">{obra.status.replace(/_/g, ' ')}</td></tr>
            </tbody>
          </table>
          <div className="flex items-center justify-center min-w-[120px]">
            <div className="text-right">
              <div className="text-[10px] tracking-widest text-ber-gray font-bold">STATUS</div>
              <div className="text-4xl font-black text-ber-carbon">OBRA</div>
            </div>
          </div>
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
              <div className="text-ber-carbon">CONTRATADOS</div><div className="text-right font-bold text-blue-700">{contratados}</div>
              <div className="text-ber-carbon">A CONTRATAR</div><div className="text-right font-bold text-amber-600">{Math.max(0, aContratar - emAtraso)}</div>
              <div className="text-ber-carbon">EM ATRASO</div><div className="text-right font-bold text-red-600">{emAtraso}</div>
            </div>
            <div className="h-[140px] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius={35} outerRadius={60} paddingAngle={2}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
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
                    className="print:hidden opacity-0 group-hover/temp:opacity-100 text-ber-gray hover:text-red-600 transition-opacity"
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

      {/* ─── LINHA DO TEMPO / CRONOGRAMA ────────────────────────────────── */}
      <div className="border border-ber-gray/20 p-4 bg-white">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-black text-ber-carbon">LINHA DO TEMPO / CRONOGRAMA</h3>
          <button onClick={load}
            className="flex items-center gap-1 rounded border border-ber-gray/30 px-2 py-1 text-xs font-medium text-ber-carbon hover:bg-ber-bg print:hidden">
            <RefreshCw size={12} /> Atualizar
          </button>
        </div>
        {curva.length === 0 ? (
          <div className="py-12 text-center text-sm text-ber-gray italic">
            Sem cronograma parseado pra essa obra ainda — a curva S aparece aqui assim que o cronograma tiver tarefas cadastradas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="h-[280px]" style={{ width: Math.max(600, curva.length * 50) }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={curva}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-45} textAnchor="end" height={50} />
                  <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip
                    formatter={((v: unknown, name: unknown) => [
                      `${typeof v === 'number' ? v.toFixed(1) : String(v)}%`,
                      name === 'planejado' ? 'Planejado' : 'Real',
                    ]) as never}
                    labelFormatter={(l) => `Semana ${l}`}
                    contentStyle={{ fontSize: 11, padding: '6px 10px' }} />
                  <Line type="monotone" dataKey="planejado" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} name="Planejado" />
                  <Line type="monotone" dataKey="real" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} name="Real" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

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

function PrazoRow({ label, value, color = 'normal' }: { label: string; value: string; color?: 'normal' | 'green' | 'red' }) {
  const c = color === 'green' ? 'text-green-700' : color === 'red' ? 'text-red-600' : 'text-ber-carbon';
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 text-[12px] py-0.5">
      <span className="text-ber-carbon">{label}</span>
      <span className={`font-bold tabular-nums ${c}`}>{value}</span>
    </div>
  );
}
