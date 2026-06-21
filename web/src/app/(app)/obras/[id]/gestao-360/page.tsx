'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, LayoutDashboard, Users, ShoppingCart, FileSearch, FileText, Activity,
  TrendingUp, TrendingDown, AlertTriangle, ArrowRight, CalendarClock, FileSignature,
  ShoppingBag, AlertCircle, Rocket, Network, CheckCircle2, Clock, Pencil,
} from 'lucide-react';
import api from '@/lib/api';

type TabKey = 'visao' | 'equipe' | 'compras' | 'reunioes' | 'aditivos' | 'medicoes';

const TABS: { key: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'visao',     label: 'Visão Geral',         icon: LayoutDashboard },
  { key: 'equipe',    label: 'Equipe & Stakeholders', icon: Users },
  { key: 'compras',   label: 'Compras & Contratos', icon: ShoppingCart },
  { key: 'reunioes',  label: 'Reuniões & Decisões', icon: FileSearch },
  { key: 'aditivos',  label: 'Aditivos & Mudanças', icon: FileText },
  { key: 'medicoes',  label: 'Medições & Documentos', icon: Activity },
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
interface Ata { id: string; tipo: 'interna' | 'externa'; numero: string; data: string; pauta: string; pendencias: { status: string }[] }
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
  const [compras, setCompras] = useState<ComprasSummary | null>(null);
  const [aditivos, setAditivos] = useState<AditivosResp | null>(null);
  const [contratos, setContratos] = useState<ContratacoesResp | null>(null);
  const [ocs, setOcs] = useState<OcsResp | null>(null);
  const [planos, setPlanos] = useState<PlanoLite[]>([]);
  const [atas, setAtas] = useState<Ata[]>([]);
  const [kickoff, setKickoff] = useState<Kickoff | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [raci, setRaci] = useState<RaciItem[]>([]);
  const [documentos, setDocumentos] = useState<DocumentosResp | null>(null);
  const [histograma, setHistograma] = useState<HistogramaCell[]>([]);
  const [pendencias, setPendencias] = useState<PunchListItemLite[]>([]);
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
        atasRes,
        kickoffRes,
        stakeRes,
        raciRes,
        docsRes,
        histRes,
        punchRes,
      ] = await Promise.all([
        safeGet<ObraInfo>(`/obras/${obraId}`),
        safeGet<{ totais: ComprasSummary }>(`/compras-dashboard/summary`).then(r => r ? r.totais ?? null : null).catch(() => null) as Promise<ComprasSummary | null>,
        safeGet<AditivosResp>(`/obras/${obraId}/aditivos`),
        safeGet<ContratacoesResp>(`/obras/${obraId}/contratacoes`),
        safeGet<OcsResp>(`/obras/${obraId}/ordens-compra`),
        safeGet<PlanoLite[]>(`/obras/${obraId}/contratacao-plano`),
        safeGet<Ata[]>(`/obras/${obraId}/atas`),
        safeGet<Kickoff>(`/obras/${obraId}/kickoff`),
        safeGet<Stakeholder[]>(`/obras/${obraId}/stakeholders`),
        safeGet<RaciItem[]>(`/obras/${obraId}/raci`),
        safeGet<DocumentosResp>(`/obras/${obraId}/documentos`),
        safeGet<HistogramaCell[]>(`/obras/${obraId}/histograma`),
        safeGet<{ id: string; type: string; items: PunchListItemLite[] }[]>(`/obras/${obraId}/punch-lists`),
      ]);

      setObra(obraRes);
      setCompras(comprasRes ?? null);
      setAditivos(aditivosRes ?? null);
      setContratos(contratosRes ?? null);
      setOcs(ocsRes ?? null);
      setPlanos(planosRes ?? []);
      setAtas(atasRes ?? []);
      setKickoff(kickoffRes ?? null);
      setStakeholders(stakeRes ?? []);
      setRaci(raciRes ?? []);
      setDocumentos(docsRes ?? null);
      setHistograma(histRes ?? []);

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
        <button onClick={fetchAll} className="text-xs text-ber-gray hover:text-ber-carbon">⟳ Atualizar</button>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex items-center gap-1 border-b border-ber-gray/20 overflow-x-auto">
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

          <Section title="Equipe da obra" linkTo={`/obras/${obraId}/stakeholders`}>
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

      {/* ─── TAB: Equipe & Stakeholders ─────────────────────────────────── */}
      {tab === 'equipe' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Stakeholders" linkTo={`/obras/${obraId}/stakeholders`}>
            {stakeholders.length === 0 ? (
              <EmptyMsg msg="Nenhum stakeholder cadastrado" />
            ) : (
              <ul className="space-y-2 text-sm">
                {stakeholders.slice(0, 10).map(s => (
                  <li key={s.id} className="border-l-2 border-ber-teal/40 pl-3">
                    <p className="font-medium text-ber-carbon">{s.nome}</p>
                    <p className="text-xs text-ber-gray">{s.empresa}{s.cargo ? ` · ${s.cargo}` : ''}{s.funcao ? ` · ${s.funcao}` : ''}</p>
                  </li>
                ))}
                {stakeholders.length > 10 && <li className="text-xs text-ber-gray italic">+ {stakeholders.length - 10} mais</li>}
              </ul>
            )}
          </Section>

          <Section title="Matriz RACI" linkTo={`/obras/${obraId}/raci`}>
            {raci.length === 0 ? (
              <EmptyMsg msg="Nenhuma atividade RACI cadastrada" />
            ) : (
              <ul className="space-y-1.5 text-sm">
                {raci.slice(0, 8).map(r => {
                  const distrib = Object.values(r.papeis);
                  const Rs = distrib.filter(x => x === 'R').length;
                  const As = distrib.filter(x => x === 'A').length;
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-ber-carbon truncate">{r.atividade}</span>
                      <span className="text-ber-gray shrink-0">{Rs}R · {As}A · {distrib.length} pessoas</span>
                    </li>
                  );
                })}
                {raci.length > 8 && <li className="text-xs text-ber-gray italic">+ {raci.length - 8} atividades</li>}
              </ul>
            )}
          </Section>
        </div>
      )}

      {/* ─── TAB: Compras & Contratos ───────────────────────────────────── */}
      {tab === 'compras' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title="Saving consolidado (Compras)" linkTo={`/obras/${obraId}/compras`}>
              {compras ? (
                <div className="space-y-2 text-sm">
                  <KpiRow label="Saving / Vendido" value={fmtBRL(compras.okSaving)} sub={`${compras.okSavingPct.toFixed(1)}%`} positive={compras.okSaving >= 0} />
                  <KpiRow label="Saving / Meta" value={fmtBRL(compras.okSavingMeta)} positive={compras.okSavingMeta >= 0} />
                  <KpiRow label="Projeção saving final" value={compras.projecaoSaving != null ? fmtBRL(compras.projecaoSaving) : '—'} />
                  <KpiRow label="Itens comprados" value={`${compras.itensComprados} (${compras.itensPendentes} pendentes)`} />
                </div>
              ) : <EmptyMsg msg="Sem dados de compras consolidados" />}
            </Section>

            <Section title="Cronograma de Contratações" linkTo={`/obras/${obraId}/cronograma-contratacoes`}>
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
            <Section title={`Contratos (${contratos?.contratacoes.length ?? 0})`} linkTo={`/obras/${obraId}/contratacoes`}>
              {!contratos || contratos.contratacoes.length === 0 ? <EmptyMsg msg="Nenhuma contratação" /> : (
                <>
                  <p className="text-xs text-ber-gray mb-2">Total contratado: <strong className="text-ber-carbon">{fmtBRL(contratos.totals.total)}</strong></p>
                  <ul className="space-y-1.5 text-sm">
                    {contratos.contratacoes.slice(0, 6).map(c => (
                      <li key={c.id} className="flex items-center justify-between gap-3">
                        <span className="text-ber-carbon truncate">{c.fornecedor}{c.disciplina ? ` · ${c.disciplina}` : ''}</span>
                        <span className="text-xs tabular-nums text-ber-gray">{fmtBRLcompact(Number(c.valor))}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Section>

            <Section title={`Ordens de Compra (${ocs?.ocs.length ?? 0})`} linkTo={`/obras/${obraId}/contratacoes`}>
              {!ocs || ocs.ocs.length === 0 ? <EmptyMsg msg="Nenhuma OC" /> : (
                <>
                  <p className="text-xs text-ber-gray mb-2">Total em OCs: <strong className="text-ber-carbon">{fmtBRL(ocs.totals.total)}</strong></p>
                  <ul className="space-y-1.5 text-sm">
                    {ocs.ocs.slice(0, 6).map(o => (
                      <li key={o.id} className="flex items-center justify-between gap-3">
                        <span className="text-ber-carbon truncate"><strong>{o.numero}</strong> · {o.fornecedor}</span>
                        <span className="text-xs tabular-nums text-ber-gray">{fmtBRLcompact(Number(o.valor))}</span>
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
          <Section title="Kick-Off" linkTo={`/obras/${obraId}/kickoff`}>
            {!kickoff || (!kickoff.dataRealizada && (!kickoff.participantes || kickoff.participantes.length === 0)) ? (
              <EmptyMsg msg="Kick-Off ainda não registrado" />
            ) : (
              <div className="text-sm space-y-1">
                <p className="text-ber-carbon"><strong>Realizado em:</strong> {fmtDateFull(kickoff.dataRealizada)}</p>
                <p className="text-xs text-ber-gray">{kickoff.participantes?.length || 0} participantes</p>
                {kickoff.decisoes && <p className="text-xs text-ber-carbon mt-2 italic line-clamp-3">"{kickoff.decisoes}"</p>}
              </div>
            )}
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Section title={`Atas (${atas.length})`} linkTo={`/obras/${obraId}/atas`}>
              {atas.length === 0 ? <EmptyMsg msg="Nenhuma ata cadastrada" /> : (
                <ul className="space-y-1.5 text-sm">
                  {atas.slice(0, 6).map(a => {
                    const abertas = a.pendencias.filter(p => p.status === 'aberto' || p.status === 'em_andamento').length;
                    return (
                      <li key={a.id} className="border-l-2 border-ber-teal/40 pl-3 py-0.5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-ber-carbon truncate"><strong>{a.numero}</strong> ({a.tipo}) · {fmtDate(a.data)}</p>
                          {abertas > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full shrink-0">{abertas} pend.</span>}
                        </div>
                        <p className="text-xs text-ber-gray truncate">{a.pauta}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title={`Pendências abertas (${pendAbertas})`} linkTo={`/obras/${obraId}/punch-lists`}>
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

          <Section title={`Aditivos (${aditivos?.aditivos.length ?? 0})`} linkTo={`/obras/${obraId}/aditivos`}>
            {!aditivos || aditivos.aditivos.length === 0 ? <EmptyMsg msg="Nenhum aditivo cadastrado" /> : (
              <ul className="space-y-1.5 text-sm">
                {aditivos.aditivos.slice(0, 10).map(a => {
                  const valor = Number(a.valor) * (a.tipo === 'debito' ? -1 : 1);
                  const meta = STATUS_ADIT[a.status as keyof typeof STATUS_ADIT];
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-3">
                      <span className="text-ber-carbon flex-1 truncate"><strong>{a.numero}</strong> · {a.descricao}</span>
                      <span className={`text-xs tabular-nums shrink-0 font-semibold ${valor >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtBRL(valor)}</span>
                      {meta && <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${meta.color}`}>{meta.label}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      )}

      {/* ─── TAB: Medições & Documentos ─────────────────────────────────── */}
      {tab === 'medicoes' && (
        <div className="space-y-4">
          <Section title="Histograma (resumo)" linkTo={`/obras/${obraId}/histograma`}>
            {histograma.length === 0 ? <EmptyMsg msg="Nenhum dado de mão de obra cadastrado" /> : (
              <HistogramaResumo cells={histograma} />
            )}
          </Section>

          <Section title={`Documentos (${documentos?.documentos.length ?? 0})`} linkTo={`/obras/${obraId}/documentos`}>
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
function Section({ title, linkTo, children, className }: { title: string; linkTo: string | null; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-white border border-ber-gray/15 p-5 shadow-sm ${className || ''}`}>
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
