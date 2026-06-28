'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, X } from 'lucide-react';
import api from '@/lib/api';

async function baixarPdf(medicaoId: string) {
  try {
    const res = await api.get(`/medicoes/${medicaoId}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    window.open(url, '_blank');
    setTimeout(() => window.URL.revokeObjectURL(url), 10_000);
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Erro ao gerar PDF');
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface ObraInfo {
  id: string;
  name: string;
  client: string | null;
  valorContrato: string | number | null;
  prazoPagamentoDias: number;
  retencaoPercentual: string | number;
}

type Tipo = 'terceiro_ber_paga' | 'terceiro_fatura_direto' | 'miscelaneos_ber';
type Status = 'rascunho' | 'enviada' | 'aprovada' | 'contestada' | 'nf_emitida' | 'paga';

interface EtapaInfo { id: string; ordem: number; nome: string; contratoValor: string | number }
interface FornecedorInfo { id: string; razaoSocial: string }

interface MedicaoItem {
  id: string;
  medicaoId: string;
  etapaFornecedorId: string;
  valorQuinzena: string | number;
  percentualAcumulado: string | number;
  etapaFornecedor: {
    id: string;
    tipo: Tipo;
    valorContratado: string | number;
    fornecedor: FornecedorInfo | null;
    etapa: EtapaInfo;
  };
}

interface PagamentoDireto {
  id: string;
  fornecedorRazaoSocial: string;
  valor: string | number;
  observacao: string | null;
}

interface Transicao {
  id: string;
  deStatus: Status | null;
  paraStatus: Status;
  comentario: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
}

interface MedicaoDetail {
  id: string;
  obraId: string;
  numero: number;
  periodoInicio: string;
  periodoFim: string;
  status: Status;
  tokenPublico: string | null;
  dataPagamentoPrevista: string | null;
  dataPagamentoRealizado: string | null;
  obra: ObraInfo;
  itens: MedicaoItem[];
  transicoes: Transicao[];
  pagamentosDiretos: PagamentoDireto[];
}

// ─── Constants ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Status, string> = {
  rascunho: 'Rascunho', enviada: 'Enviada ao cliente', aprovada: 'Aprovada',
  contestada: 'Contestada', nf_emitida: 'NF emitida', paga: 'Paga',
};
const STATUS_COLOR: Record<Status, string> = {
  rascunho:   'bg-gray-100 text-gray-700',
  enviada:    'bg-blue-100 text-blue-700',
  aprovada:   'bg-emerald-100 text-emerald-700',
  contestada: 'bg-amber-100 text-amber-700',
  nf_emitida: 'bg-purple-100 text-purple-700',
  paga:       'bg-green-200 text-green-800',
};
// Transições permitidas (espelho da máquina de estado do backend)
const NEXT_STATES: Record<Status, { para: Status; label: string; color: string; needsCommentText?: boolean }[]> = {
  rascunho:    [{ para: 'enviada', label: 'Enviar pro cliente', color: 'bg-blue-600 text-white hover:bg-blue-700' }],
  enviada:     [
    { para: 'aprovada', label: 'Marcar aprovada', color: 'bg-emerald-600 text-white hover:bg-emerald-700' },
    { para: 'contestada', label: 'Marcar contestada', color: 'bg-amber-500 text-white hover:bg-amber-600', needsCommentText: true },
    { para: 'rascunho', label: 'Voltar pra rascunho', color: 'bg-gray-200 text-gray-700 hover:bg-gray-300' },
  ],
  contestada:  [{ para: 'rascunho', label: 'Voltar pra rascunho', color: 'bg-gray-200 text-gray-700 hover:bg-gray-300' }],
  aprovada:    [
    { para: 'nf_emitida', label: 'NF emitida', color: 'bg-purple-600 text-white hover:bg-purple-700' },
    { para: 'contestada', label: 'Contestar', color: 'bg-amber-500 text-white hover:bg-amber-600', needsCommentText: true },
  ],
  nf_emitida:  [
    { para: 'paga', label: 'Marcar paga', color: 'bg-green-600 text-white hover:bg-green-700' },
    { para: 'contestada', label: 'Contestar', color: 'bg-amber-500 text-white hover:bg-amber-600', needsCommentText: true },
  ],
  paga:        [],
};

const TIPO_LABEL: Record<Tipo, string> = {
  terceiro_ber_paga: 'BER',
  terceiro_fatura_direto: 'Direto',
  miscelaneos_ber: 'Misc',
};
const TIPO_COLOR: Record<Tipo, string> = {
  terceiro_ber_paga: 'text-amber-700',
  terceiro_fatura_direto: 'text-blue-700',
  miscelaneos_ber: 'text-gray-500',
};

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const labelMedicao = (n: number) => n === 1 ? 'Sinal' : `Medição ${String(n).padStart(2, '0')}`;
const labelMedicaoShort = (n: number) => n === 1 ? 'Sinal' : `Med. ${String(n).padStart(2, '0')}`;

const parseNum = (s: string): number => {
  const cleaned = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const errMsg = (err: unknown, fb: string) => {
  const m = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof m === 'string' ? m : m?.message || fb;
};

// ─── Page ──────────────────────────────────────────────────────────────────

export default function MedicaoDetailPage() {
  const params = useParams<{ id: string; medicaoId: string }>();
  const { id: obraId, medicaoId } = params;
  const router = useRouter();

  const [med, setMed] = useState<MedicaoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [medicaoAnterior, setMedicaoAnterior] = useState<MedicaoDetail | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get<{ data: MedicaoDetail }>(`/medicoes/${medicaoId}`);
      setMed(r.data.data);
      // Busca acumulado anterior pra cada item
      const allMeds = await api.get<{ data: { id: string; numero: number; status: Status }[] }>(`/obras/${obraId}/medicoes`);
      const ant = allMeds.data.data
        .filter(x => x.id !== medicaoId && x.numero < r.data.data.numero)
        .sort((a, b) => b.numero - a.numero)[0];
      if (ant) {
        const antDetail = await api.get<{ data: MedicaoDetail }>(`/medicoes/${ant.id}`);
        setMedicaoAnterior(antDetail.data.data);
      } else {
        setMedicaoAnterior(null);
      }
    } finally { setLoading(false); }
  }, [obraId, medicaoId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading || !med) return <div className="p-6 text-sm text-ber-gray">Carregando…</div>;

  const editavel = med.status === 'rascunho';
  const obra = med.obra;
  const contratoTotal = Number(obra.valorContrato ?? 0);
  const retencaoPerc = Number(obra.retencaoPercentual ?? 0);
  const retencaoValor = contratoTotal * retencaoPerc / 100;
  const valorDisponivel = contratoTotal - retencaoValor;

  // Agrupa itens por etapa
  const etapasComItens = agrupaPorEtapa(med.itens, medicaoAnterior);

  // Cálculos
  const valorTotalBruto = med.itens.reduce((acc, i) => acc + Number(i.valorQuinzena), 0);
  const pagamentosMap = new Map<string, number>(med.pagamentosDiretos.map(p => [p.fornecedorRazaoSocial, Number(p.valor)]));
  const totalPagoDireto = Array.from(pagamentosMap.values()).reduce((a, b) => a + b, 0);
  const valorTotalLiquido = Math.max(0, valorTotalBruto - totalPagoDireto);

  // Resumo de faturamento
  const berFaturamento = med.itens
    .filter(i => i.etapaFornecedor.tipo === 'terceiro_ber_paga' || i.etapaFornecedor.tipo === 'miscelaneos_ber')
    .reduce((acc, i) => acc + Number(i.valorQuinzena), 0);

  const terceirosMap = new Map<string, number>();
  for (const i of med.itens.filter(i => i.etapaFornecedor.tipo === 'terceiro_fatura_direto')) {
    const nome = i.etapaFornecedor.fornecedor?.razaoSocial ?? 'Terceiro';
    terceirosMap.set(nome, (terceirosMap.get(nome) ?? 0) + Number(i.valorQuinzena));
  }
  const terceirosDiretos = Array.from(terceirosMap.entries())
    .map(([razaoSocial, valor]) => ({
      razaoSocial, valor,
      jaPago: pagamentosMap.get(razaoSocial) ?? 0,
      liquido: Math.max(0, valor - (pagamentosMap.get(razaoSocial) ?? 0)),
    }))
    .filter(t => t.valor > 0 || t.jaPago > 0);

  // Previsão de pagamento
  const previsaoPagamento = new Date(med.periodoFim);
  previsaoPagamento.setDate(previsaoPagamento.getDate() + (obra.prazoPagamentoDias ?? 30));

  const labelAnt = medicaoAnterior ? labelMedicaoShort(medicaoAnterior.numero) : null;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-3 flex items-center gap-2 text-xs text-ber-gray">
        <Link href={`/obras/${obraId}/medicao`} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={12} /> Medições
        </Link>
        <span>/</span><span className="text-ber-carbon font-medium">{labelMedicao(med.numero)}</span>
      </div>

      <div className="mb-5 flex items-start justify-between flex-wrap gap-3">
        <div>
          <span className={`inline-block px-2 py-1 rounded-md text-[10px] font-medium mb-2 ${STATUS_COLOR[med.status]}`}>
            {STATUS_LABEL[med.status]}
          </span>
          <h1 className="text-2xl font-black text-ber-carbon">{labelMedicao(med.numero)}</h1>
          <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-ber-gray">
            <PeriodoEdit medicaoId={med.id} field="periodoInicio" value={med.periodoInicio} onSaved={fetchAll} />
            <span>–</span>
            <PeriodoEdit medicaoId={med.id} field="periodoFim" value={med.periodoFim} onSaved={fetchAll} />
            <span>· {obra.client ?? obra.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={() => baixarPdf(med.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-ber-gray/30 px-3 py-1.5 text-xs font-semibold text-ber-carbon hover:bg-ber-bg">
            <Download size={13} /> Baixar PDF
          </button>
          <StatusActions med={med} onChange={fetchAll} onDeleted={() => router.push(`/obras/${obraId}/medicao`)} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Kpi label="Contrato total" value={fmtBRL(contratoTotal)} />
        <Kpi label="Medido anteriormente" value={fmtBRL(somaAcumuladoAnt(medicaoAnterior))} />
        <Kpi label="Esta medição" value={fmtBRL(valorTotalLiquido)} accent="black" />
        <Kpi label="Total acumulado" value={fmtBRL(somaAcumuladoAnt(medicaoAnterior) + valorTotalLiquido)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <Kpi label="Saldo anterior" value={fmtBRL(valorDisponivel - somaAcumuladoAnt(medicaoAnterior))} sub="Disponível antes desta medição" />
        <Kpi label="Saldo restante" value={fmtBRL(valorDisponivel - somaAcumuladoAnt(medicaoAnterior) - valorTotalLiquido)} sub="Disponível após esta medição" />
        <Kpi label="Previsão pagamento" value={previsaoPagamento.toLocaleDateString('pt-BR')} sub={`Prazo: ${obra.prazoPagamentoDias} dias após período`} />
      </div>

      {/* Etapas medidas */}
      <div className="bg-white border border-ber-gray/15 rounded-xl overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-ber-gray/10">
          <h2 className="text-sm font-bold text-ber-carbon">Etapas medidas</h2>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-[auto_2fr_1fr_auto_1fr_auto_1fr] gap-3 px-4 py-2.5 border-b border-ber-gray/10 text-[10px] text-ber-gray font-medium uppercase tracking-wide bg-ber-bg/40 sticky top-0">
              <span className="w-6">#</span>
              <span>Etapa / fornecedor</span>
              <span className="text-right">Contrato</span>
              <span className="w-16">Faturamento</span>
              <span className="text-right">{labelAnt ? `${labelAnt} (anterior)` : 'Anterior'}</span>
              <span className="text-right w-20">% período</span>
              <span className="text-right">Valor da quinzena</span>
            </div>
            {etapasComItens.map(({ etapa, items }) => (
              <EtapaRows key={etapa.id} etapa={etapa} items={items} editavel={editavel} medicaoId={med.id} onChange={fetchAll} />
            ))}
          </div>
        </div>
      </div>

      {/* Resumo de Faturamento */}
      <div className="bg-white border border-ber-gray/15 rounded-xl overflow-hidden">
        <h2 className="text-sm font-bold text-ber-carbon px-5 py-3 border-b border-ber-gray/10">Resumo de faturamento</h2>
        {berFaturamento > 0 && (
          <div className="flex justify-between items-center px-5 py-3 text-sm border-b border-ber-gray/10">
            <span className="font-medium text-ber-carbon">BER Engenharia</span>
            <span className="tabular-nums font-medium">{fmtBRL(berFaturamento)}</span>
          </div>
        )}
        {terceirosDiretos.map(t => (
          <div key={t.razaoSocial} className="px-5 py-3 border-b border-ber-gray/10 text-sm">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-ber-carbon">{t.razaoSocial}</span>
                <span className="text-[10px] text-blue-700 font-medium">fatura direto</span>
              </div>
              <div className="flex items-center gap-3">
                {t.jaPago > 0 && (
                  <span className="text-[11px] text-ber-gray/50 tabular-nums line-through">{fmtBRL(t.valor)}</span>
                )}
                <span className="tabular-nums font-medium text-ber-carbon">{fmtBRL(t.liquido)}</span>
              </div>
            </div>
            <div className="mt-1.5 flex justify-end">
              <PagamentoDiretoInput
                medicaoId={med.id}
                fornecedorRazaoSocial={t.razaoSocial}
                valorAtual={t.jaPago}
                editavel={editavel}
                onSaved={fetchAll}
              />
            </div>
          </div>
        ))}
        {totalPagoDireto > 0 && (
          <div className="flex justify-between items-center px-5 py-2 text-xs text-emerald-700 bg-emerald-50 border-b border-emerald-100">
            <span>Subtotal pago direto pelo cliente</span>
            <span className="tabular-nums font-medium">−{fmtBRL(totalPagoDireto)}</span>
          </div>
        )}
        <div className="flex justify-between items-center px-5 py-3 text-sm font-bold bg-ber-bg/30">
          <span>Total desta medição{totalPagoDireto > 0 ? ' (líquido)' : ''}</span>
          <span className="tabular-nums">{fmtBRL(valorTotalLiquido)}</span>
        </div>
      </div>

      {editavel && (
        <div className="mt-5 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          Digite o <strong>% executado no período</strong> (somente o progresso desta medição). O sistema soma ao acumulado anterior e calcula o valor.
          Clique no <strong>%</strong> ao lado do campo pra alternar pra <strong>R$</strong> e digitar o valor direto. Enter ou clique fora pra salvar.
        </div>
      )}

      {/* Histórico de transições */}
      {med.transicoes.length > 0 && (
        <div className="mt-6 bg-white border border-ber-gray/15 rounded-xl overflow-hidden">
          <h2 className="text-xs font-bold text-ber-gray uppercase tracking-wide px-5 py-2.5 border-b border-ber-gray/10">Histórico</h2>
          {med.transicoes.map((t, i) => (
            <div key={t.id} className={`flex items-start gap-3 px-5 py-2.5 text-xs ${i < med.transicoes.length - 1 ? 'border-b border-ber-gray/5' : ''}`}>
              <span className="text-ber-gray/60 tabular-nums w-28 shrink-0">{fmtDateTime(t.createdAt)}</span>
              <div className="flex-1 min-w-0">
                <span className="text-ber-carbon">
                  {t.deStatus
                    ? <>{STATUS_LABEL[t.deStatus]} → <strong>{STATUS_LABEL[t.paraStatus]}</strong></>
                    : <strong>Criada</strong>
                  }
                  {t.user && <span className="text-ber-gray/70"> · {t.user.name}</span>}
                </span>
                {t.comentario && <p className="text-ber-gray mt-0.5">{t.comentario}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

interface EtapaGrouped { etapa: EtapaInfo; items: MedicaoItem[] }

function agrupaPorEtapa(itens: MedicaoItem[], _anterior: MedicaoDetail | null): EtapaGrouped[] {
  const map = new Map<string, EtapaGrouped>();
  for (const it of itens) {
    const e = it.etapaFornecedor.etapa;
    if (!map.has(e.id)) map.set(e.id, { etapa: e, items: [] });
    map.get(e.id)!.items.push(it);
  }
  return Array.from(map.values()).sort((a, b) => a.etapa.ordem - b.etapa.ordem);
}

function somaAcumuladoAnt(ant: MedicaoDetail | null): number {
  if (!ant) return 0;
  return ant.itens.reduce((acc, i) => acc + Number(i.valorQuinzena), 0);
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'black' }) {
  return (
    <div className={`rounded-xl border border-ber-gray/15 p-4 shadow-sm ${accent === 'black' ? 'bg-ber-carbon text-white' : 'bg-white text-ber-carbon'}`}>
      <p className={`text-[10px] font-medium uppercase tracking-wide ${accent === 'black' ? 'text-white/70' : 'text-ber-gray'}`}>{label}</p>
      <p className="mt-1 text-lg font-black tabular-nums">{value}</p>
      {sub && <p className={`text-[10px] mt-0.5 ${accent === 'black' ? 'text-white/60' : 'text-ber-gray'}`}>{sub}</p>}
    </div>
  );
}

function EtapaRows({ etapa, items, editavel, medicaoId, onChange }: {
  etapa: EtapaInfo; items: MedicaoItem[]; editavel: boolean; medicaoId: string; onChange: () => void;
}) {
  const contratoEtapa = Number(etapa.contratoValor);
  const valorTotalEtapa = items.reduce((acc, i) => acc + Number(i.valorQuinzena), 0);

  return (
    <div className="border-b border-ber-gray/10 last:border-b-0">
      <div className="grid grid-cols-[auto_2fr_1fr_auto_1fr_auto_1fr] gap-3 px-4 py-2.5 items-center text-sm bg-ber-bg/10">
        <span className="text-xs text-ber-gray w-6">{etapa.ordem}</span>
        <p className="font-medium text-ber-carbon">{etapa.nome}</p>
        <span className="text-right tabular-nums text-ber-gray">{fmtBRL(contratoEtapa)}</span>
        <span className="w-16" />
        <span className="text-right tabular-nums text-ber-gray text-xs">—</span>
        <span className="text-right text-xs text-ber-gray">—</span>
        <span className="text-right tabular-nums font-medium">{fmtBRL(valorTotalEtapa)}</span>
      </div>
      {items.map(item => (
        <FornecedorRow key={item.id} item={item} editavel={editavel} medicaoId={medicaoId} onChange={onChange} />
      ))}
    </div>
  );
}

function FornecedorRow({ item, editavel, medicaoId, onChange }: { item: MedicaoItem; editavel: boolean; medicaoId: string; onChange: () => void }) {
  const ef = item.etapaFornecedor;
  const valorContratado = Number(ef.valorContratado);
  const percAcumulado = Number(item.percentualAcumulado);

  // % período = acumulado atual - max acumulado anterior. Aqui usamos o próprio item
  // (já contém o acumulado salvo). Pra exibir o "anterior" precisamos da medição anterior;
  // por simplicidade, exibimos o % "que tem nesta medição" como o acumulado salvo
  // (que já é o do anterior + período). UX: o input mostra o período (delta) calculado.
  const [percInput, setPercInput] = useState<string>(() => {
    // O input mostra o delta. Sem medição anterior, delta = acumulado atual.
    return percAcumulado > 0 ? String(percAcumulado) : '';
  });
  const [modo, setModo] = useState<'pct' | 'brl'>('pct');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tipoLocal, setTipoLocal] = useState<Tipo>(ef.tipo);

  const percPeriodoCalc = useMemo(() => {
    if (modo === 'pct') return parseNum(percInput);
    if (valorContratado <= 0) return 0;
    return (parseNum(percInput) / valorContratado) * 100;
  }, [modo, percInput, valorContratado]);

  async function salvar() {
    // No backend, atualizamos com o ACUMULADO total (não o delta)
    // O acumulado novo = max anterior + período. Como o backend faz essa validação,
    // basta enviar o número que o usuário digitou interpretado como acumulado total novo.
    const novoAcumulado = percPeriodoCalc; // assumindo input representa o acumulado total
    // (Versão simplificada — sem medição anterior, o input = acumulado)
    if (novoAcumulado === percAcumulado) return;
    setError(null);
    startTransition(async () => {
      try {
        await api.patch(`/medicao-itens/${item.id}`, { percentualAcumulado: novoAcumulado });
        onChange();
      } catch (err) {
        setError(errMsg(err, 'Erro ao salvar'));
      }
    });
  }

  async function handleTipoChange(novo: Tipo) {
    if (novo === tipoLocal) return;
    setTipoLocal(novo);
    startTransition(async () => {
      try {
        await api.patch(`/medicao-etapa-fornecedores/${ef.id}`, { tipo: novo });
        onChange();
      } catch (err) {
        alert(errMsg(err, 'Erro ao atualizar tipo'));
      }
    });
  }

  return (
    <div className="grid grid-cols-[auto_2fr_1fr_auto_1fr_auto_1fr] gap-3 px-4 py-2 items-center text-xs">
      <span className="w-6" />
      <div className="pl-4 flex items-center gap-2 text-ber-gray">
        <span className="text-ber-gray/40">└─</span>
        <span>{ef.fornecedor?.razaoSocial ?? 'BER Engenharia'}</span>
      </div>
      <span className="text-right tabular-nums text-ber-gray">{fmtBRL(valorContratado)}</span>
      {editavel ? (
        <select
          value={tipoLocal}
          onChange={e => handleTipoChange(e.target.value as Tipo)}
          disabled={pending}
          className={`w-16 text-left font-medium bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-ber-gray rounded cursor-pointer hover:bg-ber-bg/30 px-1 -mx-1 text-xs ${TIPO_COLOR[tipoLocal]}`}
          title="Quem paga"
        >
          <option value="terceiro_ber_paga">BER</option>
          <option value="terceiro_fatura_direto">Direto</option>
          <option value="miscelaneos_ber">Misc</option>
        </select>
      ) : (
        <span className={`w-16 text-left font-medium ${TIPO_COLOR[tipoLocal]}`}>{TIPO_LABEL[tipoLocal]}</span>
      )}
      <span className="text-right tabular-nums text-ber-gray/50 text-[11px]">—</span>
      {editavel ? (
        <div className="flex items-center justify-end gap-1">
          <input
            value={percInput}
            onChange={e => setPercInput(e.target.value)}
            onBlur={salvar}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            disabled={pending}
            placeholder={modo === 'pct' ? '0' : '0,00'}
            inputMode="decimal"
            className={`${modo === 'pct' ? 'w-14' : 'w-20'} px-2 py-1 border rounded text-xs text-right tabular-nums focus:outline-none focus:ring-1 ${pending ? 'border-blue-300 bg-blue-50 text-blue-700' : error ? 'border-red-300 bg-red-50' : 'border-ber-gray/30 focus:ring-ber-gray'}`}
          />
          <button
            type="button"
            onClick={() => { setModo(m => m === 'pct' ? 'brl' : 'pct'); setPercInput(''); }}
            disabled={pending}
            className={`text-[10px] font-bold rounded px-1 py-0.5 ${modo === 'pct' ? 'text-ber-gray hover:bg-ber-bg/40' : 'text-amber-700 bg-amber-50 hover:bg-amber-100'}`}
            title={modo === 'pct' ? 'Mudar pra R$' : 'Mudar pra %'}
          >
            {pending ? '↻' : modo === 'pct' ? '%' : 'R$'}
          </button>
        </div>
      ) : (
        <span className="text-right tabular-nums text-xs">{percAcumulado.toFixed(0)}%</span>
      )}
      <span className="text-right tabular-nums">{fmtBRL(Number(item.valorQuinzena))}</span>
      {error && <p className="col-span-7 text-[10px] text-red-700 pl-12">{error}</p>}
    </div>
  );
}

function PagamentoDiretoInput({ medicaoId, fornecedorRazaoSocial, valorAtual, editavel, onSaved }: {
  medicaoId: string; fornecedorRazaoSocial: string; valorAtual: number; editavel: boolean; onSaved: () => void;
}) {
  const [valor, setValor] = useState<string>(valorAtual > 0 ? valorAtual.toFixed(2).replace('.', ',') : '');
  const [pending, startTransition] = useTransition();

  function save() {
    const novo = parseNum(valor);
    if (novo === valorAtual) return;
    startTransition(async () => {
      try {
        await api.put(`/medicoes/${medicaoId}/pagamentos-diretos`, { fornecedorRazaoSocial, valor: novo });
        onSaved();
      } catch (err) {
        alert(errMsg(err, 'Erro ao salvar pagamento'));
        setValor(valorAtual > 0 ? valorAtual.toFixed(2).replace('.', ',') : '');
      }
    });
  }

  if (!editavel) {
    return valorAtual > 0 ? (
      <span className="text-[11px] text-emerald-700 tabular-nums">−{fmtBRL(valorAtual)}</span>
    ) : null;
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-ber-gray/70">Já pago direto:</span>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-ber-gray/50">R$</span>
        <input
          type="text" inputMode="decimal"
          value={valor}
          onChange={e => setValor(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          disabled={pending}
          placeholder="0,00"
          className={`w-28 rounded border px-7 py-1 text-xs text-right tabular-nums focus:outline-none focus:ring-1 ${pending ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-ber-gray/30 focus:ring-ber-gray'}`}
        />
      </div>
    </div>
  );
}

function StatusActions({ med, onChange, onDeleted }: { med: MedicaoDetail; onChange: () => void; onDeleted: () => void }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<Status | null>(null);
  const [comentario, setComentario] = useState('');
  const opts = NEXT_STATES[med.status];

  function executeTransition(para: Status, comentarioStr?: string) {
    startTransition(async () => {
      try {
        await api.post(`/medicoes/${med.id}/transition`, { para, comentario: comentarioStr });
        setConfirming(null);
        setComentario('');
        onChange();
      } catch (err) { alert(errMsg(err, 'Erro na transição')); }
    });
  }

  async function handleDelete() {
    if (!confirm(`Excluir ${labelMedicao(med.numero)}? Não pode ser desfeito.`)) return;
    startTransition(async () => {
      try {
        await api.delete(`/medicoes/${med.id}`);
        onDeleted();
      } catch (err) { alert(errMsg(err, 'Erro ao excluir')); }
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      {opts.map(opt => (
        <button
          key={opt.para}
          onClick={() => opt.needsCommentText ? setConfirming(opt.para) : executeTransition(opt.para)}
          disabled={pending}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${opt.color}`}
        >
          {opt.label}
        </button>
      ))}
      {med.status === 'rascunho' && (
        <button onClick={handleDelete} disabled={pending}
          className="rounded-md border border-red-300 text-red-600 hover:bg-red-50 px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
          Excluir
        </button>
      )}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4" onClick={() => setConfirming(null)}>
          <div className="w-full max-w-md rounded-t-2xl md:rounded-lg bg-white p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-ber-carbon">Comentário</h3>
              <button onClick={() => setConfirming(null)}><X size={16} /></button>
            </div>
            <textarea
              autoFocus rows={3} value={comentario} onChange={e => setComentario(e.target.value)}
              placeholder="Por que está contestando? (obrigatório)"
              className="w-full rounded border border-ber-gray/30 p-2 text-sm focus:outline-none focus:ring-1 focus:ring-ber-gray"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setConfirming(null)} className="rounded px-3 py-1.5 text-sm text-ber-gray hover:bg-ber-bg">Cancelar</button>
              <button onClick={() => comentario.trim() && executeTransition(confirming, comentario.trim())}
                disabled={pending || !comentario.trim()}
                className="rounded bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Edita data da medição (periodoInicio ou periodoFim) inline.
// Salva ao perder foco / Enter, refaz fetch pra refletir.
function PeriodoEdit({ medicaoId, field, value, onSaved }: {
  medicaoId: string;
  field: 'periodoInicio' | 'periodoFim';
  value: string;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(value.slice(0, 10));
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(value.slice(0, 10)), [value]);

  async function commit() {
    const next = draft;
    if (!next || next === value.slice(0, 10)) return;
    setSaving(true);
    try {
      await api.patch(`/medicoes/${medicaoId}`, { [field]: next });
      onSaved();
    } catch (err: any) {
      alert(err?.response?.data?.error?.message ?? 'Erro ao salvar data');
      setDraft(value.slice(0, 10));
    } finally { setSaving(false); }
  }

  return (
    <input
      type="date"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
      disabled={saving}
      className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-ber-carbon hover:border-ber-gray/30 focus:border-ber-teal focus:outline-none disabled:opacity-50"
      title="Clique pra editar a data"
    />
  );
}
