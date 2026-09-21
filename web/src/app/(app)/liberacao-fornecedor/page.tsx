'use client';

/**
 * Liberação de fornecedor p/ faturamento (21/09/26, pedido Bruno).
 * Engenharia solicita % sobre o valor comprado (Metas de Compra) → financeiro
 * aprova c/ data de pagamento → diretoria aprova → e-mail automático autoriza
 * o fornecedor. Recebido por e-mail com link (?id=) que abre direto no item.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send } from 'lucide-react';
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

interface Obra { id: string; name: string }

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

  const [itens, setItens] = useState<Item[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await api.get<{ data: Item[] }>('/liberacao-fornecedor');
      setItens(r.data.data);
    } catch {
      toast('Não consegui carregar as liberações', 'erro');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    api.get<{ data: Obra[] }>('/obras', { params: { limit: 200 } }).then((r) => setObras(r.data.data)).catch(() => {});
  }, [carregar]);

  // ── nova solicitação
  const [obraSel, setObraSel] = useState('');
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [itemSel, setItemSel] = useState('');
  const [pct, setPct] = useState('');
  const [obs, setObs] = useState('');

  useEffect(() => {
    if (!obraSel) { setOpcoes([]); setItemSel(''); return; }
    api.get<{ data: Opcao[] }>(`/obras/${obraSel}/liberacao-fornecedor/opcoes`)
      .then((r) => setOpcoes(r.data.data))
      .catch(() => toast('Não consegui carregar os itens de Metas de Compra dessa obra', 'erro'));
  }, [obraSel]);

  const itemAtual = opcoes.find((o) => o.comprasMetaId === itemSel);
  const valorPreview = itemAtual && pct ? (Number(pct.replace(',', '.')) / 100) * itemAtual.comprado : 0;

  async function solicitar() {
    setPending(true);
    try {
      await api.post(`/obras/${obraSel}/liberacao-fornecedor`, {
        comprasMetaId: itemSel,
        percentual: Number(pct.replace(',', '.')),
        observacoes: obs,
      });
      toast('Solicitação enviada — o financeiro foi avisado por e-mail.');
      setPct(''); setObs(''); setItemSel('');
      carregar();
    } catch (e) {
      toast(errMsg(e, 'Erro ao solicitar'), 'erro');
    } finally {
      setPending(false);
    }
  }

  const [dataPgto, setDataPgto] = useState<Record<string, string>>({});
  const [emailForn, setEmailForn] = useState<Record<string, string>>({});
  const [recusando, setRecusando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');

  async function aprovarFinanceiro(id: string) {
    setPending(true);
    try {
      await api.patch(`/liberacao-fornecedor/${id}/aprovar-financeiro`, { dataPagamento: dataPgto[id] });
      toast('Aprovado — a diretoria foi avisada por e-mail.');
      carregar();
    } catch (e) {
      toast(errMsg(e, 'Erro ao aprovar'), 'erro');
    } finally { setPending(false); }
  }

  async function aprovarDiretoria(id: string) {
    setPending(true);
    try {
      await api.patch(`/liberacao-fornecedor/${id}/aprovar-diretoria`, { email: emailForn[id] });
      toast('Aprovado — e-mail de autorização enviado ao fornecedor.');
      carregar();
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
      carregar();
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

      <section className="bg-white border border-ber-border rounded-xl p-4 mb-6">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-ber-gray mb-3">Nova solicitação</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={obraSel} onChange={(e) => setObraSel(e.target.value)} className="text-sm px-2 py-2 border border-ber-border rounded-lg bg-white">
            <option value="">Obra…</option>
            {obras.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select value={itemSel} onChange={(e) => setItemSel(e.target.value)} disabled={!obraSel} className="text-sm px-2 py-2 border border-ber-border rounded-lg bg-white disabled:opacity-50">
            <option value="">Item de Metas de Compra…</option>
            {opcoes.map((o) => (
              <option key={o.comprasMetaId} value={o.comprasMetaId} disabled={o.saldo <= 0.01}>
                {o.categoria}{o.fornecedor ? ` — ${o.fornecedor}` : ''} · saldo {BRL(o.saldo)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <input type="text" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="% desta liberação"
            className="w-40 text-sm px-2 py-2 border border-ber-border rounded-lg tabular-nums" />
          <input type="text" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observações (opcional)"
            className="flex-1 min-w-48 text-sm px-2 py-2 border border-ber-border rounded-lg" />
          {valorPreview > 0 && <span className="text-sm text-ber-gray tabular-nums">= {BRL(valorPreview)}</span>}
          <button disabled={pending || !itemSel || !pct} onClick={solicitar}
            className="rounded-lg bg-ber-carbon px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {pending ? '…' : 'Solicitar'}
          </button>
        </div>
      </section>

      {loading ? (
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
    </div>
  );
}
