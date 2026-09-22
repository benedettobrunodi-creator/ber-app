'use client';

/**
 * Liberação de fornecedor p/ faturamento (21/09/26, pedido Bruno).
 * Engenharia solicita % sobre o valor comprado (Metas de Compra) → financeiro
 * aprova c/ data de pagamento → diretoria aprova → e-mail automático autoriza
 * o fornecedor. Recebido por e-mail com link (?id=) que abre direto no item.
 *
 * Estrutura: lista de obras aqui → clicar leva pra página própria da obra
 * (/liberacao-fornecedor/[obraId]) com todos os fornecedores contratados e
 * seus valores. Era um modal (janela) até o Bruno achar pequeno demais pra
 * obras com 40+ fornecedores — virou página cheia (21/09, opção "3").
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, Building2, ChevronRight, Search } from 'lucide-react';
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

type ObraStatus = 'nao_iniciada' | 'planejamento' | 'em_andamento' | 'pos_obra' | 'pausada' | 'concluida' | 'cancelada';

interface ObraResumo {
  obraId: string;
  obraNome: string;
  obraStatus: ObraStatus;
  qtdItens: number;
  qtdFornecedores: number;
  totalComprado: number;
}

// Mesmo mapeamento de /obras (Bruno espera os mesmos rótulos/cores em todo o app)
const STATUS_OBRA_CONFIG: Record<ObraStatus, { label: string; className: string }> = {
  nao_iniciada:  { label: 'Não iniciada',            className: 'bg-ber-gray/10 text-ber-gray/70' },
  planejamento:  { label: 'Pré Obra - Planejamento', className: 'bg-ber-gray/15 text-ber-gray' },
  em_andamento:  { label: 'Em andamento',            className: 'bg-ber-teal/15 text-ber-teal' },
  pos_obra:      { label: 'Pós Obra',                className: 'bg-ber-olive/10 text-ber-olive/80' },
  pausada:       { label: 'Pausada',                 className: 'bg-amber-100 text-amber-700' },
  concluida:     { label: 'Concluída',               className: 'bg-ber-olive/15 text-ber-olive' },
  cancelada:     { label: 'Arquivada',               className: 'bg-red-50 text-red-500' },
};

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

export default function LiberacaoFornecedorPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const role = user?.role;
  // Restrito a financeiro + sócio (Bruno, 22/09) — "diretoria" fora de propósito, ver service.ts do backend.
  const podeFinanceiro = role === 'financeiro' || role === 'socio';
  const podeDiretoria = role === 'socio';

  const searchParams = useSearchParams();
  const destaqueId = searchParams.get('id');

  // ── fila de aprovação (itens já solicitados)
  const [itens, setItens] = useState<Item[]>([]);
  const [loadingItens, setLoadingItens] = useState(true);
  const filaRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const jaRolouParaDestaque = useRef(false);

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

  // scroll + destaque temporário pro item vindo por ?id= (recém-criado na página da obra)
  useEffect(() => {
    if (!destaqueId || jaRolouParaDestaque.current || itens.length === 0) return;
    const el = filaRefs.current[destaqueId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      jaRolouParaDestaque.current = true;
    }
  }, [destaqueId, itens]);

  // pendentes (solicitada + aprovada_financeiro) e total já comprometido por obra — pro badge/barra dos cards
  const { pendentesPorObra, comprometidoPorObra } = useMemo(() => {
    const pend = new Map<string, number>();
    const comp = new Map<string, number>();
    for (const it of itens) {
      if (it.status !== 'recusada') {
        comp.set(it.obraId, (comp.get(it.obraId) ?? 0) + it.valorAutorizado);
      }
      if (PENDENTES.includes(it.status)) {
        pend.set(it.obraId, (pend.get(it.obraId) ?? 0) + 1);
      }
    }
    return { pendentesPorObra: pend, comprometidoPorObra: comp };
  }, [itens]);

  // ── lista de obras (com resumo de fornecedores/valores) + busca
  const [obras, setObras] = useState<ObraResumo[]>([]);
  const [loadingObras, setLoadingObras] = useState(true);
  const [erroObras, setErroObras] = useState(false);
  const [buscaObra, setBuscaObra] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<Set<ObraStatus>>(new Set());
  function toggleStatus(s: ObraStatus) {
    setStatusFiltro((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

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

  const statusPresentes = useMemo(
    () => Array.from(new Set(obras.map((o) => o.obraStatus))).sort(
      (a, b) => Object.keys(STATUS_OBRA_CONFIG).indexOf(a) - Object.keys(STATUS_OBRA_CONFIG).indexOf(b),
    ),
    [obras],
  );

  const obrasFiltradas = useMemo(() => {
    const q = norm(buscaObra.trim());
    return obras.filter((o) => {
      if (q && !norm(o.obraNome).includes(q)) return false;
      if (statusFiltro.size > 0 && !statusFiltro.has(o.obraStatus)) return false;
      return true;
    });
  }, [obras, buscaObra, statusFiltro]);

  // ── ações na fila (aprovar/recusar)
  const [dataPgto, setDataPgto] = useState<Record<string, string>>({});
  const [emailForn, setEmailForn] = useState<Record<string, string>>({});
  const [recusando, setRecusando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [pending, setPending] = useState(false);

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
        {/* ─── OBRAS — clique leva pra página com todos os fornecedores contratados ── */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
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
          {statusPresentes.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button
                onClick={() => setStatusFiltro(new Set())}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium border ${
                  statusFiltro.size === 0 ? 'border-ber-carbon bg-ber-carbon text-white' : 'border-ber-border text-ber-gray hover:border-ber-teal'
                }`}
              >
                Todas
              </button>
              {statusPresentes.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium border ${
                    statusFiltro.has(s) ? 'border-ber-carbon ' + STATUS_OBRA_CONFIG[s].className : 'border-ber-border text-ber-gray hover:border-ber-teal'
                  }`}
                >
                  {STATUS_OBRA_CONFIG[s].label}
                </button>
              ))}
            </div>
          )}
          {loadingObras ? (
            <p className="text-sm text-ber-gray">Carregando obras…</p>
          ) : erroObras ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              Não consegui carregar as obras.{' '}
              <button onClick={carregarObras} className="underline font-medium">Tentar de novo</button>
            </div>
          ) : obrasFiltradas.length === 0 ? (
            <p className="text-sm text-ber-gray">
              {buscaObra || statusFiltro.size > 0 ? 'Nenhuma obra encontrada.' : 'Nenhuma obra com item de Metas de Compra comprado ainda.'}
            </p>
          ) : (
            <div className="bg-white border border-ber-border rounded-xl divide-y divide-ber-border/60 overflow-hidden">
              {obrasFiltradas.map((o) => {
                const pendentes = pendentesPorObra.get(o.obraId) ?? 0;
                const comprometido = comprometidoPorObra.get(o.obraId) ?? 0;
                const pctBarra = o.totalComprado > 0 ? Math.min(100, (comprometido / o.totalComprado) * 100) : 0;
                const stCfg = STATUS_OBRA_CONFIG[o.obraStatus];
                return (
                  <button
                    key={o.obraId}
                    onClick={() => router.push(`/liberacao-fornecedor/${o.obraId}`)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-ber-bg/60 transition"
                  >
                    <Building2 size={16} className="text-ber-gray shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-ber-carbon truncate" title={o.obraNome}>{o.obraNome}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${stCfg.className}`}>{stCfg.label}</span>
                        {pendentes > 0 && (
                          <span className="shrink-0 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] text-center">
                            {pendentes}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-ber-gray shrink-0">
                          {o.qtdFornecedores} fornecedor{o.qtdFornecedores === 1 ? '' : 'es'} · <span className="font-medium text-ber-carbon tabular-nums">{BRL(o.totalComprado)}</span>
                        </p>
                        <div className="h-1.5 flex-1 max-w-40 rounded-full bg-ber-border/60 overflow-hidden">
                          <div className="h-full rounded-full bg-ber-olive transition-all" style={{ width: `${pctBarra}%` }} />
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-ber-gray/50 shrink-0" />
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
                            destaqueId === it.id ? 'border-ber-teal ring-2 ring-ber-teal/30' : 'border-ber-border'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-ber-carbon">{it.obraNome} <span className="text-ber-gray">·</span> {it.categoria}</p>
                              <p className="text-sm text-ber-gray">
                                {it.fornecedor ?? '—'} — {it.percentual.toFixed(1)}% = <span className="font-semibold tabular-nums text-ber-carbon">{BRL(it.valorAutorizado)}</span>
                              </p>
                              {it.observacoes && <p className="text-xs text-ber-gray/70 italic mt-0.5">{it.observacoes}</p>}
                              {it.motivoRecusa && <p className="text-xs text-red-600 mt-0.5">Recusa: {it.motivoRecusa}</p>}
                              {it.emailEnviadoEm && (
                                <p className="text-xs text-green-700 mt-0.5">✉️ enviado a {it.emailDestinatario} em {new Date(it.emailEnviadoEm).toLocaleString('pt-BR')}</p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_COR[it.status]}`}>{STATUS_LABEL[it.status]}</span>
                              {it.dataPagamento && (
                                <span className="flex items-center gap-1 rounded-md bg-ber-olive/15 px-2 py-1 text-xs font-bold text-ber-olive tabular-nums">
                                  📅 Pagamento {fmtData(it.dataPagamento)}
                                </span>
                              )}
                            </div>
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
    </div>
  );
}
