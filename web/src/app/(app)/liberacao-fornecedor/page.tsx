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
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send, X, Building2, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';

type Status = 'solicitada' | 'aprovada_financeiro' | 'autorizada' | 'recusada';

interface Item {
  id: string;
  obraId: string;
  obraNome: string;
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

  // ── lista de obras (com resumo de fornecedores/valores)
  const [obras, setObras] = useState<ObraResumo[]>([]);
  const [loadingObras, setLoadingObras] = useState(true);
  const [erroObras, setErroObras] = useState(false);

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

  // ── modal: obra selecionada → todos os fornecedores contratados com valores
  const [obraAberta, setObraAberta] = useState<ObraResumo | null>(null);
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [loadingOpcoes, setLoadingOpcoes] = useState(false);
  const [itemSel, setItemSel] = useState<Opcao | null>(null);
  const [pct, setPct] = useState('');
  const [obs, setObs] = useState('');
  const [pending, setPending] = useState(false);

  function abrirObra(o: ObraResumo) {
    setObraAberta(o);
    setItemSel(null);
    setPct('');
    setObs('');
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

  const valorPreview = itemSel && pct ? (Number(pct.replace(',', '.')) / 100) * itemSel.comprado : 0;

  async function solicitar() {
    if (!obraAberta || !itemSel) return;
    setPending(true);
    try {
      await api.post(`/obras/${obraAberta.obraId}/liberacao-fornecedor`, {
        comprasMetaId: itemSel.comprasMetaId,
        percentual: Number(pct.replace(',', '.')),
        observacoes: obs,
      });
      toast('Solicitação enviada — o financeiro foi avisado por e-mail.');
      fecharModal();
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
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="flex items-center gap-2 text-xl font-bold text-ber-carbon mb-1">
        <Send size={20} className="text-ber-teal" /> Liberação de Fornecedor
      </h1>
      <p className="mb-6 text-xs text-ber-gray max-w-2xl">
        Engenharia solicita % sobre o valor comprado (Metas de Compra) → financeiro aprova e define a data de pagamento →
        diretoria aprova → e-mail automático autoriza o fornecedor a emitir a NF.
      </p>

      {/* ─── OBRAS — clique abre os fornecedores contratados com valores ── */}
      <section className="mb-8">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-ber-gray mb-3">Obras</h2>
        {loadingObras ? (
          <p className="text-sm text-ber-gray">Carregando obras…</p>
        ) : erroObras ? (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            Não consegui carregar as obras.{' '}
            <button onClick={carregarObras} className="underline font-medium">Tentar de novo</button>
          </div>
        ) : obras.length === 0 ? (
          <p className="text-sm text-ber-gray">Nenhuma obra com item de Metas de Compra comprado ainda.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {obras.map((o) => (
              <button
                key={o.obraId}
                onClick={() => abrirObra(o)}
                className="flex items-center justify-between gap-3 bg-white border border-ber-border rounded-xl p-3.5 text-left hover:border-ber-teal hover:shadow-sm transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Building2 size={18} className="text-ber-gray shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ber-carbon truncate">{o.obraNome}</p>
                    <p className="text-xs text-ber-gray tabular-nums">
                      {o.qtdFornecedores} fornecedor{o.qtdFornecedores === 1 ? '' : 'es'} · {BRL(o.totalComprado)}
                    </p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-ber-gray/50 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ─── FILA — status das solicitações já feitas ── */}
      {loadingItens ? (
        <p className="text-sm text-ber-gray">Carregando…</p>
      ) : itens.length === 0 ? (
        <p className="text-sm text-ber-gray text-center py-8">Nenhuma liberação ainda.</p>
      ) : (
        <div className="space-y-6">
          {grupos.map((g) => {
            const lista = itens.filter((i) => i.status === g.key);
            if (lista.length === 0) return null;
            return (
              <section key={g.key}>
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-ber-gray mb-2">{g.titulo} ({lista.length})</h2>
                <div className="space-y-2">
                  {lista.map((it) => (
                    <div key={it.id} className={`bg-white border rounded-xl p-4 ${destaqueId === it.id ? 'border-ber-teal ring-2 ring-ber-teal/30' : 'border-ber-border'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-ber-carbon">{it.obraNome} <span className="text-ber-gray">·</span> {it.categoria}</p>
                          <p className="text-sm text-ber-gray">
                            {it.fornecedor ?? '—'} — {it.percentual.toFixed(1)}% = <span className="font-semibold tabular-nums">{BRL(it.valorAutorizado)}</span>
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
                            className="rounded-lg bg-ber-teal px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Aprovar (financeiro)</button>
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
                            className="rounded-lg bg-ber-carbon px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Aprovar e enviar autorização</button>
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
              </section>
            );
          })}
        </div>
      )}

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
                <p className="text-base font-bold text-ber-carbon truncate">{obraAberta.obraNome}</p>
              </div>
              <button onClick={fecharModal} className="shrink-0 rounded-lg p-1.5 text-ber-gray hover:bg-ber-bg/60">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {loadingOpcoes ? (
                <p className="text-sm text-ber-gray py-4">Carregando…</p>
              ) : opcoes.length === 0 ? (
                <p className="text-sm text-ber-gray py-4">Nenhum item de Metas de Compra com valor comprado nesta obra.</p>
              ) : !itemSel ? (
                <div className="space-y-1.5 py-1">
                  {opcoes.map((o) => (
                    <button
                      key={o.comprasMetaId}
                      disabled={o.saldo <= 0.01}
                      onClick={() => setItemSel(o)}
                      className="w-full flex items-center justify-between gap-3 rounded-lg border border-ber-border px-3 py-2.5 text-left hover:border-ber-teal disabled:opacity-40 disabled:hover:border-ber-border"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ber-carbon truncate">
                          {o.categoria}{o.fornecedor ? ` — ${o.fornecedor}` : ''}
                        </p>
                        <p className="text-xs text-ber-gray tabular-nums">
                          comprado {BRL(o.comprado)}
                          {o.jaAutorizado > 0 && <> · já liberado {BRL(o.jaAutorizado)}</>}
                          {' · '}saldo <span className={o.saldo <= 0.01 ? 'text-red-600 font-medium' : 'font-medium text-ber-carbon'}>{BRL(o.saldo)}</span>
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-ber-gray/50 shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-1">
                  <button onClick={() => setItemSel(null)} className="text-xs text-ber-teal font-medium mb-3">← voltar aos fornecedores</button>
                  <div className="rounded-lg bg-ber-bg/50 p-3 mb-3">
                    <p className="text-sm font-semibold text-ber-carbon">
                      {itemSel.categoria}{itemSel.fornecedor ? ` — ${itemSel.fornecedor}` : ''}
                    </p>
                    <p className="text-xs text-ber-gray tabular-nums mt-0.5">
                      comprado {BRL(itemSel.comprado)} · saldo disponível {BRL(itemSel.saldo)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-ber-gray">% desta liberação</label>
                    <input type="text" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="ex.: 30"
                      className="w-full text-sm px-3 py-2 border border-ber-border rounded-lg tabular-nums" autoFocus />
                    {valorPreview > 0 && <p className="text-sm text-ber-gray tabular-nums">= {BRL(valorPreview)}</p>}
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
                  className="rounded-lg bg-ber-carbon px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
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
