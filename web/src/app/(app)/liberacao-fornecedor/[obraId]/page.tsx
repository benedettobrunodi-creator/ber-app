'use client';

/**
 * Liberação de Fornecedor — página da obra (21/09/26, Bruno pediu "mais
 * robusto" do que o modal: "3. Página própria por obra"). Master-detail em
 * tela cheia: lista de fornecedores contratados à esquerda, formulário de
 * solicitação à direita.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Search, ChevronRight, Send } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/lib/toast';

interface Opcao {
  comprasMetaId: string;
  pacote: number | null;
  categoria: string;
  descritivo: string | null;
  fornecedor: string | null;
  comprado: number;
  jaAutorizado: number;
  saldo: number;
}

interface ItemFila {
  id: string;
  obraId: string;
  comprasMetaId: string;
  status: 'solicitada' | 'aprovada_financeiro' | 'autorizada' | 'recusada';
}

type Status = 'solicitada' | 'aprovada_financeiro' | 'autorizada' | 'recusada';

interface HistoricoItem {
  id: string;
  comprasMetaId: string;
  categoria: string;
  descritivo: string | null;
  fornecedor: string | null;
  comprado: number;
  percentual: number;
  valorAutorizado: number;
  status: Status;
  dataPagamento: string | null;
  observacoes: string | null;
  motivoRecusa: string | null;
  emailEnviadoEm: string | null;
  emailDestinatario: string | null;
  solicitadoPorNome: string | null;
  aprovadoFinanceiroNome: string | null;
  aprovadoDiretoriaNome: string | null;
  recusadoPorNome: string | null;
  createdAt: string;
  updatedAt: string;
}

const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR');
const fmtData = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
const errMsg = (e: unknown, fb: string) =>
  (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? fb;
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const PCT_RAPIDOS = [25, 50, 75, 100];
const PENDENTES = ['solicitada', 'aprovada_financeiro'];

const STATUS_LABEL: Record<Status, string> = {
  solicitada: 'Aguardando financeiro',
  aprovada_financeiro: 'Aguardando diretoria',
  autorizada: 'Autorizada',
  recusada: 'Recusada',
};
const STATUS_COR: Record<Status, string> = {
  solicitada: 'bg-amber-50 text-amber-800 border-amber-300',
  aprovada_financeiro: 'bg-blue-50 text-blue-800 border-blue-300',
  autorizada: 'bg-green-50 text-green-800 border-green-300',
  recusada: 'bg-red-50 text-red-700 border-red-300',
};

export default function LiberacaoFornecedorObraPage() {
  const router = useRouter();
  const params = useParams<{ obraId: string }>();
  const obraId = params.obraId;

  const [tab, setTab] = useState<'fornecedores' | 'historico'>('fornecedores');
  const [obraNome, setObraNome] = useState('');
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [comprasMetaComPendencia, setComprasMetaComPendencia] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [busca, setBusca] = useState('');
  const [buscaHistorico, setBuscaHistorico] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(false);
    try {
      const [o, opts, fila, hist] = await Promise.all([
        api.get<{ data: { name: string } }>(`/obras/${obraId}`),
        api.get<{ data: Opcao[] }>(`/obras/${obraId}/liberacao-fornecedor/opcoes`),
        api.get<{ data: ItemFila[] }>('/liberacao-fornecedor'),
        api.get<{ data: HistoricoItem[] }>(`/obras/${obraId}/liberacao-fornecedor/historico`),
      ]);
      setObraNome(o.data.data.name);
      setOpcoes(opts.data.data);
      setHistorico(hist.data.data);
      const pend = new Set<string>();
      for (const it of fila.data.data) {
        if (it.obraId === obraId && PENDENTES.includes(it.status)) pend.add(it.comprasMetaId);
      }
      setComprasMetaComPendencia(pend);
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
    }
  }, [obraId]);

  useEffect(() => { carregar(); }, [carregar]);

  const opcoesFiltradas = useMemo(() => {
    const q = norm(busca.trim());
    if (!q) return opcoes;
    return opcoes.filter((o) => norm(`${o.fornecedor ?? ''} ${o.categoria} ${o.descritivo ?? ''}`).includes(q));
  }, [opcoes, busca]);

  const historicoFiltrado = useMemo(() => {
    const q = norm(buscaHistorico.trim());
    if (!q) return historico;
    return historico.filter((h) => norm(`${h.fornecedor ?? ''} ${h.categoria} ${h.descritivo ?? ''}`).includes(q));
  }, [historico, buscaHistorico]);

  // ── item selecionado + formulário
  const [itemSel, setItemSel] = useState<Opcao | null>(null);
  const [pct, setPct] = useState('');
  const [obs, setObs] = useState('');
  const [pending, setPending] = useState(false);

  function selecionar(o: Opcao) {
    setItemSel(o);
    setPct('');
    setObs('');
  }

  const valorPreview = itemSel && pct ? (Number(pct.replace(',', '.')) / 100) * itemSel.comprado : 0;

  async function solicitar() {
    if (!itemSel) return;
    setPending(true);
    try {
      const r = await api.post<{ data: { id: string } }>(`/obras/${obraId}/liberacao-fornecedor`, {
        comprasMetaId: itemSel.comprasMetaId,
        percentual: Number(pct.replace(',', '.')),
        observacoes: obs,
      });
      toast('Solicitação enviada — o financeiro foi avisado por e-mail.');
      router.push(`/liberacao-fornecedor?id=${r.data.data.id}`);
    } catch (e) {
      toast(errMsg(e, 'Erro ao solicitar'), 'erro');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <button
        onClick={() => router.push('/liberacao-fornecedor')}
        className="flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon mb-3"
      >
        <ArrowLeft size={16} /> Obras
      </button>

      <h1 className="flex items-center gap-2 text-xl font-bold text-ber-carbon mb-1">
        <Send size={20} className="text-ber-teal" /> {loading ? 'Carregando…' : obraNome || 'Obra'}
      </h1>
      <p className="mb-4 text-xs text-ber-gray max-w-2xl">
        {tab === 'fornecedores'
          ? 'Fornecedores contratados (Metas de Compra) desta obra. Selecione um pra solicitar liberação de medição.'
          : 'Todas as liberações já solicitadas nesta obra — quanto cada fornecedor já mediu, quem solicitou e quem aprovou.'}
      </p>

      <div className="flex gap-1 border-b border-ber-border mb-5">
        <button
          onClick={() => setTab('fornecedores')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'fornecedores' ? 'border-ber-olive text-ber-carbon' : 'border-transparent text-ber-gray hover:text-ber-carbon'
          }`}
        >
          Fornecedores
        </button>
        <button
          onClick={() => setTab('historico')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'historico' ? 'border-ber-olive text-ber-carbon' : 'border-transparent text-ber-gray hover:text-ber-carbon'
          }`}
        >
          Histórico {historico.length > 0 && <span className="text-ber-gray/70">({historico.length})</span>}
        </button>
      </div>

      {erro ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          Não consegui carregar os dados dessa obra.{' '}
          <button onClick={carregar} className="underline font-medium">Tentar de novo</button>
        </div>
      ) : tab === 'historico' ? (
        <section className="bg-white border border-ber-border rounded-xl overflow-hidden">
          <div className="border-b border-ber-border p-3">
            <div className="relative max-w-sm">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ber-gray/60" />
              <input
                type="text" value={buscaHistorico} onChange={(e) => setBuscaHistorico(e.target.value)}
                placeholder="Buscar fornecedor ou item…"
                className="w-full text-sm pl-8 pr-3 py-2 border border-ber-border rounded-lg"
              />
            </div>
          </div>
          <div className="divide-y divide-ber-border/60">
            {loading ? (
              <p className="text-sm text-ber-gray p-4">Carregando…</p>
            ) : historico.length === 0 ? (
              <p className="text-sm text-ber-gray p-4">Nenhuma liberação solicitada ainda nesta obra.</p>
            ) : historicoFiltrado.length === 0 ? (
              <p className="text-sm text-ber-gray p-4">Nenhuma liberação encontrada pra &quot;{buscaHistorico}&quot;.</p>
            ) : (
              historicoFiltrado.map((h) => (
                <div key={h.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ber-carbon" title={h.fornecedor ?? h.categoria}>
                        {h.fornecedor ?? h.categoria}
                      </p>
                      <p className="text-xs text-ber-gray">{h.categoria}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COR[h.status]}`}>{STATUS_LABEL[h.status]}</span>
                  </div>
                  <p className="text-sm mt-1.5 tabular-nums">
                    <span className="font-semibold text-ber-carbon">{h.percentual.toFixed(1)}%</span>
                    <span className="text-ber-gray"> de </span>
                    <span className="text-ber-carbon">{BRL(h.comprado)}</span>
                    <span className="text-ber-gray"> = </span>
                    <span className="font-bold text-ber-olive">{BRL(h.valorAutorizado)}</span>
                    {h.dataPagamento && <span className="text-ber-gray"> · pagamento {fmtData(h.dataPagamento)}</span>}
                  </p>
                  {h.observacoes && <p className="text-xs text-ber-gray/70 italic mt-1">{h.observacoes}</p>}
                  {h.motivoRecusa && (
                    <p className="text-xs text-red-600 mt-1">
                      Recusada{h.recusadoPorNome ? ` por ${h.recusadoPorNome}` : ''}: {h.motivoRecusa}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-ber-gray mt-2 pt-2 border-t border-ber-border/50">
                    <span>Solicitado{h.solicitadoPorNome ? ` por ${h.solicitadoPorNome}` : ''} em {fmtDataHora(h.createdAt)}</span>
                    {h.aprovadoFinanceiroNome && <span>· Financeiro: {h.aprovadoFinanceiroNome}</span>}
                    {h.aprovadoDiretoriaNome && <span>· Diretoria: {h.aprovadoDiretoriaNome}</span>}
                    {h.emailEnviadoEm && <span>· e-mail enviado a {h.emailDestinatario} em {fmtDataHora(h.emailEnviadoEm)}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] items-start">
          {/* ─── LISTA — fornecedores contratados ── */}
          <section className="bg-white border border-ber-border rounded-xl overflow-hidden">
            <div className="border-b border-ber-border p-3">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ber-gray/60" />
                <input
                  type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar fornecedor ou item…" autoFocus
                  className="w-full text-sm pl-8 pr-3 py-2 border border-ber-border rounded-lg"
                />
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto divide-y divide-ber-border/60">
              {loading ? (
                <p className="text-sm text-ber-gray p-4">Carregando…</p>
              ) : opcoes.length === 0 ? (
                <p className="text-sm text-ber-gray p-4">Nenhum item de Metas de Compra com valor comprado nesta obra.</p>
              ) : opcoesFiltradas.length === 0 ? (
                <p className="text-sm text-ber-gray p-4">Nenhum fornecedor encontrado pra &quot;{busca}&quot;.</p>
              ) : (
                opcoesFiltradas.map((o) => {
                  const semSaldo = o.saldo <= 0.01;
                  const emAndamento = comprasMetaComPendencia.has(o.comprasMetaId);
                  const selecionado = itemSel?.comprasMetaId === o.comprasMetaId;
                  return (
                    <button
                      key={o.comprasMetaId}
                      disabled={semSaldo}
                      onClick={() => selecionar(o)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left disabled:opacity-50 ${
                        selecionado ? 'bg-ber-olive/10' : 'hover:bg-ber-bg/60'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ber-carbon truncate" title={o.fornecedor ?? o.categoria}>
                          {o.fornecedor ?? o.categoria}
                        </p>
                        <p className="text-xs text-ber-gray truncate" title={o.categoria}>{o.categoria}</p>
                        <p className="text-xs mt-0.5">
                          <span className="text-ber-gray">comprado </span>
                          <span className="font-medium text-ber-carbon tabular-nums">{BRL(o.comprado)}</span>
                          {o.jaAutorizado > 0 && <span className="text-ber-gray"> · já liberado {BRL(o.jaAutorizado)}</span>}
                          <span className="text-ber-gray"> · saldo </span>
                          <span className={`font-semibold tabular-nums ${semSaldo ? 'text-red-600' : 'text-ber-olive'}`}>{BRL(o.saldo)}</span>
                        </p>
                        <div className="flex gap-1.5 mt-1">
                          {semSaldo && (
                            <span className="inline-block rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase px-2 py-0.5">Sem saldo</span>
                          )}
                          {emAndamento && !semSaldo && (
                            <span className="inline-block rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase px-2 py-0.5">Já tem solicitação em andamento</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-ber-gray/50 shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* ─── FORMULÁRIO — item selecionado ── */}
          <section className="bg-white border border-ber-border rounded-xl p-5 lg:sticky lg:top-4">
            {!itemSel ? (
              <p className="text-sm text-ber-gray text-center py-12">← Selecione um fornecedor na lista pra solicitar a liberação.</p>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-ber-gray mb-1">Solicitar liberação</p>
                <p className="text-base font-bold text-ber-carbon" title={itemSel.fornecedor ?? itemSel.categoria}>
                  {itemSel.fornecedor ?? itemSel.categoria}
                </p>
                <p className="text-xs text-ber-gray mb-3">{itemSel.categoria}</p>
                <div className="rounded-lg bg-ber-bg/50 p-3 mb-4">
                  <p className="text-sm tabular-nums">
                    <span className="text-ber-gray">comprado </span><span className="font-medium text-ber-carbon">{BRL(itemSel.comprado)}</span>
                    <span className="text-ber-gray"> · saldo disponível </span><span className="font-bold text-ber-olive">{BRL(itemSel.saldo)}</span>
                  </p>
                  {comprasMetaComPendencia.has(itemSel.comprasMetaId) && (
                    <p className="text-xs text-amber-800 mt-1.5">⚠️ Já existe uma solicitação em andamento pra este item.</p>
                  )}
                </div>

                {(() => {
                  const histItem = historico.filter((h) => h.comprasMetaId === itemSel.comprasMetaId);
                  if (histItem.length === 0) return null;
                  return (
                    <div className="mb-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-ber-gray mb-1.5">Já medido/liberado</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {histItem.map((h) => (
                          <div key={h.id} className="flex items-center justify-between gap-2 text-xs border border-ber-border/60 rounded-lg px-2.5 py-1.5">
                            <span className="text-ber-gray shrink-0">{new Date(h.createdAt).toLocaleDateString('pt-BR')}</span>
                            <span className="font-medium text-ber-carbon tabular-nums truncate">{h.percentual.toFixed(1)}% = {BRL(h.valorAutorizado)}</span>
                            <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${STATUS_COR[h.status]}`}>{STATUS_LABEL[h.status]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <label className="block text-xs font-medium text-ber-gray">% desta liberação</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="text" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="ex.: 30"
                    className="w-28 text-sm px-3 py-2 border border-ber-border rounded-lg tabular-nums" />
                  <div className="flex gap-1">
                    {PCT_RAPIDOS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPct(String(p))}
                        className={`text-xs px-2 py-1 rounded-md border ${
                          pct === String(p) ? 'border-ber-olive bg-ber-olive/15 text-ber-carbon font-semibold' : 'border-ber-border text-ber-gray hover:border-ber-teal'
                        }`}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>
                {valorPreview > 0 && <p className="text-base font-bold text-ber-olive tabular-nums mt-2">= {BRL(valorPreview)}</p>}

                <label className="block text-xs font-medium text-ber-gray mt-3">Observações (opcional)</label>
                <input type="text" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observações"
                  className="w-full text-sm px-3 py-2 border border-ber-border rounded-lg mt-1" />

                <div className="flex justify-end gap-2 mt-5">
                  <button onClick={() => setItemSel(null)} className="rounded-lg px-4 py-2 text-sm text-ber-gray">Cancelar</button>
                  <button disabled={pending || !pct} onClick={solicitar}
                    className="rounded-lg bg-ber-olive px-4 py-2 text-sm font-semibold text-ber-carbon disabled:opacity-50">
                    {pending ? '…' : 'Solicitar liberação'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
