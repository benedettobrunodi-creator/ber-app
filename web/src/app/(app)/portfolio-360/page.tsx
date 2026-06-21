'use client';

/**
 * Portfolio 360 — visão agregada de todas as obras ativas.
 *
 * Espelha as 6 dimensões do Gestão 360 de cada obra individual,
 * mas em modo portfolio. Cada linha = uma obra; clique abre o 360.
 *
 * Substitui Dashboard (/dashboard) + Painel (/kanban) com um só lugar.
 *
 * v1 (este arquivo): fan-out no front consumindo endpoints existentes.
 * v2 (TODO backend): endpoints /portfolio/{visao,equipe,compras,reunioes,aditivos,medicoes}
 *   pra evitar N+1 quando o portfólio crescer > 30 obras.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard, Users, ShoppingCart, FileSearch, FileText, Activity,
  AlertTriangle, ArrowRight, CheckCircle2, Clock, Building2, TrendingDown,
  RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────────────────────
type TabKey = 'visao' | 'equipe' | 'compras' | 'reunioes' | 'aditivos' | 'medicoes';

interface AditivoLite { id: string; numero: string; descricao: string; valor: string; tipo: 'credito' | 'debito'; status: string; dataAbertura: string }
interface AditivosResp { aditivos: AditivoLite[]; totals: { total: number; byStatus: Record<string, number> } }
interface Stakeholder { id: string; empresa: string; nome: string; cargo: string | null; funcao: string | null }
interface Contratacao { id: string; fornecedor: string; disciplina: string | null; valor: string; status: string; vigenciaFim: string | null }
interface ContratacoesResp { contratacoes: Contratacao[]; totals: { total: number; byStatus: Record<string, number> } }
interface Oc { id: string; numero: string; fornecedor: string; descricao: string; valor: string; status: string; dataPrevistaEntrega: string | null }
interface OcsResp { ocs: Oc[]; totals: { total: number; byStatus: Record<string, number> } }
interface PlanoLite { id: string; pacote: string; dataLimite: string | null; statusEfetivo: string }
interface Ata { id: string; numero: string; data: string; pauta: string; pendencias: { status: string }[] }
interface Documento { id: string; tipo: string; nome: string; status: string; dataEmissao: string | null }
interface DocumentosResp { documentos: Documento[]; totals: { byStatus: Record<string, number> } }
interface PunchItem { id: string; descricao: string; status: string; prazo: string | null }

interface ObraRow {
  id: string;
  name: string;
  client: string | null;
  status: string;
  startDate: string | null;
  expectedEndDate: string | null;
  progressPercent: number;
  valorContrato: number | null;
  // hydrated async:
  aditivos?: AditivosResp | null;
  contratos?: ContratacoesResp | null;
  ocs?: OcsResp | null;
  planos?: PlanoLite[];
  atas?: Ata[];
  stakeholders?: Stakeholder[];
  documentos?: DocumentosResp | null;
  pendencias?: PunchItem[];
}

// ─── Tabs ──────────────────────────────────────────────────────────────────
const TABS: { key: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'visao',    label: 'Visão Geral',         icon: LayoutDashboard },
  { key: 'equipe',   label: 'Equipe',              icon: Users },
  { key: 'compras',  label: 'Compras',             icon: ShoppingCart },
  { key: 'reunioes', label: 'Reuniões',            icon: FileSearch },
  { key: 'aditivos', label: 'Aditivos',            icon: FileText },
  { key: 'medicoes', label: 'Medições & Docs',     icon: Activity },
];

// ─── Format helpers ────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
const fmtBRLcompact = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}k` : fmtBRL(v);

function diasRestantes(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}
function timePct(o: ObraRow): number | null {
  if (!o.startDate || !o.expectedEndDate) return null;
  const total = new Date(o.expectedEndDate).getTime() - new Date(o.startDate).getTime();
  const elapsed = Date.now() - new Date(o.startDate).getTime();
  if (total <= 0) return null;
  return Math.min(100, Math.round((elapsed / total) * 100));
}
function health(o: ObraRow): 'ok' | 'risco' | 'atrasado' | null {
  const t = timePct(o);
  if (t == null) return null;
  const d = (o.progressPercent ?? 0) - t;
  if (d >= -5) return 'ok';
  if (d >= -20) return 'risco';
  return 'atrasado';
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function Portfolio360Page() {
  const [tab, setTab] = useState<TabKey>('visao');
  const [obras, setObras] = useState<ObraRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hydrating, setHydrating] = useState(false);

  async function load() {
    setLoading(true);
    const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

    const res = await api.get('/obras').catch(() => null);
    const ativas: ObraRow[] = (res?.data?.data ?? []).filter((o: ObraRow) => o.status === 'em_andamento');
    setObras(ativas);
    setLoading(false);
    setHydrating(true);

    // Fan-out por obra. TODO: substituir por endpoints /portfolio/* agregados no backend.
    const hydrated = await Promise.all(ativas.map(async (o) => {
      const [aditivos, contratos, ocs, planos, atas, stakeholders, documentos, punchRes] = await Promise.all([
        safe(api.get(`/obras/${o.id}/aditivos`).then(r => r.data.data as AditivosResp)),
        safe(api.get(`/obras/${o.id}/contratacoes`).then(r => r.data.data as ContratacoesResp)),
        safe(api.get(`/obras/${o.id}/ordens-compra`).then(r => r.data.data as OcsResp)),
        safe(api.get(`/obras/${o.id}/contratacao-plano`).then(r => r.data.data as PlanoLite[])),
        safe(api.get(`/obras/${o.id}/atas`).then(r => r.data.data as Ata[])),
        safe(api.get(`/obras/${o.id}/stakeholders`).then(r => r.data.data as Stakeholder[])),
        safe(api.get(`/obras/${o.id}/documentos`).then(r => r.data.data as DocumentosResp)),
        safe(api.get(`/obras/${o.id}/punch-lists`).then(r => r.data.data as { items: PunchItem[] }[])),
      ]);
      const pendencias: PunchItem[] = [];
      (punchRes ?? []).forEach(pl => (pl.items ?? []).forEach(it => pendencias.push(it)));
      return { ...o, aditivos, contratos, ocs, planos: planos ?? [], atas: atas ?? [], stakeholders: stakeholders ?? [], documentos, pendencias };
    }));
    setObras(hydrated);
    setHydrating(false);
  }

  useEffect(() => { load(); }, []);

  // ─── KPIs globais (topbar) ───────────────────────────────────────────────
  const kpis = useMemo(() => {
    const ativas = obras.length;
    const atrasadas = obras.filter(o => {
      const d = diasRestantes(o.expectedEndDate);
      return d != null && d < 0;
    }).length;
    const emRisco = obras.filter(o => ['risco', 'atrasado'].includes(health(o) ?? '')).length;
    const aditivosLiq = obras.reduce((s, o) => s + Number(o.aditivos?.totals.total ?? 0), 0);
    const pendAbertas = obras.reduce(
      (s, o) => s + (o.pendencias ?? []).filter(p => p.status === 'aberto' || p.status === 'em_andamento').length, 0
    );
    const docsEmAnalise = obras.reduce((s, o) => s + Number(o.documentos?.totals.byStatus['em_analise'] ?? 0), 0);
    return { ativas, atrasadas, emRisco, aditivosLiq, pendAbertas, docsEmAnalise };
  }, [obras]);

  if (loading) {
    return <div className="p-6 text-center text-sm text-ber-gray">Carregando Portfolio 360…</div>;
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Building2 size={22} className="text-ber-teal" />
          <h1 className="text-2xl font-black text-ber-carbon">Portfolio 360</h1>
          {hydrating && <span className="text-[10px] text-ber-gray animate-pulse">carregando módulos…</span>}
        </div>
        <button onClick={load} className="text-xs text-ber-gray hover:text-ber-carbon inline-flex items-center gap-1">
          <RefreshCw size={12} /> Atualizar
        </button>
      </div>

      {/* KPI topbar */}
      <div className="mb-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Obras ativas" big={String(kpis.ativas)} sub="em andamento" />
        <KpiCard label="Em risco" big={String(kpis.emRisco)} sub={`${kpis.atrasadas} atrasadas`} accent={kpis.emRisco > 0 ? 'red' : 'green'} />
        <KpiCard label="Pendências abertas" big={String(kpis.pendAbertas)} sub="punch lists" accent={kpis.pendAbertas > 20 ? 'red' : kpis.pendAbertas > 0 ? 'amber' : 'green'} />
        <KpiCard label="Aditivos líquidos" big={fmtBRLcompact(kpis.aditivosLiq)} sub="exposição total" accent={kpis.aditivosLiq >= 0 ? 'green' : 'red'} />
        <KpiCard label="Docs em análise" big={String(kpis.docsEmAnalise)} sub="aguardando aprovação" accent={kpis.docsEmAnalise > 0 ? 'amber' : 'green'} />
        <KpiCard label="Valor portfólio" big={fmtBRLcompact(obras.reduce((s, o) => s + Number(o.valorContrato ?? 0), 0))} sub="contratos" />
      </div>

      {/* Tabs */}
      <div className="mb-5 flex items-center gap-1 border-b border-ber-gray/20 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                tab === t.key ? 'border-b-2 border-ber-olive text-ber-carbon' : 'text-ber-gray hover:text-ber-carbon'
              }`}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'visao'    && <TabVisao obras={obras} />}
      {tab === 'equipe'   && <TabEquipe obras={obras} />}
      {tab === 'compras'  && <TabCompras obras={obras} />}
      {tab === 'reunioes' && <TabReunioes obras={obras} />}
      {tab === 'aditivos' && <TabAditivos obras={obras} />}
      {tab === 'medicoes' && <TabMedicoes obras={obras} />}
    </div>
  );
}

// ─── TAB: Visão Geral ──────────────────────────────────────────────────────
function TabVisao({ obras }: { obras: ObraRow[] }) {
  const ordered = [...obras].sort((a, b) => {
    const order = { atrasado: 0, risco: 1, ok: 2 } as const;
    const ha = health(a); const hb = health(b);
    return (order[ha ?? 'ok'] ?? 3) - (order[hb ?? 'ok'] ?? 3);
  });
  return (
    <Section title={`Obras em andamento · ${obras.length}`} linkTo={null}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ber-gray/15 text-[10px] uppercase tracking-wide text-ber-gray">
              <Th>Obra</Th>
              <Th>Cliente</Th>
              <Th className="text-right">Físico</Th>
              <Th className="text-right">Tempo</Th>
              <Th className="text-right">Δ</Th>
              <Th className="text-right">Prazo</Th>
              <Th className="text-right">Pend.</Th>
              <Th className="text-right">Saúde</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ber-gray/10">
            {ordered.map(o => {
              const t = timePct(o);
              const delta = t != null ? (o.progressPercent ?? 0) - t : null;
              const d = diasRestantes(o.expectedEndDate);
              const h = health(o);
              const pend = (o.pendencias ?? []).filter(p => p.status === 'aberto' || p.status === 'em_andamento').length;
              const color = h === 'atrasado' ? 'bg-red-500' : h === 'risco' ? 'bg-amber-400' : h === 'ok' ? 'bg-green-500' : 'bg-ber-gray/30';
              return (
                <tr key={o.id} className="hover:bg-ber-bg/30 transition-colors">
                  <Td>
                    <Link href={`/obras/${o.id}/gestao-360`} className="font-medium text-ber-carbon hover:text-ber-teal inline-flex items-center gap-1">
                      {o.name} <ArrowRight size={11} className="opacity-50" />
                    </Link>
                  </Td>
                  <Td className="text-ber-gray text-xs">{o.client || '—'}</Td>
                  <Td className="text-right tabular-nums">{o.progressPercent ?? 0}%</Td>
                  <Td className="text-right tabular-nums text-ber-gray">{t != null ? `${t}%` : '—'}</Td>
                  <Td className={`text-right tabular-nums font-semibold ${
                    delta == null ? 'text-ber-gray' : delta >= -5 ? 'text-ber-carbon/60' : delta >= -20 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`}
                  </Td>
                  <Td className={`text-right tabular-nums ${d == null ? 'text-ber-gray' : d < 0 ? 'text-red-600 font-semibold' : d <= 30 ? 'text-amber-600' : 'text-ber-carbon'}`}>
                    {d == null ? '—' : d < 0 ? `${Math.abs(d)}d atraso` : `${d}d`}
                  </Td>
                  <Td className="text-right tabular-nums">{pend || '—'}</Td>
                  <Td className="text-right">
                    <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ─── TAB: Equipe ───────────────────────────────────────────────────────────
function TabEquipe({ obras }: { obras: ObraRow[] }) {
  // alocação cruzada: pessoa -> obras em que aparece como stakeholder
  const peopleMap = new Map<string, { nome: string; empresa: string; obras: { id: string; name: string }[] }>();
  obras.forEach(o => {
    (o.stakeholders ?? []).forEach(s => {
      const key = `${s.nome}::${s.empresa}`;
      const cur = peopleMap.get(key) || { nome: s.nome, empresa: s.empresa, obras: [] };
      cur.obras.push({ id: o.id, name: o.name });
      peopleMap.set(key, cur);
    });
  });
  const multiAlocadas = [...peopleMap.values()].filter(p => p.obras.length > 1).sort((a, b) => b.obras.length - a.obras.length);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Section title="Pessoas alocadas em múltiplas obras" linkTo={null}>
        {multiAlocadas.length === 0 ? <EmptyMsg msg="Ninguém alocado em mais de uma obra (ou stakeholders ainda não cadastrados)" /> : (
          <ul className="space-y-2 text-sm">
            {multiAlocadas.slice(0, 15).map((p, i) => (
              <li key={i} className="flex items-start justify-between gap-3 border-l-2 border-ber-teal/40 pl-3">
                <div className="min-w-0">
                  <p className="font-medium text-ber-carbon">{p.nome}</p>
                  <p className="text-xs text-ber-gray">{p.empresa}</p>
                </div>
                <span className="text-xs text-ber-gray shrink-0">{p.obras.length} obras</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Stakeholders por obra" linkTo={null}>
        <table className="w-full text-sm">
          <thead><tr className="text-[10px] uppercase tracking-wide text-ber-gray border-b border-ber-gray/15">
            <Th>Obra</Th><Th className="text-right">Stakeholders</Th>
          </tr></thead>
          <tbody className="divide-y divide-ber-gray/10">
            {obras.map(o => (
              <tr key={o.id}>
                <Td><Link href={`/obras/${o.id}/stakeholders`} className="text-ber-carbon hover:text-ber-teal">{o.name}</Link></Td>
                <Td className="text-right tabular-nums">
                  {(o.stakeholders?.length ?? 0) === 0
                    ? <span className="text-amber-600 text-xs">vazio</span>
                    : o.stakeholders?.length}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ─── TAB: Compras ──────────────────────────────────────────────────────────
function TabCompras({ obras }: { obras: ObraRow[] }) {
  const today = Date.now();
  const vencendoEm = (dias: number) => obras.flatMap(o =>
    (o.contratos?.contratacoes ?? [])
      .filter(c => c.vigenciaFim && (new Date(c.vigenciaFim).getTime() - today) <= dias * 86400000 && (new Date(c.vigenciaFim).getTime() - today) > 0)
      .map(c => ({ obraId: o.id, obraName: o.name, ...c }))
  );

  const planosAtrasados = obras.flatMap(o =>
    (o.planos ?? []).filter(p => p.statusEfetivo === 'atrasado').map(p => ({ obraId: o.id, obraName: o.name, ...p }))
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Contratos vencendo nos próximos 30d" linkTo={null}>
          {vencendoEm(30).length === 0 ? <EmptyMsg msg="Nenhum contrato vencendo em 30d" /> : (
            <ul className="space-y-2 text-sm">
              {vencendoEm(30).slice(0, 12).map(c => (
                <li key={c.id} className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="text-ber-carbon truncate">{c.fornecedor}</p>
                    <Link href={`/obras/${c.obraId}/contratacoes`} className="text-ber-gray hover:text-ber-teal">{c.obraName}</Link>
                  </div>
                  <span className="text-amber-600 shrink-0">{c.vigenciaFim?.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Pacotes de contratação atrasados" linkTo={null}>
          {planosAtrasados.length === 0 ? <EmptyMsg msg="Nenhum pacote atrasado" /> : (
            <ul className="space-y-2 text-sm">
              {planosAtrasados.slice(0, 12).map(p => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="text-ber-carbon truncate">{p.pacote}</p>
                    <Link href={`/obras/${p.obraId}/cronograma-contratacoes`} className="text-ber-gray hover:text-ber-teal">{p.obraName}</Link>
                  </div>
                  <span className="text-red-600 shrink-0">{p.dataLimite?.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="OCs por obra (status)" linkTo={null}>
        <table className="w-full text-sm">
          <thead><tr className="text-[10px] uppercase tracking-wide text-ber-gray border-b border-ber-gray/15">
            <Th>Obra</Th><Th className="text-right">Total</Th><Th className="text-right">Pendentes</Th><Th className="text-right">Pagas</Th>
          </tr></thead>
          <tbody className="divide-y divide-ber-gray/10">
            {obras.map(o => {
              const totals = o.ocs?.totals.byStatus ?? {};
              return (
                <tr key={o.id}>
                  <Td><Link href={`/obras/${o.id}/compras`} className="text-ber-carbon hover:text-ber-teal">{o.name}</Link></Td>
                  <Td className="text-right tabular-nums">{o.ocs?.totals.total ?? 0}</Td>
                  <Td className="text-right tabular-nums text-amber-600">{Number(totals['pendente'] ?? 0)}</Td>
                  <Td className="text-right tabular-nums text-green-700">{Number(totals['pago'] ?? 0)}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ─── TAB: Reuniões ─────────────────────────────────────────────────────────
function TabReunioes({ obras }: { obras: ObraRow[] }) {
  const pendenciasAtas = obras.map(o => ({
    obra: o,
    abertas: (o.atas ?? []).reduce((s, a) => s + a.pendencias.filter(p => p.status === 'aberto').length, 0),
    total: (o.atas ?? []).reduce((s, a) => s + a.pendencias.length, 0),
    atas: (o.atas ?? []).length,
  })).sort((a, b) => b.abertas - a.abertas);

  return (
    <Section title="Atas e pendências por obra" linkTo={null}>
      <table className="w-full text-sm">
        <thead><tr className="text-[10px] uppercase tracking-wide text-ber-gray border-b border-ber-gray/15">
          <Th>Obra</Th><Th className="text-right">Atas</Th><Th className="text-right">Pend. abertas</Th><Th className="text-right">Pend. totais</Th>
        </tr></thead>
        <tbody className="divide-y divide-ber-gray/10">
          {pendenciasAtas.map(({ obra, abertas, total, atas }) => (
            <tr key={obra.id}>
              <Td><Link href={`/obras/${obra.id}/atas`} className="text-ber-carbon hover:text-ber-teal">{obra.name}</Link></Td>
              <Td className="text-right tabular-nums">{atas}</Td>
              <Td className={`text-right tabular-nums font-semibold ${abertas > 5 ? 'text-red-600' : abertas > 0 ? 'text-amber-600' : 'text-green-700'}`}>{abertas}</Td>
              <Td className="text-right tabular-nums text-ber-gray">{total}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}

// ─── TAB: Aditivos ─────────────────────────────────────────────────────────
function TabAditivos({ obras }: { obras: ObraRow[] }) {
  const linhas = obras.map(o => {
    const a = o.aditivos;
    return {
      obra: o,
      total: Number(a?.totals.total ?? 0),
      qtd: a?.aditivos.length ?? 0,
      emAnalise: Number(a?.totals.byStatus['em_analise'] ?? 0),
      aprovados: Number(a?.totals.byStatus['aprovado'] ?? 0),
    };
  }).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  const exposicaoTotal = linhas.reduce((s, l) => s + l.total, 0);

  return (
    <div className="space-y-4">
      <Section title={`Exposição total: ${fmtBRLcompact(exposicaoTotal)}`} linkTo={null}>
        <table className="w-full text-sm">
          <thead><tr className="text-[10px] uppercase tracking-wide text-ber-gray border-b border-ber-gray/15">
            <Th>Obra</Th><Th className="text-right">Qtd</Th><Th className="text-right">Líquido</Th><Th className="text-right">Em análise</Th><Th className="text-right">Aprovados</Th>
          </tr></thead>
          <tbody className="divide-y divide-ber-gray/10">
            {linhas.map(({ obra, total, qtd, emAnalise, aprovados }) => (
              <tr key={obra.id}>
                <Td><Link href={`/obras/${obra.id}/aditivos`} className="text-ber-carbon hover:text-ber-teal">{obra.name}</Link></Td>
                <Td className="text-right tabular-nums">{qtd}</Td>
                <Td className={`text-right tabular-nums font-semibold ${total < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmtBRLcompact(total)}</Td>
                <Td className="text-right tabular-nums text-amber-600">{emAnalise ? fmtBRLcompact(emAnalise) : '—'}</Td>
                <Td className="text-right tabular-nums text-ber-gray">{aprovados ? fmtBRLcompact(aprovados) : '—'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ─── TAB: Medições & Documentos ────────────────────────────────────────────
function TabMedicoes({ obras }: { obras: ObraRow[] }) {
  return (
    <div className="space-y-4">
      <Section title="Documentos por status (por obra)" linkTo={null}>
        <table className="w-full text-sm">
          <thead><tr className="text-[10px] uppercase tracking-wide text-ber-gray border-b border-ber-gray/15">
            <Th>Obra</Th><Th className="text-right">Aprovados</Th><Th className="text-right">Em análise</Th><Th className="text-right">Pendentes</Th>
          </tr></thead>
          <tbody className="divide-y divide-ber-gray/10">
            {obras.map(o => {
              const s = o.documentos?.totals.byStatus ?? {};
              return (
                <tr key={o.id}>
                  <Td><Link href={`/obras/${o.id}/documentos`} className="text-ber-carbon hover:text-ber-teal">{o.name}</Link></Td>
                  <Td className="text-right tabular-nums text-green-700">{Number(s['aprovado'] ?? 0)}</Td>
                  <Td className="text-right tabular-nums text-amber-600">{Number(s['em_analise'] ?? 0)}</Td>
                  <Td className="text-right tabular-nums text-ber-gray">{Number(s['pendente'] ?? 0)}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Pendências (punch lists) por obra" linkTo={null}>
        <table className="w-full text-sm">
          <thead><tr className="text-[10px] uppercase tracking-wide text-ber-gray border-b border-ber-gray/15">
            <Th>Obra</Th><Th className="text-right">Abertas</Th><Th className="text-right">Totais</Th>
          </tr></thead>
          <tbody className="divide-y divide-ber-gray/10">
            {obras.map(o => {
              const abertas = (o.pendencias ?? []).filter(p => p.status === 'aberto' || p.status === 'em_andamento').length;
              const totais = (o.pendencias ?? []).length;
              return (
                <tr key={o.id}>
                  <Td><Link href={`/obras/${o.id}/punch-lists`} className="text-ber-carbon hover:text-ber-teal">{o.name}</Link></Td>
                  <Td className={`text-right tabular-nums font-semibold ${abertas > 10 ? 'text-red-600' : abertas > 0 ? 'text-amber-600' : 'text-green-700'}`}>{abertas}</Td>
                  <Td className="text-right tabular-nums text-ber-gray">{totais}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ─── Primitives ────────────────────────────────────────────────────────────
function KpiCard({ label, big, sub, accent }: { label: string; big: string; sub?: string; accent?: 'red' | 'amber' | 'green' }) {
  const colorClass = accent === 'red' ? 'text-red-700' : accent === 'amber' ? 'text-amber-700' : accent === 'green' ? 'text-green-700' : 'text-ber-carbon';
  return (
    <div className="rounded-xl bg-white border border-ber-gray/15 p-4 shadow-sm">
      <p className="text-[10px] font-medium text-ber-gray uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-xl font-black ${colorClass}`}>{big}</p>
      {sub && <p className="text-[11px] text-ber-gray mt-0.5">{sub}</p>}
    </div>
  );
}
function Section({ title, linkTo, children }: { title: string; linkTo: string | null; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white border border-ber-gray/15 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-ber-carbon">{title}</h2>
        {linkTo && (
          <Link href={linkTo} className="text-xs text-ber-teal hover:underline inline-flex items-center gap-0.5">
            Ir pro módulo <ArrowRight size={11} />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-left px-3 py-2 font-bold ${className || ''}`}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-sm ${className || ''}`}>{children}</td>;
}
function EmptyMsg({ msg }: { msg: string }) {
  return <p className="text-xs text-ber-gray italic">{msg}</p>;
}
