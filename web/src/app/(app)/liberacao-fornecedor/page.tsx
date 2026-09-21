'use client';

/**
 * Liberação de fornecedor p/ faturamento (21/09/26, pedido Bruno).
 * Engenharia solicita % sobre o valor comprado (Metas de Compra) → financeiro
 * aprova c/ data de pagamento → diretoria aprova → e-mail automático autoriza
 * o fornecedor. Recebido por e-mail com link (?id=) que abre direto no item.
 *
 * Estrutura (Bruno 21/09, "2.- sim"): lista de obras → clicar abre uma JANELA
 * (modal) com todos os fornecedores contratados dessa obra e seus valores →
 * seleciona um pra fazer a solicitação. Substitui os dois dropdowns.
 *
 * Rodada de ajustes (21/09, Bruno pediu "TODOS"): busca em obras e
 * fornecedores, badge de pendentes + barra de progresso no card da obra,
 * aviso de solicitação já em andamento, scroll+destaque pro item recém
 * criado, layout em 2 colunas full-width, botão de ação em cor de marca,
 * chips de % rápido, tag de saldo esgotado mais visível.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send, X, Building2, ChevronRight, Search } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';

type Status = 'solicitada' | 'aprovada_financeiro' | 'autorizada' | 'recusada';

interface Item {
  id: string;
  obraId: string;
  obraNome: string;
  comprasMetaId: string;
  categoria: string;
  descritivo: string | null;
  fornecedor: string | null;
  percentual: number;
  valorAutorizado: number;
  status: Status;
  dataPagamento: string | null;
  observacoes: string | null;
  motivoRecusa: string | null;
  emailEnviadoEm: string | null;
  emailDestinatario: string | null;
  createdAt: string;
}

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

interface ObraResumo {
  obraId: string;
  obraNome: string;
  qtdItens: number;
  qtdFornecedores: number;
  totalComprado: number;
}

const BRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
const errMsg = (e: unknown, fb: string) =>
  (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? fb;
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const STATUS_LABEL: Record<Status, string> = {
  solicitada: 'Aguardando financeiro',
  aprovada_financeiro: 'Aguardando diretoria',
  autorizada: 'Autorizada — e-mail enviado',
  recusada: 'Recusada',
};
const STATUS_COR: Record<Status, string> = {
  solicitada: 'bg-amber-50 text-amber-800 border-amber-300',
  aprovada_financeiro: 'bg-blue-50 text-blue-800 border-blue-300',
  autorizada: 'bg-green-50 text-green-800 border-green-300',
  recusada: 'bg-red-50 text-red-700 border-red-300',
};
const PENDENTES: Status[] = ['solicitada', 'aprovada_financeiro'];
const PCT_RAPIDOS = [25, 50, 75, 100];

export default function LiberacaoFornecedorPage() {
  const { user } = useAuthStore();
  const role = user?.role;
  const podeFinanceiro = role === 'financeiro' || role === 'diretoria' || role === 'socio';
  const podeDiretoria = role === 'diretoria' || role === 'socio';

  const searchParams = useSearchParams();
  const destaqueId = searchParams.get('id');

  // ── fila de aprovação (itens já solicitados)
  const [itens, setItens] = useState<Item[]>([]);
  const [loadingItens, setLoadingItens] = useState(true);
  const [recemCriadoId, setRecemCriadoId] = useState<string | null>(null);
  const filaRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const carregarItens = useCallback(async () => {
    try {
      const r = await api.get<{ data: Item[] }>('/liberacao-fornecedor');
      setItens(r.data.data);
    } catch {
      toast('Não consegui carregar as liberações', 'erro');
    } finally {
      setLoadingItens(false);
    }
  }, []);

  useEffect(() => { carregarItens(); }, [carregarItens]);

  // scroll + destaque temporário pro item recém-criado, depois de a fila recarregar
  useEffect(() => {
    if (!recemCriadoId) return;
    const el = filaRefs.current[recemCriadoId];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setRecemCriadoId(null), 3000);
    return () => clearTimeout(t);
  }, [recemCriadoId, itens]);

  // pendentes (solicitada + aprovada_financeiro) e total já comprometido por obra — pro badge/barra dos cards
  const { pendentesPorObra, comprometidoPorObra, comprasMetaComPendencia } = useMemo(() => {
    const pend = new Map<string, number>();
    const comp = new Map<string, number>();
    const idsPendentes = new Set<string>();
    for (const it of itens) {
      if (it.status !== 'recusada') {
        comp.set(it.obraId, (comp.get(it.obraId) ?? 0) + it.valorAutorizado);
      }
      if (PENDENTES.includes(it.status)) {
        pend.set(it.obraId, (pend.get(it.obraId) ?? 0) + 1);
        idsPendentes.add(it.comprasMetaId);
      }
    }
    return { pendentesPorObra: pend, comprometidoPorObra: comp, comprasMetaComPendencia: idsPendentes };
  }, [itens]);

  // ── lista de obras (com resumo de fornecedores/valores) + busca
  const [obras, setObras] = useState<ObraResumo[]>([]);
  const [loadingObras, setLoadingObras] = useState(true);
  const [erroObras, setErroObras] = useState(false);
  const [buscaObra, setBuscaObra] = useState('');

  const carregarObras = useCallback(async () => {
    setLoadingObras(true);
    setErroObras(false);
    try {
      const r = await api.get<{ data: ObraResumo[] }>('/liberacao-fornecedor/obras-resumo');
      setObras(r.data.data);
    } catch {
      setErroObras(true);
    } finally {
      setLoadingObras(false);
    }
  }, []);

  useEffect(() => { carregarObras(); }, [carregarObras]);

  const obrasFiltradas = useMemo(() => {
    const q = norm(buscaObra.trim());
    if (!q) return obras;
    return obras.filter((o) => norm(o.obraNome).includes(q));
  }, [obras, buscaObra]);

  // ── modal: obra selecionada → todos os fornecedores contratados com valores
  const [obraAberta, setObraAberta] = useState<ObraResumo | null>(null);
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [loadingOpcoes, setLoadingOpcoes] = useState(false);
  const [buscaForn, setBuscaForn] = useState('');
  const [itemSel, setItemSel] = useState<Opcao | null>(null);
  const [pct, setPct] = useState('');
  const [obs, setObs] = useState('');
  const [pending, setPending] = useState(false);

  function abrirObra(o: ObraResumo) {
    setObraAberta(o);
    setItemSel(null);
    setPct('');
    setObs('');
    setBuscaForn('');
    setLoadingOpcoes(true);
    api.get<{ data: Opcao[] }>(`/obras/${o.obraId}/liberacao-fornecedor/opcoes`)
      .then((r) => setOpcoes(r.data.data))
      .catch(() => toast('Não consegui carregar os fornecedores contratados dessa obra', 'erro'))
      .finally(() => setLoadingOpcoes(false));
  }

  function fecharModal() {
    setObraAberta(null);
    setOpcoes([]);
    setItemSel(null);
  }

  const opcoesFiltradas = useMemo(() => {
    const q = norm(buscaForn.trim());
    if (!q) return opcoes;
    return opcoes.filter((o) => norm(`${o.fornecedor ?? ''} ${o.categoria} ${o.descritivo ?? ''}`).includes(q));
  }, [opcoes, buscaForn]);

  const valorPreview = itemSel && pct ? (Number(pct.replace(',', '.')) / 100) * itemSel.comprado : 0;

  async function solicitar() {
    if (!obraAberta || !itemSel) return;
    setPending(true);
    try {
      const r = await api.post<{ data: { id: string } }>(`/obras/${obraAberta.obraId}/liberacao-fornecedor`, {
        comprasMetaId: itemSel.comprasMetaId,
        percentual: Number(pct.replace(',', '.')),
        observacoes: obs,
      });
      toast('Solicitação enviada — o financeiro foi avisado por e-mail.');
      fecharModal();
      setRecemCriadoId(r.data.data.id);
      carregarItens();
    } catch (e) {
      toast(errMsg(e, 'Erro ao solicitar'), 'erro');
    } finally {
      setPending(false);
    }
  }

  // ── ações na fila (aprovar/recusar)
  const [dataPgto, setDataPgto] = useState<Record<string, string>>({});
  const [emailForn, setEmailForn] = useState<Record<string, string>>({});
  const [recusando, setRecusando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');

  async function aprovarFinanceiro(id: string) {
    setPending(true);
    try {
      await api.patch(`/liberacao-fornecedor/${id}/aprovar-financeiro`, { dataPagamento: dataPgto[id] });
      toast('Aprovado — a diretoria foi avisada por e-mail.');
      carregarItens();
    } catch (e) {
      toast(errMsg(e, 'Erro ao aprovar'), 'erro');
    } finally { setPending(false); }
  }

  async function aprovarDiretoria(id: string) {
    setPending(true);
    try {
      await api.patch(`/liberacao-fornecedor/${id}/aprovar-diretoria`, { email: emailForn[id] });
      toast('Aprovado — e-mail de autorização enviado ao fornecedor.');
      carregarItens();
    } catch (e) {
      toast(errMsg(e, 'Erro ao aprovar'), 'erro');
    } finally { setPending(false); }
  }

  async function recusar(id: string) {
    setPending(true);
    try {
      await api.patch(`/liberacao-fornecedor/${id}/recusar`, { motivo });
      toast('Recusada.');
      setRecusando(null); setMotivo('');
      carregarItens();
    } catch (e) {
      toast(errMsg(e, 'Erro ao recusar'), 'erro');
    } finally { setPending(false); }
  }

  const grupos = useMemo(
    () => ([
      { key: 'solicitada' as Status, titulo: 'Aguardando financeiro' },
      { key: 'aprovada_financeiro' as Status, titulo: 'Aguardando diretoria' },
      { key: 'autorizada' as Status, titulo: 'Autorizadas' },
      { key: 'recusada' as Status, titulo: 'Recusadas' },
    ]),
    [],
  );

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <h1 className="flex items-center gap-2 text-xl font-bold text-ber-carbon mb-1">
        <Send size={20} className="text-ber-teal" /> Liberação de Fornecedor
      </h1>
      <p className="mb-6 text-xs text-ber-gray max-w-2xl">
        Engenharia solicita % sobre o valor comprado (Metas de Compra) → financeiro aprova e define a data de pagamento →
        diretoria aprova → e-mail automático autoriza o fornecedor a emitir a NF.
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-start">
        {/* ─── OBRAS — clique abre os fornecedores contratados com valores ── */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-ber-gray">Obras</h2>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ber-gray/60" />
              <input
                type="text" value={buscaObra} onChange={(e) => setBuscaObra(e.target.value)}
                placeholder="Buscar obra…"
                className="text-sm pl-8 pr-3 py-1.5 border border-ber-border rounded-lg w-48"
              />
            </div>
          </div>
          {loadingObras ? (
            <p className="text-sm text-ber-gray">Carregando obras…</p>
          ) : erroObras ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              Não consegui carregar as obras.{' '}
              <button onClick={carregarObras} className="underline font-medium">Tentar de novo</button>
            </div>
          ) : obrasFiltradas.length === 0 ? (
            <p className="text-sm text-ber-gray">
              {buscaObra ? 'Nenhuma obra encontrada.' : 'Nenhuma obra com item de Metas de Compra comprado ainda.'}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {obrasFiltradas.map((o) => {
                const pendentes = pendentesPorObra.get(o.obraId) ?? 0;
                const comprometido = comprometidoPorObra.get(o.obraId) ?? 0;
                const pctBarra = o.totalComprado > 0 ? Math.min(100, (comprometido / o.totalComprado) * 100) : 0;
                return (
                  <button
                    key={o.obraId}
                    onClick={() => abrirObra(o)}
                    className="relative flex flex-col gap-2 bg-white border border-ber-border rounded-xl p-3.5 text-left hover:border-ber-teal hover:shadow-sm transition"
                  >
                    {pendentes > 0 && (
                      <span className="absolute -top-2 -right-2 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 min-w-[20px] text-center shadow">
                        {pendentes}
                      </span>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Building2 size={18} className="text-ber-gray shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ber-carbon truncate" title={o.obraNome}>{o.obraNome}</p>
                          <p className="text-xs text-ber-gray">
                            {o.qtdFornecedores} fornecedor{o.qtdFornecedores === 1 ? '' : 'es'} · <span className="font-medium text-ber-carbon tabular-nums">{BRL(o.totalComprado)}</span>
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-ber-gray/50 shrink-0" />
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-ber-border/60 overflow-hidden">
                      <div className="h-full rounded-full bg-ber-olive transition-all" style={{ width: `${pctBarra}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ─── FILA — status das solicitações já feitas ── */}
        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ber-gray mb-3">Fila de aprovação</h2>
          {loadingItens ? (
            <p className="text-sm text-ber-gray">Carregando…</p>
          ) : itens.length === 0 ? (
            <p className="text-sm text-ber-gray text-center py-8">Nenhuma liberação ainda.</p>
          ) : (
            <div className="space-y-5">
              {grupos.map((g) => {
                const lista = itens.filter((i) => i.status === g.key);
                if (lista.length === 0) return null;
                return (
                  <div key={g.key}>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-ber-gray mb-2">{g.titulo} ({lista.length})</h3>
                    <div className="space-y-2">
                      {lista.map((it) => (
                        <div
                          key={it.id}
                          ref={(el) => { filaRefs.current[it.id] = el; }}
                          className={`bg-white border rounded-xl p-4 transition-shadow ${
                            (destaqueId === it.id || recemCriadoId === it.id) ? 'border-ber-teal ring-2 ring-ber-teal/30' : 'border-ber-border'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-ber-carbon">{it.obraNome} <span className="text-ber-gray">·</span> {it.categoria}</p>
                              <p className="text-sm text-ber-gray">
                                {it.fornecedor ?? '—'} — {it.percentual.toFixed(1)}% = <span className="font-semibold tabular-nums text-ber-carbon">{BRL(it.valorAutorizado)}</span>
                                {it.dataPagamento && <> · pagamento {fmtData(it.dataPagamento)}</>}
                              </p>
                              {it.observacoes && <p className="text-xs text-ber-gray/70 italic mt-0.5">{it.observacoes}</p>}
                              {it.motivoRecusa && <p className="text-xs text-red-600 mt-0.5">Recusa: {it.motivoRecusa}</p>}
                              {it.emailEnviadoEm && (
                                <p className="text-xs text-green-700 mt-0.5">✉️ enviado a {it.emailDestinatario} em {new Date(it.emailEnviadoEm).toLocaleString('pt-BR')}</p>
                              )}
                            </div>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COR[it.status]}`}>{STATUS_LABEL[it.status]}</span>
                          </div>

                          {it.status === 'solicitada' && podeFinanceiro && (
                            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-ber-border/60">
                              <label className="text-xs text-ber-gray">Pagamento em</label>
                              <input type="date" value={dataPgto[it.id] ?? ''} onChange={(e) => setDataPgto((p) => ({ ...p, [it.id]: e.target.value }))}
                                className="text-sm px-2 py-1.5 border border-ber-border rounded-lg" />
                              <button disabled={pending || !dataPgto[it.id]} onClick={() => aprovarFinanceiro(it.id)}
                                className="rounded-lg bg-ber-olive px-3 py-1.5 text-sm font-semibold text-ber-carbon disabled:opacity-50">Aprovar (financeiro)</button>
                              {recusando === it.id ? (
                                <span className="flex items-center gap-2">
                                  <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo" autoFocus
                                    className="text-sm px-2 py-1.5 border border-red-300 rounded-lg" />
                                  <button disabled={pending || !motivo.trim()} onClick={() => recusar(it.id)}
                                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Confirmar</button>
                                  <button onClick={() => setRecusando(null)} className="text-xs text-ber-gray">cancelar</button>
                                </span>
                              ) : (
                                <button onClick={() => setRecusando(it.id)} className="rounded-lg border border-red-200 text-red-700 px-3 py-1.5 text-sm">Recusar</button>
                              )}
                            </div>
                          )}

                          {it.status === 'aprovada_financeiro' && podeDiretoria && (
                            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-ber-border/60">
                              <input type="email" value={emailForn[it.id] ?? ''} onChange={(e) => setEmailForn((p) => ({ ...p, [it.id]: e.target.value }))}
                                placeholder="e-mail do fornecedor (se não achar automático)"
                                className="text-sm px-2 py-1.5 border border-amber-300 rounded-lg min-w-56" />
                              <button disabled={pending} onClick={() => aprovarDiretoria(it.id)}
                                className="rounded-lg bg-ber-olive px-3 py-1.5 text-sm font-semibold text-ber-carbon disabled:opacity-50">Aprovar e enviar autorização</button>
                              {recusando === it.id ? (
                                <span className="flex items-center gap-2">
                                  <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo" autoFocus
                                    className="text-sm px-2 py-1.5 border border-red-300 rounded-lg" />
                                  <button disabled={pending || !motivo.trim()} onClick={() => recusar(it.id)}
                                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Confirmar</button>
                                  <button onClick={() => setRecusando(null)} className="text-xs text-ber-gray">cancelar</button>
                                </span>
                              ) : (
                                <button onClick={() => setRecusando(it.id)} className="rounded-lg border border-red-200 text-red-700 px-3 py-1.5 text-sm">Recusar</button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ─── MODAL — fornecedores contratados da obra selecionada ── */}
      {obraAberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={fecharModal}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-ber-border px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ber-gray">Fornecedores contratados</p>
                <p className="text-base font-bold text-ber-carbon truncate" title={obraAberta.obraNome}>{obraAberta.obraNome}</p>
              </div>
              <button onClick={fecharModal} className="shrink-0 rounded-lg p-1.5 text-ber-gray hover:bg-ber-bg/60">
                <X size={18} />
              </button>
            </div>

            {!itemSel && !loadingOpcoes && opcoes.length > 0 && (
              <div className="px-5 pt-3">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ber-gray/60" />
                  <input
                    type="text" value={buscaForn} onChange={(e) => setBuscaForn(e.target.value)}
                    placeholder="Buscar fornecedor ou item…" autoFocus
                    className="w-full text-sm pl-8 pr-3 py-2 border border-ber-border rounded-lg"
                  />
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {loadingOpcoes ? (
                <p className="text-sm text-ber-gray py-4">Carregando…</p>
              ) : opcoes.length === 0 ? (
                <p className="text-sm text-ber-gray py-4">Nenhum item de Metas de Compra com valor comprado nesta obra.</p>
              ) : !itemSel ? (
                opcoesFiltradas.length === 0 ? (
                  <p className="text-sm text-ber-gray py-4">Nenhum fornecedor encontrado pra &quot;{buscaForn}&quot;.</p>
                ) : (
                  <div className="space-y-1.5 py-1">
                    {opcoesFiltradas.map((o) => {
                      const semSaldo = o.saldo <= 0.01;
                      const emAndamento = comprasMetaComPendencia.has(o.comprasMetaId);
                      return (
                        <button
                          key={o.comprasMetaId}
                          disabled={semSaldo}
                          onClick={() => setItemSel(o)}
                          className="w-full flex items-center justify-between gap-3 rounded-lg border border-ber-border px-3 py-2.5 text-left hover:border-ber-teal disabled:opacity-50 disabled:hover:border-ber-border"
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
                    })}
                  </div>
                )
              ) : (
                <div className="py-1">
                  <button onClick={() => setItemSel(null)} className="text-xs text-ber-teal font-medium mb-3">← voltar aos fornecedores</button>
                  <div className="rounded-lg bg-ber-bg/50 p-3 mb-3">
                    <p className="text-sm font-semibold text-ber-carbon truncate" title={itemSel.fornecedor ?? itemSel.categoria}>
                      {itemSel.fornecedor ?? itemSel.categoria}
                    </p>
                    <p className="text-xs text-ber-gray truncate" title={itemSel.categoria}>{itemSel.categoria}</p>
                    <p className="text-sm tabular-nums mt-1">
                      <span className="text-ber-gray">comprado </span><span className="font-medium text-ber-carbon">{BRL(itemSel.comprado)}</span>
                      <span className="text-ber-gray"> · saldo disponível </span><span className="font-bold text-ber-olive">{BRL(itemSel.saldo)}</span>
                    </p>
                    {comprasMetaComPendencia.has(itemSel.comprasMetaId) && (
                      <p className="text-xs text-amber-800 mt-1.5">⚠️ Já existe uma solicitação em andamento pra este item.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-ber-gray">% desta liberação</label>
                    <div className="flex items-center gap-2">
                      <input type="text" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="ex.: 30"
                        className="w-28 text-sm px-3 py-2 border border-ber-border rounded-lg tabular-nums" autoFocus />
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
                    {valorPreview > 0 && <p className="text-base font-bold text-ber-olive tabular-nums">= {BRL(valorPreview)}</p>}
                    <label className="block text-xs font-medium text-ber-gray mt-2">Observações (opcional)</label>
                    <input type="text" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observações"
                      className="w-full text-sm px-3 py-2 border border-ber-border rounded-lg" />
                  </div>
                </div>
              )}
            </div>

            {itemSel && (
              <div className="border-t border-ber-border px-5 py-3.5 flex justify-end gap-2">
                <button onClick={fecharModal} className="rounded-lg px-4 py-2 text-sm text-ber-gray">Cancelar</button>
                <button disabled={pending || !pct} onClick={solicitar}
                  className="rounded-lg bg-ber-olive px-4 py-2 text-sm font-semibold text-ber-carbon disabled:opacity-50">
                  {pending ? '…' : 'Solicitar liberação'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
