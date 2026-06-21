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
import { ArrowLeft, Printer } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import api from '@/lib/api';
import { useBackToObra } from '@/hooks/useBackToObra';

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

interface CronogramaTarefa { p?: number; percentualConcluido?: number; f?: string | null; fim?: string | null; r?: boolean; ehResumo?: boolean }
interface Cronograma { parsedData: { tarefas?: CronogramaTarefa[] } | null }

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);
      const [o, c, cron] = await Promise.all([
        safe(api.get<{ data: ObraInfo }>(`/obras/${obraId}`).then(r => r.data.data)),
        safe(api.get<{ data: ContratacoesResp }>(`/obras/${obraId}/contratacoes`).then(r => r.data.data)),
        safe(api.get<{ data: Cronograma }>(`/obras/${obraId}/cronograma`).then(r => r.data.data)),
      ]);
      setObra(o);
      setContratos(c);
      setCronograma(cron);
      setLoading(false);
    }
    load();
  }, [obraId]);

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
  type CurvaPt = { label: string; planejado: number; real: number };
  const tarefas = cronograma?.parsedData?.tarefas ?? [];
  const leaf = tarefas.filter(t => !(t.r ?? t.ehResumo) && (t.f ?? t.fim));
  // Agrupa por mês
  const byMonth = new Map<string, { p: number; r: number; count: number }>();
  leaf.forEach(t => {
    const fim = t.f ?? t.fim;
    if (!fim) return;
    const d = new Date(fim);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const pct = (t.p ?? t.percentualConcluido ?? 0);
    const e = byMonth.get(key) ?? { p: 0, r: 0, count: 0 };
    e.p += 100; // planejado = 100% até esta data
    e.r += pct;
    e.count += 1;
    byMonth.set(key, e);
  });
  const sortedKeys = [...byMonth.keys()].sort();
  let acumPlan = 0, acumReal = 0, totalLeaf = leaf.length || 1;
  const curva: CurvaPt[] = sortedKeys.map(k => {
    const e = byMonth.get(k)!;
    acumPlan += e.count;
    acumReal += e.r / 100;
    return {
      label: k.slice(2),
      planejado: Math.round((acumPlan / totalLeaf) * 100),
      real: Math.round((acumReal / totalLeaf) * 100),
    };
  });

  // ─── Temperatura (placeholder até ter schema) ──────────────────────────
  const temperaturaPlaceholder = [1, 2, 3, 4, 5, 6].map(m => ({ momento: m, data: null as string | null, avaliacao: null as string | null }));
  const tempColors: Record<string, string> = {
    'Muito Ruim': 'bg-red-900 text-white',
    'Ruim':       'bg-red-500 text-white',
    'Regular':    'bg-yellow-400 text-yellow-900',
    'Bom':        'bg-lime-500 text-white',
    'Muito Bom':  'bg-green-600 text-white',
    'Ótimo':      'bg-sky-400 text-white',
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
          <h3 className="text-lg font-black text-ber-carbon mb-3">TEMPERATURA</h3>
          <div className="grid grid-cols-3 gap-1 text-[10px] font-bold uppercase tracking-wide text-ber-gray pb-1 border-b border-ber-gray/20">
            <span>Momento Processo</span>
            <span className="text-center">Data</span>
            <span className="text-center">Avaliação</span>
          </div>
          {temperaturaPlaceholder.map(t => (
            <div key={t.momento} className="grid grid-cols-3 gap-1 text-[12px] py-1 border-b border-ber-gray/10 items-center">
              <span className="text-ber-carbon">Momento {t.momento}</span>
              <span className="text-center text-ber-gray">{t.data ?? '—'}</span>
              <span className={`text-center text-[11px] font-medium rounded px-2 py-0.5 ${t.avaliacao ? tempColors[t.avaliacao] : 'text-ber-gray/40 italic'}`}>
                {t.avaliacao ?? '—'}
              </span>
            </div>
          ))}
          <p className="mt-2 text-[10px] text-ber-gray/60 italic">⚠ Configuração de Temperatura em desenvolvimento — sem schema ainda.</p>
        </div>
      </div>

      {/* ─── LINHA DO TEMPO / CRONOGRAMA ────────────────────────────────── */}
      <div className="border border-ber-gray/20 p-4 bg-white">
        <h3 className="text-lg font-black text-ber-carbon mb-3">LINHA DO TEMPO / CRONOGRAMA</h3>
        {curva.length === 0 ? (
          <div className="py-12 text-center text-sm text-ber-gray italic">
            Sem cronograma parseado pra essa obra ainda — a curva S aparece aqui assim que o cronograma tiver tarefas cadastradas.
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curva}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Line type="monotone" dataKey="planejado" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} name="Planejado" />
                <Line type="monotone" dataKey="real" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} name="Real" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}</style>
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
