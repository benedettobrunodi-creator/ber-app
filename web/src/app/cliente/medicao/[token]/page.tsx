'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import VisaoFinanceiraContrato, { type ConsolidadoData } from '@/components/medicao/VisaoFinanceiraContrato';

// Endpoint público — não usa o api client (que joga JWT). Faz fetch direto.
// NEXT_PUBLIC_API_URL já inclui /v1 (e às vezes \n no fim, sanitizar).
const API_BASE = (
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) || '/api/v1'
).trim().replace(/\\n$/, '').replace(/\/$/, '');

type Status = 'rascunho' | 'enviada' | 'aprovada' | 'contestada' | 'nf_emitida' | 'paga';
type Tipo = 'terceiro_ber_paga' | 'terceiro_fatura_direto' | 'miscelaneos_ber';

interface MedicaoPortal {
  id: string;
  numero: number;
  periodoInicio: string;
  periodoFim: string;
  status: Status;
  obra: { id: string; name: string; client: string | null; valorContrato: string | number | null; prazoPagamentoDias: number };
  itens: Array<{
    id: string;
    valorQuinzena: string | number;
    percentualAcumulado: string | number;
    etapaFornecedor: {
      id: string; tipo: Tipo; valorContratado: string | number;
      fornecedor: { id: string; razaoSocial: string } | null;
      etapa: { id: string; ordem: number; nome: string; contratoValor: string | number };
    };
  }>;
  pagamentosDiretos: Array<{ id: string; fornecedorRazaoSocial: string; valor: string | number }>;
  transicoes: Array<{ id: string; deStatus: Status | null; paraStatus: Status; comentario: string | null; createdAt: string }>;
}

const STATUS_LABEL: Record<Status, string> = {
  rascunho: 'Rascunho', enviada: 'Aguardando sua aprovação', aprovada: 'Aprovada',
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

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
const labelMedicao = (n: number) => n === 1 ? 'Sinal' : `Medição ${String(n).padStart(2, '0')}`;

export default function ClientePortalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [med, setMed] = useState<MedicaoPortal | null>(null);
  const [consolidado, setConsolidado] = useState<ConsolidadoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showContestar, setShowContestar] = useState(false);
  const [comentario, setComentario] = useState('');
  const [acaoPending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resMed, resCons] = await Promise.all([
        fetch(`${API_BASE}/cliente/medicao/${token}`, { headers: { Accept: 'application/json' }, cache: 'no-store' }),
        fetch(`${API_BASE}/cliente/medicao/${token}/consolidado`, { headers: { Accept: 'application/json' }, cache: 'no-store' }),
      ]);
      if (!resMed.ok) {
        const data = await resMed.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? 'Medição não encontrada');
      }
      const data = await resMed.json();
      setMed(data.data);
      if (resCons.ok) {
        const cdata = await resCons.json();
        setConsolidado(cdata.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar');
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function handleAprovar() {
    if (!confirm('Aprovar esta medição? A ação não pode ser desfeita.')) return;
    startTransition(async () => {
      try {
        const res = await fetch(`${API_BASE}/cliente/medicao/${token}/aprovar`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error('Falha ao aprovar');
        setMensagem({ tipo: 'sucesso', texto: 'Medição aprovada! Em breve a BÈR vai emitir a NF.' });
        load();
      } catch (err) {
        setMensagem({ tipo: 'erro', texto: err instanceof Error ? err.message : 'Erro ao aprovar' });
      }
    });
  }

  function handleContestar() {
    if (!comentario.trim()) return;
    startTransition(async () => {
      try {
        const res = await fetch(`${API_BASE}/cliente/medicao/${token}/contestar`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comentario: comentario.trim() }),
        });
        if (!res.ok) throw new Error('Falha ao contestar');
        setMensagem({ tipo: 'sucesso', texto: 'Contestação registrada. A BÈR vai revisar com você.' });
        setShowContestar(false);
        setComentario('');
        load();
      } catch (err) {
        setMensagem({ tipo: 'erro', texto: err instanceof Error ? err.message : 'Erro ao contestar' });
      }
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (error || !med) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h1 className="text-lg font-bold text-gray-900">Medição não encontrada</h1>
          <p className="mt-2 text-sm text-gray-600">{error ?? 'O link pode estar expirado ou inválido.'}</p>
        </div>
      </div>
    );
  }

  const obra = med.obra;
  const contratoTotal = Number(obra.valorContrato ?? 0);

  // Cálculos
  const valorBruto = med.itens.reduce((acc, i) => acc + Number(i.valorQuinzena), 0);
  const pagamentosMap = new Map(med.pagamentosDiretos.map(p => [p.fornecedorRazaoSocial, Number(p.valor)]));
  const totalPagoDireto = Array.from(pagamentosMap.values()).reduce((a, b) => a + b, 0);
  const valorLiquido = Math.max(0, valorBruto - totalPagoDireto);

  const berFat = med.itens
    .filter(i => i.etapaFornecedor.tipo === 'terceiro_ber_paga' || i.etapaFornecedor.tipo === 'miscelaneos_ber')
    .reduce((acc, i) => acc + Number(i.valorQuinzena), 0);

  const terceirosMap = new Map<string, number>();
  for (const i of med.itens.filter(i => i.etapaFornecedor.tipo === 'terceiro_fatura_direto')) {
    const nome = i.etapaFornecedor.fornecedor?.razaoSocial ?? 'Terceiro';
    terceirosMap.set(nome, (terceirosMap.get(nome) ?? 0) + Number(i.valorQuinzena));
  }
  const terceiros = Array.from(terceirosMap.entries())
    .map(([razaoSocial, valor]) => ({
      razaoSocial, valor,
      jaPago: pagamentosMap.get(razaoSocial) ?? 0,
      liquido: Math.max(0, valor - (pagamentosMap.get(razaoSocial) ?? 0)),
    }))
    .filter(t => t.valor > 0 || t.jaPago > 0);

  // Previsão pagamento
  const previsao = new Date(med.periodoFim);
  previsao.setDate(previsao.getDate() + obra.prazoPagamentoDias);

  // Etapas agrupadas
  const porEtapa = new Map<string, { etapa: typeof med.itens[number]['etapaFornecedor']['etapa']; items: typeof med.itens }>();
  for (const i of med.itens) {
    const e = i.etapaFornecedor.etapa;
    if (!porEtapa.has(e.id)) porEtapa.set(e.id, { etapa: e, items: [] });
    porEtapa.get(e.id)!.items.push(i);
  }
  const etapas = Array.from(porEtapa.values()).sort((a, b) => a.etapa.ordem - b.etapa.ordem);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">BÈR Engenharia · Medição contratual</p>
          <h1 className="text-xl font-bold text-gray-900">{obra.name}</h1>
          {obra.client && <p className="text-sm text-gray-600">{obra.client}</p>}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {mensagem && (
          <div className={`rounded-lg border p-4 text-sm ${mensagem.tipo === 'sucesso' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {mensagem.texto}
          </div>
        )}

        {consolidado && consolidado.empresas.length > 0 && (
          <VisaoFinanceiraContrato data={consolidado} />
        )}

        {/* Status + medição */}
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
            <div>
              <span className={`inline-block px-2 py-1 rounded text-[10px] font-medium mb-2 ${STATUS_COLOR[med.status]}`}>
                {STATUS_LABEL[med.status]}
              </span>
              <h2 className="text-lg font-bold text-gray-900">{labelMedicao(med.numero)}</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {fmtDate(med.periodoInicio)} – {fmtDate(med.periodoFim)} · Previsão de pagamento: {previsao.toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Valor desta medição</p>
              <p className="text-2xl font-black tabular-nums text-gray-900">{fmtBRL(valorLiquido)}</p>
              {totalPagoDireto > 0 && <p className="text-[11px] text-emerald-700">já descontados R$ pagos direto</p>}
            </div>
          </div>
          {contratoTotal > 0 && (
            <p className="text-xs text-gray-500">Contrato total: <strong className="text-gray-700">{fmtBRL(contratoTotal)}</strong></p>
          )}
        </div>

        {/* Detalhamento por etapa */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <h3 className="text-sm font-bold text-gray-900 px-5 py-3 border-b border-gray-100">Etapas medidas</h3>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-[auto_2fr_auto_auto_auto] gap-3 px-4 py-2 border-b border-gray-100 text-[10px] text-gray-500 font-medium uppercase tracking-wide bg-gray-50">
                <span className="w-6">#</span>
                <span>Etapa / fornecedor</span>
                <span className="text-right">Contrato</span>
                <span className="text-right w-16">% período</span>
                <span className="text-right">Valor</span>
              </div>
              {etapas.map(({ etapa, items }) => (
                <div key={etapa.id} className="border-b border-gray-100 last:border-b-0">
                  <div className="grid grid-cols-[auto_2fr_auto_auto_auto] gap-3 px-4 py-2 items-center text-sm bg-gray-50/50">
                    <span className="text-xs text-gray-500 w-6">{etapa.ordem}</span>
                    <p className="font-medium text-gray-900">{etapa.nome}</p>
                    <span className="text-right tabular-nums text-gray-600">{fmtBRL(Number(etapa.contratoValor))}</span>
                    <span className="text-right text-xs text-gray-500 w-16">—</span>
                    <span className="text-right tabular-nums font-medium">{fmtBRL(items.reduce((a, i) => a + Number(i.valorQuinzena), 0))}</span>
                  </div>
                  {items.map(it => (
                    <div key={it.id} className="grid grid-cols-[auto_2fr_auto_auto_auto] gap-3 px-4 py-1.5 items-center text-xs">
                      <span className="w-6" />
                      <div className="pl-4 flex items-center gap-2 text-gray-700">
                        <span className="text-gray-400">└─</span>
                        <span>{it.etapaFornecedor.fornecedor?.razaoSocial ?? 'BÈR Engenharia'}</span>
                      </div>
                      <span className="text-right tabular-nums text-gray-500">{fmtBRL(Number(it.etapaFornecedor.valorContratado))}</span>
                      <span className="text-right tabular-nums text-gray-700 w-16">{Number(it.percentualAcumulado).toFixed(0)}%</span>
                      <span className="text-right tabular-nums">{fmtBRL(Number(it.valorQuinzena))}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Resumo de faturamento */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <h3 className="text-sm font-bold text-gray-900 px-5 py-3 border-b border-gray-100">Resumo de faturamento</h3>
          {berFat > 0 && (
            <div className="flex justify-between items-center px-5 py-3 text-sm border-b border-gray-100">
              <span className="font-medium text-gray-900">BÈR Engenharia</span>
              <span className="tabular-nums font-medium">{fmtBRL(berFat)}</span>
            </div>
          )}
          {terceiros.map(t => (
            <div key={t.razaoSocial} className="px-5 py-3 border-b border-gray-100 text-sm">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-gray-700">{t.razaoSocial}</span>
                  <span className="text-[10px] text-blue-700 font-medium">fatura direto</span>
                </div>
                <div className="flex items-center gap-3">
                  {t.jaPago > 0 && (
                    <span className="text-[11px] text-gray-400 tabular-nums line-through">{fmtBRL(t.valor)}</span>
                  )}
                  <span className="tabular-nums font-medium">{fmtBRL(t.liquido)}</span>
                </div>
              </div>
              {t.jaPago > 0 && (
                <p className="mt-0.5 text-[11px] text-emerald-700 italic text-right">já pago direto pelo cliente: −{fmtBRL(t.jaPago)}</p>
              )}
            </div>
          ))}
          {totalPagoDireto > 0 && (
            <div className="flex justify-between items-center px-5 py-2 text-xs text-emerald-700 bg-emerald-50 border-b border-emerald-100">
              <span>Subtotal pago direto pelo cliente</span>
              <span className="tabular-nums font-medium">−{fmtBRL(totalPagoDireto)}</span>
            </div>
          )}
          <div className="flex justify-between items-center px-5 py-3 text-base font-bold bg-gray-50">
            <span>Total da medição{totalPagoDireto > 0 ? ' (líquido)' : ''}</span>
            <span className="tabular-nums">{fmtBRL(valorLiquido)}</span>
          </div>
        </div>

        {/* Ações */}
        {med.status === 'enviada' && (
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-sm text-gray-700 mb-3">Confere os valores e aprove ou conteste:</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={handleAprovar} disabled={acaoPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                <CheckCircle2 size={15} /> Aprovar medição
              </button>
              <button onClick={() => setShowContestar(true)} disabled={acaoPending}
                className="rounded-md border border-amber-500 px-4 py-2 text-sm font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50">
                Contestar
              </button>
            </div>
          </div>
        )}

        {med.status !== 'enviada' && med.status !== 'rascunho' && (
          <div className="bg-white border border-gray-200 rounded-lg p-5 text-sm text-gray-700">
            {med.status === 'aprovada' && '✅ Esta medição foi aprovada. A BÈR vai emitir a NF em breve.'}
            {med.status === 'contestada' && '⚠️ Você contestou esta medição. A BÈR vai revisar e voltar com você.'}
            {med.status === 'nf_emitida' && '🧾 NF emitida. Aguardando pagamento.'}
            {med.status === 'paga' && '🎉 Medição paga. Obrigado!'}
          </div>
        )}

        {/* Histórico curto */}
        {med.transicoes.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">Histórico</p>
            <ul className="space-y-1 text-xs text-gray-700">
              {med.transicoes.map(t => (
                <li key={t.id}>
                  <span className="text-gray-500">{new Date(t.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  {' — '}
                  {t.deStatus ? `${STATUS_LABEL[t.deStatus]} → ` : 'Criada → '}
                  <strong>{STATUS_LABEL[t.paraStatus]}</strong>
                  {t.comentario && <span className="text-gray-600"> · {t.comentario}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      {showContestar && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 px-4" onClick={() => setShowContestar(false)}>
          <div className="w-full max-w-md rounded-t-2xl md:rounded-lg bg-white p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 mb-2">Contestar medição</h3>
            <p className="text-xs text-gray-600 mb-3">Conta pra gente o que precisa ser revisto:</p>
            <textarea
              autoFocus rows={4} value={comentario} onChange={e => setComentario(e.target.value)}
              placeholder="Ex: O serviço da etapa 14 ainda não foi concluído..."
              className="w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setShowContestar(false)} className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button onClick={handleContestar} disabled={acaoPending || !comentario.trim()}
                className="rounded bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
                Enviar contestação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

