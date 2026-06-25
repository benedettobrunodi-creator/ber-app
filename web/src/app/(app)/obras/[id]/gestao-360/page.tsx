'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, LayoutDashboard, Users, ShoppingCart, FileSearch, FileText, Activity,
  TrendingUp, TrendingDown, AlertTriangle, ArrowRight, CalendarClock, FileSignature,
  ShoppingBag, AlertCircle, Rocket, Network, CheckCircle2, Clock, Pencil, X, RefreshCw,
} from 'lucide-react';
import api from '@/lib/api';
import CronogramaPanel from '@/components/obras/CronogramaPanel';
import StakeholderFormModal from '@/components/obras/StakeholderFormModal';
import AditivoFormModal from '@/components/obras/AditivoFormModal';
import { ContratacaoFormModal, OcFormModal, type Contratacao as ContratacaoFull, type Oc as OcFull } from '@/components/obras/ContratacaoFormModal';
import KickoffFormModal, { type Kickoff as KickoffFull } from '@/components/obras/KickoffFormModal';

type TabKey = 'visao' | 'equipe' | 'raci' | 'compras' | 'reunioes' | 'aditivos' | 'cronograma' | 'medicoes';

const TABS: { key: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'visao',      label: 'Visão Geral',          icon: LayoutDashboard },
  { key: 'equipe',     label: 'Equipe',               icon: Users },
  { key: 'raci',       label: 'Matriz RACI',          icon: Network },
  { key: 'compras',    label: 'Compras & Contratos',  icon: ShoppingCart },
  { key: 'reunioes',   label: 'Reuniões & Decisões',  icon: FileSearch },
  { key: 'aditivos',   label: 'Aditivos & Mudanças',  icon: FileText },
  { key: 'cronograma', label: 'Cronograma & MO',      icon: CalendarClock },
  { key: 'medicoes',   label: 'Medições & Documentos', icon: Activity },
];

// ─── Types (subset of each module) ─────────────────────────────────────────
interface ObraInfo {
  id: string; name: string; client: string | null; address: string | null;
  startDate: string | null; expectedEndDate: string | null;
  progressPercent: number; status: string;
  valorContrato: number | null; arquiteturaEscritorio: string | null;
  gerenciadora: string | null; areaM2: number | null;
}
interface ComprasSummary { okSaving: number; okSavingPct: number; okSavingMeta: number; projecaoSaving: number | null; itensComprados: number; itensPendentes: number; totalComprado: number }
interface AditivoLite { id: string; numero: string; descricao: string; valor: string; tipo: 'credito' | 'debito'; status: string; dataAbertura: string }
interface AditivosResp { aditivos: AditivoLite[]; totals: { total: number; byStatus: Record<string, number> } }
interface Stakeholder { id: string; empresa: string; nome: string; cargo: string | null; email: string | null; telefone: string | null; funcao: string | null }
interface Contratacao { id: string; fornecedor: string; disciplina: string | null; valor: string; status: string; vigenciaFim: string | null; _count?: { ocs: number } }
interface ContratacoesResp { contratacoes: Contratacao[]; totals: { total: number; byStatus: Record<string, number> } }
interface Oc { id: string; numero: string; fornecedor: string; descricao: string; valor: string; status: string; dataPrevistaEntrega: string | null }
interface OcsResp { ocs: Oc[]; totals: { total: number; byStatus: Record<string, number> } }
interface PlanoLite { id: string; pacote: string; dataLimite: string | null; statusEfetivo: string }
interface AtaCorridaSummary {
  topicos: { id: string; status: string; dataAlvo: string | null; dataFinal: string | null }[];
  reunioes: { id: string; data: string }[];
}
interface Kickoff { id: string; dataRealizada: string | null; participantes: { nome: string; papel?: string | null }[]; decisoes: string | null }
interface Documento { id: string; tipo: string; nome: string; status: string; dataEmissao: string | null }
interface DocumentosResp { documentos: Documento[]; totals: { byStatus: Record<string, number> } }
interface RaciItem { id: string; atividade: string; papeis: Record<string, 'R' | 'A' | 'C' | 'I'> }
interface HistogramaCell { funcao: string; ano: number; mes: number; hhPlan: number; hhReal: number }
interface PunchListItemLite { id: string; descricao: string; status: string; prazo: string | null; origem: string; responsible: { name: string } | null }

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
const fmtBRLcompact = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}k` : fmtBRL(v);
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';
const fmtDateFull = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function Gestao360Page() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;
  const [tab, setTab] = useState<TabKey>('visao');
  const [obra, setObra] = useState<ObraInfo | null>(null);
  const [editingStakeholder, setEditingStakeholder] = useState<Stakeholder | true | null>(null);
  const [showNewAditivo, setShowNewAditivo] = useState(false);
  const [editingContratacao, setEditingContratacao] = useState<ContratacaoFull | true | null>(null);
  const [editingOc, setEditingOc] = useState<OcFull | true | null>(null);
  const [showKickoff, setShowKickoff] = useState(false);
  const [novaRaciAtividade, setNovaRaciAtividade] = useState('');
  const [savingRaci, setSavingRaci] = useState(false);
  const [compras, setCompras] = useState<ComprasSummary | null>(null);
  const [aditivos, setAditivos] = useState<AditivosResp | null>(null);
  const [contratos, setContratos] = useState<ContratacoesResp | null>(null);
  const [ocs, setOcs] = useState<OcsResp | null>(null);
  const [planos, setPlanos] = useState<PlanoLite[]>([]);
  const [ata, setAta] = useState<AtaCorridaSummary | null>(null);
  const [kickoff, setKickoff] = useState<Kickoff | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [raci, setRaci] = useState<RaciItem[]>([]);
  const [documentos, setDocumentos] = useState<DocumentosResp | null>(null);
  const [histograma, setHistograma] = useState<HistogramaCell[]>([]);
  const [pendencias, setPendencias] = useState<PunchListItemLite[]>([]);
  const [cronograma, setCronograma] = useState<{ progressPct?: number | null; parsedData: { tarefas?: { i?: string | null; inicio?: string | null; f?: string | null; fim?: string | null; d?: number | null; duracaoDias?: number | null; p?: number; percentualConcluido?: number; r?: boolean; ehResumo?: boolean }[] } | null } | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    setLoading(true);
    try {
      const safeGet = <T,>(url: string, params?: Record<string, unknown>) =>
        api.get<{ data: T }>(url, { params }).then(r => r.data.data).catch(() => null as T | null);

      const [
        obraRes,
        comprasRes,
        aditivosRes,
        contratosRes,
        ocsRes,
        planosRes,
        ataRes,
        kickoffRes,
        stakeRes,
        raciRes,
        docsRes,
        histRes,
        punchRes,
        cronRes,
      ] = await Promise.all([
        safeGet<ObraInfo>(`/obras/${obraId}`),
        safeGet<{ totais: ComprasSummary }>(`/compras-dashboard/summary`, { obraId }).then(r => r ? r.totais ?? null : null).catch(() => null) as Promise<ComprasSummary | null>,
        safeGet<AditivosResp>(`/obras/${obraId}/aditivos`),
        safeGet<ContratacoesResp>(`/obras/${obraId}/contratacoes`),
        safeGet<OcsResp>(`/obras/${obraId}/ordens-compra`),
        safeGet<PlanoLite[]>(`/obras/${obraId}/contratacao-plano`),
        safeGet<AtaCorridaSummary>(`/obras/${obraId}/atas`),
        safeGet<Kickoff>(`/obras/${obraId}/kickoff`),
        safeGet<Stakeholder[]>(`/obras/${obraId}/stakeholders`),
        safeGet<RaciItem[]>(`/obras/${obraId}/raci`),
        safeGet<DocumentosResp>(`/obras/${obraId}/documentos`),
        safeGet<HistogramaCell[]>(`/obras/${obraId}/histograma`),
        safeGet<{ id: string; type: string; items: PunchListItemLite[] }[]>(`/obras/${obraId}/punch-lists`),
        safeGet<{ progressPct?: number | null; parsedData: { tarefas?: { i?: string | null; inicio?: string | null; f?: string | null; fim?: string | null; d?: number | null; duracaoDias?: number | null; p?: number; percentualConcluido?: number; r?: boolean; ehResumo?: boolean }[] } | null }>(`/obras/${obraId}/cronograma`),
      ]);

      setObra(obraRes);
      setCompras(comprasRes ?? null);
      setAditivos(aditivosRes ?? null);
      setContratos(contratosRes ?? null);
      setOcs(ocsRes ?? null);
      setPlanos(planosRes ?? []);
      setAta(ataRes ?? null);
      setKickoff(kickoffRes ?? null);
      setStakeholders(stakeRes ?? []);
      setRaci(raciRes ?? []);
      setDocumentos(docsRes ?? null);
      setHistograma(histRes ?? []);
      setCronograma(cronRes ?? null);

      // Flatten all punch list items for the obra
      const allItems: PunchListItemLite[] = [];
      (punchRes ?? []).forEach(pl => (pl.items ?? []).forEach(it => allItems.push(it)));
      setPendencias(allItems);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchAll(); }, [obraId]);

  // Inline edit das infos da obra — salva campo isolado e atualiza estado local
  async function saveObraField(field: keyof ObraInfo, raw: string) {
    const body: Record<string, unknown> = {};
    if (field === 'startDate' || field === 'expectedEndDate') {
      body[field] = raw ? new Date(raw + 'T00:00:00').toISOString() : null;
    } else if (field === 'areaM2') {
      const n = Number(raw.replace(',', '.'));
      body[field] = !isNaN(n) && n > 0 ? n : null;
    } else if (field === 'valorContrato') {
      const n = Number(raw.replace(',', '.'));
      body[field] = !isNaN(n) && n > 0 ? n : null;
    } else {
      body[field] = raw.trim() === '' ? null : raw;
    }
    await api.put(`/obras/${obraId}`, body);
    const r = await api.get<{ data: ObraInfo }>(`/obras/${obraId}`);
    setObra(r.data.data);
  }

  // ─── Derived KPIs ─────────────────────────────────────────────────────
  const prazo = useMemo(() => {
    if (!obra?.startDate || !obra?.expectedEndDate) return null;
    const start = new Date(obra.startDate).getTime();
    const end = new Date(obra.expectedEndDate).getTime();
    const now = Date.now();
    const total = Math.max(1, Math.round((end - start) / 86400000));
    const elapsed = Math.max(0, Math.round((now - start) / 86400000));
    const remaining = Math.round((end - now) / 86400000);
    return { total, elapsed, remaining, pctElapsed: Math.min(100, (elapsed / total) * 100) };
  }, [obra]);

  const aditivosLiq = Number(aditivos?.totals.total ?? 0);
  const pendAbertas = pendencias.filter(p => p.status === 'aberto' || p.status === 'em_andamento').length;
  const atrasados = planos.filter(p => p.statusEfetivo === 'atrasado').length;
  const stakeholdersCount = stakeholders.length;
  const docsAprovados = documentos?.totals.byStatus['aprovado'] ?? 0;
  const docsEmAnalise = documentos?.totals.byStatus['em_analise'] ?? 0;

  if (loading || !obra) {
    return <div className="p-6 text-center text-sm text-ber-gray">Carregando cockpit Gestão 360…</div>;
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> {obra.name}
        </Link>
        <span>/</span><span className="text-ber-carbon font-medium">Gestão 360</span>
      </div>

      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={22} className="text-ber-teal" />
          <h1 className="text-2xl font-black text-ber-carbon">Gestão 360 · {obra.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchAll} className="text-xs text-ber-gray hover:text-ber-carbon">⟳ Atualizar</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex items-center gap-1 border-b border-ber-gray/20 overflow-x-auto">
        <Link
          href={`/obras/${obraId}/capa?from=gestao-360`}
          className="shrink-0 px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5 text-ber-gray hover:text-ber-carbon"
        >
          <FileSignature size={14} /> Capa
        </Link>
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === t.key ? 'border-b-2 border-ber-olive text-ber-carbon' : 'text-ber-gray hover:text-ber-carbon'}`}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ─── TAB: Visão Geral ───────────────────────────────────────────── */}
      {tab === 'visao' && (
        <div className="space-y-5">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="% Concluído" big={`${obra.progressPercent ?? 0}%`} sub="progresso físico" />
            <KpiCard label="Prazo" big={prazo ? `${prazo.remaining} dias` : '—'} sub={prazo ? `${prazo.pctElapsed.toFixed(0)}% decorrido` : ''} accent={prazo && prazo.remaining < 0 ? 'red' : prazo && prazo.remaining < 30 ? 'amber' : undefined} />
            <KpiCard label="Valor contrato" big={obra.valorContrato ? fmtBRLcompact(Number(obra.valorContrato)) : '—'} sub="base do projeto" />
            <KpiCard label="Saving consolidado" big={compras ? fmtBRLcompact(compras.okSaving) : '—'} sub={compras ? `${compras.okSavingPct.toFixed(1)}%` : ''} accent={compras && compras.okSaving >= 0 ? 'green' : 'red'} />
            <KpiCard label="Aditivos líquidos" big={fmtBRLcompact(aditivosLiq)} sub={`${aditivos?.aditivos.length ?? 0} aditivos`} accent={aditivosLiq >= 0 ? 'green' : 'red'} />
            <KpiCard label="Pendências abertas" big={String(pendAbertas)} sub={`${pendencias.length} totais`} accent={pendAbertas > 5 ? 'red' : pendAbertas > 0 ? 'amber' : 'green'} />
          </div>

          {/* Info da obra + alertas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Section title="Informações da obra" linkTo={null} className="lg:col-span-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <EditableInfoRow label="Cliente"          type="text"   displayValue={obra.client}                editValue={obra.client ?? ''}                 onSave={v => saveObraField('client', v)} />
                <EditableInfoRow label="Endereço"         type="text"   displayValue={obra.address}               editValue={obra.address ?? ''}                onSave={v => saveObraField('address', v)} />
                <EditableInfoRow label="Arquitetura"      type="text"   displayValue={obra.arquiteturaEscritorio} editValue={obra.arquiteturaEscritorio ?? ''}  onSave={v => saveObraField('arquiteturaEscritorio', v)} />
                <EditableInfoRow label="Gerenciadora"     type="text"   displayValue={obra.gerenciadora}          editValue={obra.gerenciadora ?? ''}           onSave={v => saveObraField('gerenciadora', v)} />
                <EditableInfoRow label="Área projeto"     type="number" displayValue={obra.areaM2 ? `${obra.areaM2} m²` : null} editValue={obra.areaM2 ? String(obra.areaM2) : ''} onSave={v => saveObraField('areaM2', v)} />
                <EditableInfoRow label="Status"           type="select" displayValue={obra.status}                editValue={obra.status}
                  options={[
                    { value: 'planejamento', label: 'Planejamento' },
                    { value: 'em_andamento', label: 'Em andamento' },
                    { value: 'pausada',      label: 'Pausada' },
                    { value: 'concluida',    label: 'Concluída' },
                    { value: 'cancelada',    label: 'Cancelada' },
                  ]}
                  onSave={v => saveObraField('status', v)} />
                <EditableInfoRow label="Início"           type="date"   displayValue={fmtDateFull(obra.startDate)}         editValue={obra.startDate ? obra.startDate.slice(0, 10) : ''}         onSave={v => saveObraField('startDate', v)} />
                <EditableInfoRow label="Previsão entrega" type="date"   displayValue={fmtDateFull(obra.expectedEndDate)}   editValue={obra.expectedEndDate ? obra.expectedEndDate.slice(0, 10) : ''} onSave={v => saveObraField('expectedEndDate', v)} />
              </div>
            </Section>
            <Section title="Alertas" linkTo={null}>
              <ul className="space-y-2 text-sm">
                {atrasados > 0 && <Alert color="red" icon={AlertTriangle} text={`${atrasados} pacote${atrasados > 1 ? 's' : ''} de contratação atrasado${atrasados > 1 ? 's' : ''}`} link={`/obras/${obraId}/cronograma-contratacoes`} />}
                {pendAbertas > 5 && <Alert color="amber" icon={AlertCircle} text={`${pendAbertas} pendências abertas`} link={`/obras/${obraId}/punch-lists`} />}
                {prazo && prazo.remaining < 0 && <Alert color="red" icon={Clock} text={`Obra ${Math.abs(prazo.remaining)} dias atrasada da previsão`} link={null} />}
                {(docsEmAnalise) > 0 && <Alert color="amber" icon={FileText} text={`${docsEmAnalise} documentos aguardando análise`} link={`/obras/${obraId}/documentos`} />}
                {aditivos?.totals.byStatus['em_analise'] && Number(aditivos.totals.byStatus['em_analise']) > 0 && <Alert color="amber" icon={FileSignature} text={`${fmtBRLcompact(Number(aditivos.totals.byStatus['em_analise']))} em aditivos pendentes`} link={`/obras/${obraId}/aditivos`} />}
                {atrasados === 0 && pendAbertas <= 5 && (!prazo || prazo.remaining >= 0) && docsEmAnalise === 0 && (
                  <li className="flex items-center gap-2 text-green-700"><CheckCircle2 size={14} /> Nenhum alerta crítico</li>
                )}
              </ul>
            </Section>
          </div>

          <Section title="Equipe da obra" linkTo={`/obras/${obraId}/stakeholders?from=gestao-360`}>
            <p className="text-xs text-ber-gray mb-2">{stakeholdersCount} stakeholders cadastrados</p>
            <div className="flex flex-wrap gap-2">
              {stakeholders.slice(0, 12).map(s => (
                <div key={s.id} className="text-xs bg-ber-bg/40 rounded border border-ber-gray/15 px-2 py-1">
                  <strong>{s.nome}</strong> <span className="text-ber-gray">· {s.empresa}{s.funcao ? ` · ${s.funcao}` : ''}</span>
                </div>
              ))}
              {stakeholdersCount === 0 && <p className="text-xs text-ber-gray italic">Cadastre stakeholders pra preencher</p>}
            </div>
          </Section>
        </div>
      )}

      {/* ─── TAB: Equipe (Stakeholders) ─────────────────────────────────── */}
      {tab === 'equipe' && (
        <Section
          title={`Stakeholders (${stakeholders.length})`}
          linkTo={`/obras/${obraId}/stakeholders?from=gestao-360`}
          onAdd={() => setEditingStakeholder(true)}
          addLabel="Novo contato"
        >
          {stakeholders.length === 0 ? (
            <EmptyMsg msg="Nenhum stakeholder cadastrado — clica em 'Novo contato' pra começar." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stakeholders.map(s => (
                <div key={s.id} className="group relative border-l-2 border-ber-teal/40 pl-3 pr-8 py-1 rounded-r hover:bg-ber-bg/40">
                  <p className="font-medium text-ber-carbon text-sm">{s.nome}</p>
                  <p className="text-xs text-ber-gray">{s.empresa}{s.cargo ? ` · ${s.cargo}` : ''}{s.funcao ? ` · ${s.funcao}` : ''}</p>
                  {(s.email || s.telefone) && (
                    <p className="text-[11px] text-ber-gray/80 mt-0.5">
                      {s.email && <span>{s.email}</span>}
                      {s.email && s.telefone && <span> · </span>}
                      {s.telefone && <span>{s.telefone}</span>}
                    </p>
                  )}
                  <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingStakeholder(s)}
                      title="Editar"
                      className="rounded p-1 text-ber-gray hover:bg-white hover:text-ber-carbon"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Remover ${s.nome}?`)) return;
                        try {
                          await api.delete(`/stakeholders/${s.id}`);
                          fetchAll();
                        } catch (err) {
                          const m = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
                          alert(typeof m === 'string' ? m : m?.message || 'Erro ao excluir');
                        }
                      }}
                      title="Excluir"
                      className="rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ─── TAB: Matriz RACI ───────────────────────────────────────────── */}
      {tab === 'raci' && (
        <Section
          title={`Matriz RACI (${raci.length} atividades)`}
          linkTo={`/obras/${obraId}/raci?from=gestao-360`}
        >
          {raci.length === 0 ? (
            <div className="space-y-3">
              <EmptyMsg msg="Nenhuma atividade RACI cadastrada." />
              <button
                onClick={async () => {
                  try {
                    const r = await api.post<{ data: { created: number; skipped: number } }>(`/obras/${obraId}/raci/apply-template`);
                    const { created } = r.data.data;
                    fetchAll();
                    if (created === 0) alert('Template já estava aplicado.');
                  } catch (err) {
                    const m = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
                    alert(typeof m === 'string' ? m : m?.message || 'Erro ao aplicar template');
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-ber-carbon px-3 py-1.5 text-xs font-semibold text-white hover:bg-ber-black"
              >
                Aplicar template padrão
              </button>
            </div>
          ) : (
            <>
              <ul className="space-y-1.5 text-sm">
                {raci.map(r => {
                  const distrib = Object.values(r.papeis);
                  const Rs = distrib.filter(x => x === 'R').length;
                  const As = distrib.filter(x => x === 'A').length;
                  const Cs = distrib.filter(x => x === 'C').length;
                  const Is = distrib.filter(x => x === 'I').length;
                  return (
                    <li key={r.id} className="group relative flex items-center justify-between gap-3 border-b border-ber-gray/10 pb-1.5 pr-8">
                      <span className="text-ber-carbon">{r.atividade}</span>
                      <span className="text-xs text-ber-gray shrink-0 tabular-nums">
                        {Rs}<span className="text-blue-600 font-semibold">R</span> · {As}<span className="text-green-600 font-semibold">A</span> · {Cs}<span className="text-amber-600 font-semibold">C</span> · {Is}<span className="text-gray-500 font-semibold">I</span>
                      </span>
                      <button
                        onClick={async () => {
                          if (!confirm(`Remover "${r.atividade}" da matriz RACI?`)) return;
                          try {
                            await api.delete(`/raci/${r.id}`);
                            fetchAll();
                          } catch (err) {
                            const m = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
                            alert(typeof m === 'string' ? m : m?.message || 'Erro ao excluir');
                          }
                        }}
                        title="Excluir atividade"
                        className="absolute top-0 right-0 rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[11px] text-ber-gray/70">Pra atribuir R/A/C/I aos stakeholders, abra a matriz completa em "Ir pro módulo".</p>
            </>
          )}
          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={async e => {
              e.preventDefault();
              if (!novaRaciAtividade.trim() || savingRaci) return;
              setSavingRaci(true);
              try {
                await api.post(`/obras/${obraId}/raci`, { atividade: novaRaciAtividade.trim(), ordem: raci.length });
                setNovaRaciAtividade('');
                fetchAll();
              } catch (err) {
                const m = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
                alert(typeof m === 'string' ? m : m?.message || 'Erro ao adicionar');
              } finally {
                setSavingRaci(false);
              }
            }}
          >
            <input
              value={novaRaciAtividade}
              onChange={e => setNovaRaciAtividade(e.target.value)}
              placeholder="Nova atividade…"
              className="flex-1 rounded-md border border-ber-gray/30 px-3 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none"
            />
            <button
              type="submit"
              disabled={!novaRaciAtividade.trim() || savingRaci}
              className="inline-flex items-center gap-1 rounded-md bg-ber-carbon px-3 py-1.5 text-xs font-semibold text-white hover:bg-ber-black disabled:opacity-50"
            >
              {savingRaci ? 'Adicionando…' : '+ Adicionar'}
            </button>
          </form>
        </Section>
      )}

      {/* ─── TAB: Compras & Contratos ───────────────────────────────────── */}
      {tab === 'compras' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Saving consolidado (Compras)" linkTo={`/obras/${obraId}/compras?from=gestao-360`}>
              {compras ? (
                <div className="space-y-2 text-sm">
                  <KpiRow label="Saving / Vendido" value={fmtBRL(compras.okSaving)} sub={`${compras.okSavingPct.toFixed(1)}%`} positive={compras.okSaving >= 0} />
                  <KpiRow label="Saving / Meta" value={fmtBRL(compras.okSavingMeta)} positive={compras.okSavingMeta >= 0} />
                  <KpiRow label="Projeção saving final" value={compras.projecaoSaving != null ? fmtBRL(compras.projecaoSaving) : '—'} />
                  <KpiRow label="Itens comprados" value={`${compras.itensComprados} (${compras.itensPendentes} pendentes)`} />
                </div>
              ) : <EmptyMsg msg="Sem dados de compras consolidados" />}
            </Section>

            <Section title="Cronograma de Contratações" linkTo={`/obras/${obraId}/cronograma-contratacoes?from=gestao-360`}>
              {planos.length === 0 ? <EmptyMsg msg="Sem pacotes no cronograma" /> : (
                <ul className="space-y-1.5 text-sm">
                  {planos.slice(0, 8).map(p => {
                    const meta = STATUS_PLANO[p.statusEfetivo] || STATUS_PLANO.a_contratar;
                    return (
                      <li key={p.id} className="flex items-center justify-between gap-3">
                        <span className="text-ber-carbon truncate">{p.pacote}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-ber-gray">{fmtDate(p.dataLimite)}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                        </span>
                      </li>
                    );
                  })}
                  {planos.length > 8 && <li className="text-xs text-ber-gray italic">+ {planos.length - 8} pacotes</li>}
                </ul>
              )}
            </Section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section
              title={`Contratos (${contratos?.contratacoes.length ?? 0})`}
              linkTo={`/obras/${obraId}/contratacoes?from=gestao-360`}
              onAdd={() => setEditingContratacao(true)}
              addLabel="Nova contratação"
            >
              {!contratos || contratos.contratacoes.length === 0 ? <EmptyMsg msg="Nenhuma contratação — clica em 'Nova contratação'." /> : (
                <>
                  <p className="text-xs text-ber-gray mb-2">Total contratado: <strong className="text-ber-carbon">{fmtBRL(contratos.totals.total)}</strong></p>
                  <ul className="space-y-1.5 text-sm">
                    {contratos.contratacoes.slice(0, 6).map(c => (
                      <li key={c.id} className="group relative flex items-center justify-between gap-3 pr-14 py-0.5 rounded hover:bg-ber-bg/40">
                        <span className="text-ber-carbon truncate">{c.fornecedor}{c.disciplina ? ` · ${c.disciplina}` : ''}</span>
                        <span className="text-xs tabular-nums text-ber-gray">{fmtBRLcompact(Number(c.valor))}</span>
                        <div className="absolute top-0.5 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingContratacao(c as unknown as ContratacaoFull)}
                            title="Editar"
                            className="rounded p-1 text-ber-gray hover:bg-white hover:text-ber-carbon"
                          ><Pencil size={12} /></button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Excluir contratação de ${c.fornecedor}? OCs vinculadas mantêm registro.`)) return;
                              try { await api.delete(`/contratacoes/${c.id}`); fetchAll(); }
                              catch (err) { const m = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error; alert(typeof m === 'string' ? m : m?.message || 'Erro ao excluir'); }
                            }}
                            title="Excluir"
                            className="rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600"
                          ><X size={12} /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Section>

            <Section
              title={`Ordens de Compra (${ocs?.ocs.length ?? 0})`}
              linkTo={`/obras/${obraId}/contratacoes?from=gestao-360`}
              onAdd={() => setEditingOc(true)}
              addLabel="Nova OC"
            >
              {!ocs || ocs.ocs.length === 0 ? <EmptyMsg msg="Nenhuma OC — clica em 'Nova OC'." /> : (
                <>
                  <p className="text-xs text-ber-gray mb-2">Total em OCs: <strong className="text-ber-carbon">{fmtBRL(ocs.totals.total)}</strong></p>
                  <ul className="space-y-1.5 text-sm">
                    {ocs.ocs.slice(0, 6).map(o => (
                      <li key={o.id} className="group relative flex items-center justify-between gap-3 pr-14 py-0.5 rounded hover:bg-ber-bg/40">
                        <span className="text-ber-carbon truncate"><strong>{o.numero}</strong> · {o.fornecedor}</span>
                        <span className="text-xs tabular-nums text-ber-gray">{fmtBRLcompact(Number(o.valor))}</span>
                        <div className="absolute top-0.5 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingOc(o as unknown as OcFull)}
                            title="Editar"
                            className="rounded p-1 text-ber-gray hover:bg-white hover:text-ber-carbon"
                          ><Pencil size={12} /></button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Excluir OC ${o.numero}?`)) return;
                              try { await api.delete(`/ordens-compra/${o.id}`); fetchAll(); }
                              catch (err) { const m = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error; alert(typeof m === 'string' ? m : m?.message || 'Erro ao excluir'); }
                            }}
                            title="Excluir"
                            className="rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600"
                          ><X size={12} /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Section>
          </div>
        </div>
      )}

      {/* ─── TAB: Reuniões & Decisões ───────────────────────────────────── */}
      {tab === 'reunioes' && (
        <div className="space-y-4">
          <Section
            title="Kick-Off"
            linkTo={`/obras/${obraId}/kickoff?from=gestao-360`}
            onAdd={() => setShowKickoff(true)}
            addLabel={kickoff?.dataRealizada ? 'Editar' : 'Registrar'}
          >
            {!kickoff || (!kickoff.dataRealizada && (!kickoff.participantes || kickoff.participantes.length === 0)) ? (
              <EmptyMsg msg="Kick-Off ainda não registrado — clica em 'Registrar' pra preencher." />
            ) : (
              <div className="text-sm space-y-1">
                <p className="text-ber-carbon"><strong>Realizado em:</strong> {fmtDateFull(kickoff.dataRealizada)}</p>
                <p className="text-xs text-ber-gray">{kickoff.participantes?.length || 0} participantes</p>
                {kickoff.decisoes && <p className="text-xs text-ber-carbon mt-2 italic line-clamp-3">"{kickoff.decisoes}"</p>}
              </div>
            )}
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section
              title={`Ata Corrida (${ata?.topicos.length ?? 0} tópicos)`}
              linkTo={`/obras/${obraId}/atas?from=gestao-360`}
            >
              {!ata || (ata.topicos.length === 0 && ata.reunioes.length === 0) ? (
                <EmptyMsg msg="Nenhum tópico cadastrado — abra a Ata Corrida para começar." />
              ) : (() => {
                const atrasados = ata.topicos.filter(t => t.status === 'atrasado').length;
                const emAnd = ata.topicos.filter(t => t.status === 'em_andamento').length;
                const concl = ata.topicos.filter(t => t.status === 'concluido').length;
                const ultima = ata.reunioes.length > 0 ? ata.reunioes[ata.reunioes.length - 1].data : null;
                return (
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded bg-red-50 px-2 py-1.5 text-center">
                        <p className="text-lg font-bold text-red-700">{atrasados}</p>
                        <p className="text-[10px] uppercase tracking-wide text-red-600">Atrasados</p>
                      </div>
                      <div className="rounded bg-blue-50 px-2 py-1.5 text-center">
                        <p className="text-lg font-bold text-blue-700">{emAnd}</p>
                        <p className="text-[10px] uppercase tracking-wide text-blue-600">Em andamento</p>
                      </div>
                      <div className="rounded bg-green-50 px-2 py-1.5 text-center">
                        <p className="text-lg font-bold text-green-700">{concl}</p>
                        <p className="text-[10px] uppercase tracking-wide text-green-600">Concluídos</p>
                      </div>
                    </div>
                    <p className="text-xs text-ber-gray">
                      {ata.reunioes.length} reunião(ões) · última: <strong>{fmtDate(ultima)}</strong>
                    </p>
                  </div>
                );
              })()}
            </Section>

            <Section title={`Pendências abertas (${pendAbertas})`} linkTo={`/obras/${obraId}/punch-lists?from=gestao-360`}>
              {pendAbertas === 0 ? <EmptyMsg msg="Sem pendências abertas 🎉" /> : (
                <ul className="space-y-1.5 text-sm">
                  {pendencias.filter(p => p.status === 'aberto' || p.status === 'em_andamento').slice(0, 8).map(p => (
                    <li key={p.id} className="flex items-start gap-2">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${p.status === 'aberto' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-ber-carbon truncate">{p.descricao}</p>
                        <p className="text-[11px] text-ber-gray">
                          {p.responsible?.name && `${p.responsible.name} · `}
                          {p.prazo && `prazo ${fmtDate(p.prazo)} · `}
                          <span className="capitalize">{p.origem}</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      )}

      {/* ─── TAB: Aditivos & Mudanças ───────────────────────────────────── */}
      {tab === 'aditivos' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Total líquido" big={fmtBRLcompact(aditivosLiq)} accent={aditivosLiq >= 0 ? 'green' : 'red'} />
            {Object.entries(STATUS_ADIT).map(([k, m]) => (
              <KpiCard key={k} label={m.label} big={fmtBRLcompact(Number(aditivos?.totals.byStatus[k] ?? 0))} sub="" />
            ))}
          </div>

          <Section
            title={`Aditivos (${aditivos?.aditivos.length ?? 0})`}
            linkTo={`/obras/${obraId}/aditivos?from=gestao-360`}
            onAdd={() => setShowNewAditivo(true)}
            addLabel="Novo aditivo"
          >
            {!aditivos || aditivos.aditivos.length === 0 ? <EmptyMsg msg="Nenhum aditivo cadastrado — clica em 'Novo aditivo'." /> : (
              <ul className="space-y-1.5 text-sm">
                {aditivos.aditivos.slice(0, 10).map(a => {
                  const valor = Number(a.valor) * (a.tipo === 'debito' ? -1 : 1);
                  const meta = STATUS_ADIT[a.status as keyof typeof STATUS_ADIT];
                  return (
                    <li key={a.id} className="group relative flex items-center justify-between gap-3 pr-8 py-0.5 rounded hover:bg-ber-bg/40">
                      <span className="text-ber-carbon flex-1 truncate"><strong>{a.numero}</strong> · {a.descricao}</span>
                      <span className={`text-xs tabular-nums shrink-0 font-semibold ${valor >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtBRL(valor)}</span>
                      {meta && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${meta.color}`}>{meta.label}</span>}
                      <button
                        onClick={async () => {
                          if (!confirm(`Excluir aditivo ${a.numero}?`)) return;
                          try {
                            await api.delete(`/aditivos/${a.id}`);
                            fetchAll();
                          } catch (err) {
                            const m = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
                            alert(typeof m === 'string' ? m : m?.message || 'Erro ao excluir');
                          }
                        }}
                        title="Excluir"
                        className="absolute top-0.5 right-1 rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      )}

      {/* ─── TAB: Cronograma & Mão de Obra ──────────────────────────────── */}
      {tab === 'cronograma' && (
        <div className="space-y-4">
          <Section title="Curva S — % planejado vs real" linkTo={null}>
            <CurvaSResumo cronograma={cronograma} onRefresh={fetchAll} />
          </Section>

          <Section title="Cronograma completo" linkTo={null}>
            <CronogramaPanel obraId={obraId} />
          </Section>

          <Section title="Histograma de Mão de Obra" linkTo={`/obras/${obraId}/histograma?from=gestao-360`}>
            {histograma.length === 0 ? <EmptyMsg msg="Nenhum dado de mão de obra cadastrado" /> : (
              <HistogramaResumo cells={histograma} />
            )}
          </Section>
        </div>
      )}

      {/* ─── TAB: Medições & Documentos ─────────────────────────────────── */}
      {tab === 'medicoes' && (
        <div className="space-y-4">
          <Section title={`Documentos (${documentos?.documentos.length ?? 0})`} linkTo={`/obras/${obraId}/documentos?from=gestao-360`}>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <MiniKpi label="Aprovados" value={docsAprovados} color="bg-green-100 text-green-700" />
              <MiniKpi label="Em análise" value={docsEmAnalise} color="bg-amber-100 text-amber-700" />
              <MiniKpi label="Reprovados" value={documentos?.totals.byStatus['reprovado'] ?? 0} color="bg-red-100 text-red-700" />
              <MiniKpi label="Pendentes" value={documentos?.totals.byStatus['pendente'] ?? 0} color="bg-gray-200 text-gray-700" />
            </div>
            {!documentos || documentos.documentos.length === 0 ? <EmptyMsg msg="Nenhum documento cadastrado" /> : (
              <ul className="space-y-1.5 text-sm">
                {documentos.documentos.slice(0, 8).map(d => (
                  <li key={d.id} className="flex items-center justify-between gap-3">
                    <span className="text-ber-carbon truncate">{d.nome}</span>
                    <span className="text-xs text-ber-gray shrink-0 capitalize">{d.tipo} · {d.status.replace('_', ' ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      {/* ─── Modal: Stakeholder (criar/editar) ──────────────────────────── */}
      {editingStakeholder !== null && (
        <StakeholderFormModal
          obraId={obraId}
          edit={editingStakeholder === true ? null : editingStakeholder}
          onClose={() => setEditingStakeholder(null)}
          onSaved={() => { setEditingStakeholder(null); fetchAll(); }}
        />
      )}

      {/* ─── Modal: Aditivo (novo) ──────────────────────────────────────── */}
      {showNewAditivo && (
        <AditivoFormModal
          obraId={obraId}
          onClose={() => setShowNewAditivo(false)}
          onCreated={() => { setShowNewAditivo(false); fetchAll(); }}
        />
      )}

      {/* ─── Modal: Contratação (criar/editar) ──────────────────────────── */}
      {editingContratacao !== null && (
        <ContratacaoFormModal
          obraId={obraId}
          edit={editingContratacao === true ? null : editingContratacao}
          onClose={() => setEditingContratacao(null)}
          onSaved={() => { setEditingContratacao(null); fetchAll(); }}
        />
      )}

      {/* ─── Modal: Ordem de Compra (criar/editar) ──────────────────────── */}
      {editingOc !== null && (
        <OcFormModal
          obraId={obraId}
          contratacoes={(contratos?.contratacoes ?? []) as unknown as ContratacaoFull[]}
          edit={editingOc === true ? null : editingOc}
          onClose={() => setEditingOc(null)}
          onSaved={() => { setEditingOc(null); fetchAll(); }}
        />
      )}

      {/* ─── Modal: Kick-Off (editar) ───────────────────────────────────── */}
      {showKickoff && (
        <KickoffFormModal
          obraId={obraId}
          initial={kickoff as unknown as KickoffFull | null}
          onClose={() => setShowKickoff(false)}
          onSaved={() => { setShowKickoff(false); fetchAll(); }}
        />
      )}
    </div>
  );
}

// ─── Status maps (cached locally) ──────────────────────────────────────────
const STATUS_PLANO: Record<string, { label: string; color: string }> = {
  a_contratar: { label: 'A contratar',  color: 'bg-gray-200 text-gray-700' },
  em_cotacao:  { label: 'Em cotação',   color: 'bg-amber-100 text-amber-700' },
  contratado:  { label: 'Contratado',   color: 'bg-green-100 text-green-700' },
  atrasado:    { label: 'Atrasado',     color: 'bg-red-100 text-red-700' },
};
const STATUS_ADIT: Record<string, { label: string; color: string }> = {
  em_analise:  { label: 'Em análise',  color: 'bg-amber-100 text-amber-700' },
  aprovado:    { label: 'Aprovado',    color: 'bg-green-100 text-green-700' },
  rejeitado:   { label: 'Rejeitado',   color: 'bg-red-100 text-red-700' },
  em_execucao: { label: 'Em execução', color: 'bg-blue-100 text-blue-700' },
  concluido:   { label: 'Concluído',   color: 'bg-gray-200 text-gray-700' },
};

// ─── Reusable bits ─────────────────────────────────────────────────────────
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
function Section({ title, linkTo, onAdd, addLabel, children, className }: { title: string; linkTo: string | null; onAdd?: () => void; addLabel?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-white border border-ber-gray/15 p-5 shadow-sm ${className || ''}`}>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h2 className="text-sm font-bold text-ber-carbon">{title}</h2>
        <div className="flex items-center gap-3">
          {onAdd && (
            <button onClick={onAdd}
              className="inline-flex items-center gap-1 rounded-md bg-ber-carbon px-2.5 py-1 text-xs font-semibold text-white hover:bg-ber-black">
              <span className="text-sm leading-none">+</span> {addLabel ?? 'Adicionar'}
            </button>
          )}
          {linkTo && (
            <Link href={linkTo} className="text-xs text-ber-teal hover:underline inline-flex items-center gap-0.5">
              Ir pro módulo <ArrowRight size={11} />
            </Link>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ber-gray font-medium">{label}</p>
      <p className="text-sm text-ber-carbon">{value || '—'}</p>
    </div>
  );
}

function EditableInfoRow({
  label, displayValue, editValue, type, options, onSave,
}: {
  label: string;
  displayValue: string | null;
  editValue: string;
  type: 'text' | 'date' | 'number' | 'select';
  options?: { value: string; label: string }[];
  onSave: (raw: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(editValue);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setVal(editValue); }, [editValue]);

  async function commit() {
    if (val === editValue) { setEditing(false); return; }
    setSaving(true); setErr(null);
    try {
      await onSave(val);
      setEditing(false);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
      setErr(typeof msg === 'string' ? msg : msg?.message || 'Erro ao salvar');
      setVal(editValue);
    } finally { setSaving(false); }
  }

  const inputCls = 'mt-0.5 block w-full rounded border border-ber-teal/40 bg-white px-2 py-1 text-sm text-ber-carbon focus:border-ber-teal focus:outline-none disabled:opacity-50';

  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ber-gray font-medium">{label}</p>
      {editing ? (
        type === 'select' ? (
          <select autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={commit}
            onKeyDown={e => { if (e.key === 'Escape') { setVal(editValue); setEditing(false); } }}
            disabled={saving} className={inputCls}>
            {options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input autoFocus
            type={type === 'date' ? 'date' : type === 'number' ? 'text' : 'text'}
            inputMode={type === 'number' ? 'decimal' : undefined}
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') { setVal(editValue); setEditing(false); }
            }}
            disabled={saving} className={inputCls} />
        )
      ) : (
        <button type="button" onClick={() => setEditing(true)}
          className="group/edit -mx-1 mt-0.5 flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-sm text-ber-carbon transition-colors hover:bg-ber-bg/60">
          <span className={displayValue ? '' : 'text-ber-gray italic'}>{displayValue || 'clique para preencher'}</span>
          <Pencil size={11} className="opacity-0 group-hover/edit:opacity-50 transition-opacity shrink-0" />
        </button>
      )}
      {err && <p className="mt-0.5 text-[10px] text-red-600">{err}</p>}
    </div>
  );
}
function EmptyMsg({ msg }: { msg: string }) {
  return <p className="text-xs text-ber-gray italic">{msg}</p>;
}
function Alert({ color, icon: Icon, text, link }: { color: 'red' | 'amber'; icon: typeof AlertTriangle; text: string; link: string | null }) {
  const cls = color === 'red' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200';
  return (
    <li className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs ${cls}`}>
      <Icon size={13} className="shrink-0 mt-0.5" />
      <span className="flex-1">{text}</span>
      {link && <Link href={link} className="font-medium hover:underline shrink-0">→</Link>}
    </li>
  );
}
function KpiRow({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-ber-gray uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${positive === undefined ? 'text-ber-carbon' : positive ? 'text-green-700' : 'text-red-600'}`}>
        {value}{sub && <span className="ml-1 text-xs opacity-70">({sub})</span>}
      </span>
    </div>
  );
}
function MiniKpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-md px-2 py-1.5 text-center ${color}`}>
      <p className="text-[9px] uppercase tracking-wide font-medium">{label}</p>
      <p className="text-base font-bold">{value}</p>
    </div>
  );
}

function HistogramaResumo({ cells }: { cells: HistogramaCell[] }) {
  // group by ano-mes, sum hh_plan and hh_real
  const map = new Map<string, { ano: number; mes: number; plan: number; real: number }>();
  cells.forEach(c => {
    const key = `${c.ano}-${String(c.mes).padStart(2, '0')}`;
    const cur = map.get(key) || { ano: c.ano, mes: c.mes, plan: 0, real: 0 };
    cur.plan += c.hhPlan;
    cur.real += c.hhReal;
    map.set(key, cur);
  });
  const data = Array.from(map.values()).sort((a, b) => a.ano - b.ano || a.mes - b.mes);
  const max = Math.max(...data.flatMap(d => [d.plan, d.real]), 1);
  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return (
    <div>
      <div className="flex items-end gap-0.5 h-32 mb-2">
        {data.map(d => (
          <div key={`${d.ano}-${d.mes}`} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div className="w-full flex items-end gap-px h-full">
              <div className="flex-1 bg-ber-teal/40" style={{ height: `${(d.plan / max) * 100}%` }} />
              <div className="flex-1 bg-ber-carbon" style={{ height: `${(d.real / max) * 100}%` }} />
            </div>
            <span className="text-[9px] text-ber-gray">{MESES[d.mes - 1]}</span>
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 hidden group-hover:block bg-ber-carbon text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10">
              {MESES[d.mes - 1]}/{d.ano} · Plan {d.plan} · Real {d.real}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 text-[11px] text-ber-gray">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-ber-teal/40 inline-block" /> Planejado</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-ber-carbon inline-block" /> Realizado</span>
      </div>
    </div>
  );
}

function CurvaSResumo({ cronograma, onRefresh }: { cronograma: { progressPct?: number | null; parsedData: { tarefas?: { i?: string | null; inicio?: string | null; f?: string | null; fim?: string | null; d?: number | null; duracaoDias?: number | null; p?: number; percentualConcluido?: number; r?: boolean; ehResumo?: boolean }[] } | null } | null; onRefresh?: () => void | Promise<void> }) {
  const tarefas = cronograma?.parsedData?.tarefas ?? [];
  if (tarefas.length === 0) {
    return <p className="text-xs text-ber-gray italic">Cronograma ainda não cadastrado. Acesse o módulo cronograma da obra pra subir a planilha.</p>;
  }

  // Mesma fórmula da Curva S "oficial" (web/.../obras/[id]/page.tsx — generateCurvaS):
  // - planejado = % linear do tempo decorrido dentro do span da tarefa-raiz
  // - realizado = currentPct na semana atual; escalonamento proporcional nas semanas passadas
  const tFim = (t: typeof tarefas[number]) => t.f ?? t.fim ?? null;
  const tIni = (t: typeof tarefas[number]) => t.i ?? t.inicio ?? null;
  const tDur = (t: typeof tarefas[number]) => t.d ?? t.duracaoDias ?? 0;
  const tPct = (t: typeof tarefas[number]) => t.p ?? t.percentualConcluido ?? 0;
  const isResumo = (t: typeof tarefas[number]) => !!(t.r ?? t.ehResumo);

  const folhas = tarefas.filter(t => !isResumo(t) && tDur(t) > 0 && tIni(t) && tFim(t));
  if (folhas.length === 0) {
    return <p className="text-xs text-ber-gray italic">Cronograma sem tarefas com duração e datas.</p>;
  }
  const totalDias = folhas.reduce((s, t) => s + tDur(t), 0);

  // Span do projeto = min(inicio) e max(fim) entre TODAS as tarefas com data.
  // Não confiamos em achar "a tarefa-raiz" porque alguns parsers não marcam
  // a linha 0 como ehResumo, ou marcam resumos de sub-pacotes que terminam
  // antes do projeto real (causaria curva truncada).
  const comDatas = tarefas.filter(t => tIni(t) && tFim(t));
  const raizIni = comDatas.reduce((min, t) => {
    const i = tIni(t)!; return !min || i < min ? i : min;
  }, '' as string);
  const raizFim = comDatas.reduce((max, t) => {
    const f = tFim(t)!; return !max || f > max ? f : max;
  }, '' as string);

  if (!raizIni || !raizFim) {
    return <p className="text-xs text-ber-gray italic">Cronograma sem datas válidas.</p>;
  }
  const raizStartMs = new Date(raizIni + 'T00:00:00').getTime();
  const raizEndMs   = new Date(raizFim + 'T00:00:00').getTime();
  if (raizEndMs <= raizStartMs || isNaN(raizEndMs - raizStartMs)) {
    return <p className="text-xs text-ber-gray italic">Datas do projeto inválidas.</p>;
  }

  // Pré-computa inicio/fim em ms pra cada folha (perf)
  const folhasMs = folhas.map(t => ({
    iniMs: new Date(tIni(t)! + 'T00:00:00').getTime(),
    fimMs: new Date(tFim(t)! + 'T00:00:00').getTime(),
    dur:   tDur(t),
    pct:   tPct(t),
  }));

  // % planejado de uma folha numa data — igual à coluna "% Planejado" do MS Project:
  // - 100% se a folha já terminou
  // - 0% se ainda não começou
  // - progresso linear dentro do span da folha
  const leafPlanAt = (ms: number, iniMs: number, fimMs: number) => {
    if (ms >= fimMs) return 1;
    if (ms <= iniMs) return 0;
    return (ms - iniMs) / (fimMs - iniMs);
  };

  // planejado agregado num timestamp = média ponderada por duração das folhas
  const planAt = (ms: number) => {
    const acc = folhasMs.reduce((s, f) => s + f.dur * leafPlanAt(ms, f.iniMs, f.fimMs), 0);
    return acc / totalDias * 100;
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  // currentPct = % concluído ponderado por duração (= "% concluído" do cabeçalho do cronograma)
  const currentPct = cronograma?.progressPct ?? Math.round(
    folhas.reduce((s, t) => s + tDur(t) * tPct(t) / 100, 0) / totalDias * 100,
  );
  const planTodayPct = planAt(todayMs);

  // Semanas: snap ao primeiro dia útil (segunda) antes/igual ao raizIni
  const firstDay = new Date(raizIni + 'T00:00:00');
  const dow = firstDay.getDay();
  firstDay.setDate(firstDay.getDate() - (dow === 0 ? 6 : dow - 1));
  const loopEnd = new Date(raizFim + 'T00:00:00');

  const data: { key: string; label: string; planejado: number; real: number | null }[] = [];
  const weekStart = new Date(firstDay);
  while (weekStart <= loopEnd) {
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6); weekEnd.setHours(23, 59, 59);
    const planejado = Math.round(planAt(weekEnd.getTime()) * 10) / 10;
    let real: number | null;
    const isCurrentWeek = weekStart <= today && today <= weekEnd;
    const isPast = weekEnd.getTime() < todayMs;
    if (isCurrentWeek) real = currentPct;
    else if (isPast && planTodayPct > 0) real = Math.round(planejado * currentPct / planTodayPct * 10) / 10;
    else real = null;
    const k = weekStart.toISOString().slice(0, 10);
    const [, m, day] = k.split('-');
    data.push({ key: k, label: `${day}/${m}`, planejado, real });
    weekStart.setDate(weekStart.getDate() + 7);
  }

  // Dimensões: 50px por semana com piso de 600px
  const h = 200;
  const pad = { l: 36, r: 10, t: 10, b: 30 };
  const xStepPx = 50;
  const innerW = Math.max(560, (data.length - 1) * xStepPx);
  const w = innerW + pad.l + pad.r;
  const y = (v: number) => h - pad.b - (v / 100) * (h - pad.t - pad.b);
  const xAt = (i: number) => pad.l + i * xStepPx;

  const planPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${y(d.planejado)}`).join(' ');
  // Real path só até onde tem valor (semana atual e passadas)
  const realPts = data.map((d, i) => ({ ...d, i })).filter(d => d.real !== null);
  const realPath = realPts.map((d, k) => `${k === 0 ? 'M' : 'L'} ${xAt(d.i)} ${y(d.real as number)}`).join(' ');

  return <CurvaSResumoSVG
    data={data} w={w} h={h} pad={pad} xStepPx={xStepPx}
    xAt={xAt} y={y} planPath={planPath} realPath={realPath} realPts={realPts}
    folhasCount={folhas.length} onRefresh={onRefresh}
  />;
}

function CurvaSResumoSVG({
  data, w, h, pad, xStepPx, xAt, y, planPath, realPath, realPts, folhasCount, onRefresh,
}: {
  data: { key: string; label: string; planejado: number; real: number | null }[];
  w: number; h: number; pad: { l: number; r: number; t: number; b: number };
  xStepPx: number;
  xAt: (i: number) => number;
  y: (v: number) => number;
  planPath: string; realPath: string;
  realPts: { i: number; real: number | null; label: string }[];
  folhasCount: number;
  onRefresh?: () => void | Promise<void>;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const h2 = data[hover ?? -1];

  async function handleRefresh() {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }

  return (
    <div>
      <div className="relative overflow-x-auto">
        <svg width={w} height={h} className="block">
          {[0, 25, 50, 75, 100].map(v => (
            <g key={v}>
              <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="#EEE" strokeDasharray="2 2" />
              <text x={pad.l - 4} y={y(v)} fontSize={10} textAnchor="end" fill="#999" dy={3}>{v}%</text>
            </g>
          ))}
          {data.map((d, i) => (
            <text key={`lbl-${i}`} x={xAt(i)} y={h - 10} fontSize={9} textAnchor="middle" fill="#666"
              transform={`rotate(-45 ${xAt(i)} ${h - 10})`}>
              {d.label}
            </text>
          ))}
          <path d={planPath} fill="none" stroke="#3B82F6" strokeWidth={2} />
          {realPath && <path d={realPath} fill="none" stroke="#10B981" strokeWidth={2} />}
          {realPts.map(d => (
            <circle key={`r-${d.i}`} cx={xAt(d.i)} cy={y(d.real as number)} r={3} fill="#10B981" />
          ))}
          {/* Linha vertical destacando semana sob hover */}
          {hover !== null && (
            <line x1={xAt(hover)} x2={xAt(hover)} y1={pad.t} y2={h - pad.b}
              stroke="#9CA3AF" strokeDasharray="3 3" strokeWidth={1} />
          )}
          {/* Camadas invisíveis pra captar hover por semana */}
          {data.map((_, i) => (
            <rect key={`hv-${i}`}
              x={xAt(i) - xStepPx / 2} y={pad.t}
              width={xStepPx} height={h - pad.t - pad.b}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)} />
          ))}
        </svg>
        {/* Tooltip */}
        {hover !== null && h2 && (
          <div className="pointer-events-none absolute z-10 rounded-md border border-ber-gray/20 bg-white px-3 py-2 text-[11px] shadow-md"
            style={{
              left: Math.min(w - 180, Math.max(0, xAt(hover) + 10)),
              top: 8,
              minWidth: 140,
            }}>
            <div className="font-semibold text-ber-carbon mb-1">Semana {h2.label}</div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-ber-gray">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#3B82F6' }} /> Planejado
              </span>
              <span className="font-mono font-semibold text-blue-700">{h2.planejado.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between gap-3 mt-0.5">
              <span className="flex items-center gap-1.5 text-ber-gray">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#10B981' }} /> Real
              </span>
              <span className="font-mono font-semibold text-green-700">
                {h2.real !== null ? `${h2.real.toFixed(1)}%` : '—'}
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 text-[11px] text-ber-gray mt-1">
        <span className="flex items-center gap-1"><span className="w-3 h-3 inline-block rounded-full" style={{ background: '#3B82F6' }} /> Planejado</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 inline-block rounded-full" style={{ background: '#10B981' }} /> Real</span>
        {onRefresh && (
          <button onClick={handleRefresh} disabled={refreshing}
            className="ml-2 flex items-center gap-1 rounded border border-ber-gray/30 px-2 py-0.5 text-[10px] font-medium text-ber-carbon hover:bg-ber-bg disabled:opacity-50">
            <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Atualizando…' : 'Atualizar'}
          </button>
        )}
        <span className="ml-auto">{folhasCount} tarefas · {data.length} semanas</span>
      </div>
    </div>
  );
}
