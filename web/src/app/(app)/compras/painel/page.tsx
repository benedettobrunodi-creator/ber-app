'use client';

/**
 * Painel de Gestão de Compras — página DEDICADA (Bruno 24/09/26: "queria uma
 * página só de dados, não junto com a de Metas"). Visão CFO/CEO: financeiro
 * resumido (do /summary) + processo (do /gestao). Tudo calculado ao vivo de
 * dados existentes; obras ativas por padrão.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, AlertTriangle, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

interface Totais {
  totalVendaBruta: number;
  totalMeta: number;
  totalComprado: number;
  okSavingMeta: number;
  okSavingMetaPct: number;
  pendMeta: number;
  projecaoSaving: number;
}

interface ObraSummary {
  obraId: string;
  obraName: string;
  indicadores: { totalMeta: number; totalComprado: number; okSavingMeta: number };
}

interface GestaoData {
  contratacoes: {
    contratados: number; emCotacao: number; aContratar: number; atrasados: number;
    atrasadosPorObra: { obraId: string; obraNome: string; qtd: number }[];
  };
  medicao: { filaValor: number; filaQtd: number; autorizadoMes: number; autorizadoMesQtd: number; leadTimeMedioDias: number | null; agingDias: number | null };
  fornecedores: { top: { nome: string; valor: number; pct: number }[]; total: number; semEmail: number; pctForaCadastro: number };
  analise: {
    estouros: { obraId: string; obraNome: string; categoria: string; descritivo: string | null; meta: number; venda: number; comprado: number; estouro: number; acimaVenda: boolean }[];
    totalEstouros: number;
    valorTotalEstouros: number;
    exposicoes: { obraId: string; obraNome: string; categoria: string; meta: number }[];
    disciplinas: { nome: string; meta: number; comprado: number; itens: number; saving: number; savingPct: number }[];
  };
}

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

const STATUS_ATIVAS = 'nao_iniciada,planejamento,em_andamento,pos_obra,pausada';

export default function PainelComprasPage() {
  const [totais, setTotais] = useState<Totais | null>(null);
  const [obras, setObras] = useState<ObraSummary[]>([]);
  const [gestao, setGestao] = useState<GestaoData | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<{ data: { totais: Totais; obras: ObraSummary[] } }>(`/compras-dashboard/summary?status=${STATUS_ATIVAS}`),
      api.get<{ data: GestaoData }>('/compras-dashboard/gestao'),
    ])
      .then(([s, g]) => {
        setTotais(s.data.data.totais);
        setObras(s.data.data.obras);
        setGestao(g.data.data);
      })
      .catch(() => setErro(true));
  }, []);

  if (erro) {
    return <div className="p-6"><div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">Não consegui carregar o painel. Recarregue a página.</div></div>;
  }
  if (!totais || !gestao) {
    return <div className="p-6 text-center text-sm text-ber-gray">Carregando painel…</div>;
  }

  const consumidoPct = totais.totalMeta > 0 ? (totais.totalComprado / totais.totalMeta) * 100 : 0;
  const pioresObras = [...obras]
    .sort((a, b) => a.indicadores.okSavingMeta - b.indicadores.okSavingMeta)
    .slice(0, 5);

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <h1 className="flex items-center gap-2 text-xl font-black text-ber-carbon mb-1">
        <LayoutDashboard size={20} className="text-ber-teal" /> Painel de Gestão · Compras
      </h1>
      <p className="mb-6 text-xs text-ber-gray">Obras ativas · calculado ao vivo · detalhes em <Link href="/compras" className="text-ber-teal underline">Metas de Compra</Link></p>

      {/* ── FINANCEIRO ── */}
      <p className="text-[11px] font-bold uppercase tracking-wider text-ber-gray mb-2">Financeiro</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
        <div className="rounded-xl bg-white border border-ber-gray/15 p-5 shadow-sm">
          <p className="text-[10px] font-medium text-ber-gray uppercase tracking-wide">Meta de compras</p>
          <p className="mt-1 text-2xl font-black text-ber-carbon">{BRL(totais.totalMeta)}</p>
          <p className="text-xs text-ber-gray mt-1">sobre {BRL(totais.totalVendaBruta)} vendidos</p>
        </div>
        <div className="rounded-xl bg-white border border-ber-gray/15 p-5 shadow-sm">
          <p className="text-[10px] font-medium text-ber-gray uppercase tracking-wide">Comprado</p>
          <p className="mt-1 text-2xl font-black text-ber-carbon">{BRL(totais.totalComprado)}</p>
          <p className="text-xs text-ber-gray mt-1">{consumidoPct.toFixed(0)}% da meta consumida</p>
        </div>
        <div className={`rounded-xl p-5 shadow-sm border ${totais.okSavingMeta >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <p className={`text-[10px] font-medium uppercase tracking-wide ${totais.okSavingMeta >= 0 ? 'text-green-700' : 'text-red-600'}`}>Saving vs meta</p>
          <p className={`mt-1 text-2xl font-black ${totais.okSavingMeta >= 0 ? 'text-green-700' : 'text-red-600'}`}>{BRL(totais.okSavingMeta)}</p>
          <p className="text-xs text-ber-gray mt-1">{totais.okSavingMeta >= 0 ? 'dentro da meta' : '⚠ acima da meta'} · proj. final {BRL(totais.projecaoSaving)}</p>
        </div>
        <div className="rounded-xl bg-white border border-ber-gray/15 p-5 shadow-sm">
          <p className="text-[10px] font-medium text-ber-gray uppercase tracking-wide">Exposição a comprar</p>
          <p className="mt-1 text-2xl font-black text-ber-carbon">{BRL(totais.pendMeta)}</p>
          <p className="text-xs text-ber-gray mt-1">meta dos itens ainda não comprados (caixa futuro)</p>
        </div>
      </div>

      {/* ── PROCESSO ── */}
      <p className="text-[11px] font-bold uppercase tracking-wider text-ber-gray mb-2">Processo</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 mb-6">
        <div className={`rounded-xl p-5 shadow-sm border ${gestao.contratacoes.atrasados > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-ber-gray/15'}`}>
          <p className="text-[10px] font-medium text-ber-gray uppercase tracking-wide">Contratações</p>
          <p className={`mt-1 text-2xl font-black ${gestao.contratacoes.atrasados > 0 ? 'text-red-600' : 'text-ber-carbon'}`}>
            {gestao.contratacoes.atrasados > 0 ? <><AlertTriangle size={18} className="inline mr-1 -mt-1" />{gestao.contratacoes.atrasados} atrasadas</> : 'em dia'}
          </p>
          <p className="text-xs text-ber-gray mt-1">{gestao.contratacoes.contratados} contratadas · {gestao.contratacoes.emCotacao} em cotação · {gestao.contratacoes.aContratar} a contratar</p>
          {gestao.contratacoes.atrasadosPorObra.slice(0, 3).map(o => (
            <p key={o.obraId} className="text-[11px] text-red-700 truncate mt-0.5" title={o.obraNome}>⚠ {o.obraNome}: {o.qtd}</p>
          ))}
        </div>
        <div className={`rounded-xl p-5 shadow-sm border ${gestao.medicao.filaQtd > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-ber-gray/15'}`}>
          <p className="text-[10px] font-medium text-ber-gray uppercase tracking-wide">Fila de aprovação (Medição)</p>
          <p className={`mt-1 text-2xl font-black ${gestao.medicao.filaQtd > 0 ? 'text-amber-700' : 'text-ber-carbon'}`}>{BRL(gestao.medicao.filaValor)}</p>
          <p className="text-xs text-ber-gray mt-1">
            {gestao.medicao.filaQtd} solicitaç{gestao.medicao.filaQtd === 1 ? 'ão' : 'ões'} aguardando
            {gestao.medicao.agingDias !== null && gestao.medicao.agingDias >= 1 && <span className="text-amber-800 font-medium"> · mais antiga há {Math.round(gestao.medicao.agingDias)} dia{gestao.medicao.agingDias >= 1.5 ? 's' : ''}</span>}
            {' · '}<Link href="/liberacao-fornecedor" className="text-ber-teal underline">abrir fila</Link>
          </p>
        </div>
        <div className="rounded-xl bg-white border border-ber-gray/15 p-5 shadow-sm">
          <p className="text-[10px] font-medium text-ber-gray uppercase tracking-wide">Autorizado no mês</p>
          <p className="mt-1 text-2xl font-black text-ber-carbon">{BRL(gestao.medicao.autorizadoMes)}</p>
          <p className="text-xs text-ber-gray mt-1">
            {gestao.medicao.autorizadoMesQtd} autorizaç{gestao.medicao.autorizadoMesQtd === 1 ? 'ão' : 'ões'}
            {gestao.medicao.leadTimeMedioDias !== null && <> · lead time {gestao.medicao.leadTimeMedioDias < 1 ? '<1 dia' : `${Math.round(gestao.medicao.leadTimeMedioDias)} dia${gestao.medicao.leadTimeMedioDias >= 1.5 ? 's' : ''}`}</>}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── OBRAS: piores desvios ── */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ber-gray mb-2">Obras — atenção (pior saving vs meta)</p>
          <div className="bg-white border border-ber-border rounded-xl divide-y divide-ber-border/60">
            {pioresObras.map(o => {
              const i = o.indicadores;
              const pct = i.totalMeta > 0 ? Math.min(100, (i.totalComprado / i.totalMeta) * 100) : 0;
              const estourou = i.okSavingMeta < 0;
              return (
                <Link key={o.obraId} href={`/obras/${o.obraId}/compras`} className="flex items-center gap-3 px-4 py-3 hover:bg-ber-bg/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <p className="text-sm font-semibold text-ber-carbon truncate" title={o.obraName}>{o.obraName}</p>
                      <p className={`text-sm font-bold tabular-nums shrink-0 ${estourou ? 'text-red-600' : 'text-green-700'}`}>{BRL(i.okSavingMeta)}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[11px] text-ber-gray shrink-0 tabular-nums">{BRL(i.totalComprado)} de {BRL(i.totalMeta)}</p>
                      <div className="h-1.5 flex-1 rounded-full bg-ber-border/60 overflow-hidden">
                        <div className={`h-full rounded-full ${estourou ? 'bg-red-500' : pct >= 85 ? 'bg-amber-400' : 'bg-ber-olive'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-ber-gray/50 shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── FORNECEDORES: concentração ── */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ber-gray mb-2">
            Fornecedores — concentração do comprado
            {gestao.fornecedores.semEmail > 0 && <span className="text-amber-700 normal-case font-medium"> · {gestao.fornecedores.semEmail} sem e-mail no cadastro</span>}
            {gestao.fornecedores.pctForaCadastro > 0.05 && <span className="text-amber-700 normal-case font-medium"> · {(gestao.fornecedores.pctForaCadastro * 100).toFixed(0)}% do comprado sem fornecedor do cadastro</span>}
          </p>
          <div className="bg-white border border-ber-border rounded-xl p-4 space-y-2.5">
            {gestao.fornecedores.top.map(f => (
              <div key={f.nome}>
                <div className="flex justify-between text-xs">
                  <span className="truncate text-ber-carbon font-medium" title={f.nome}>{f.nome}</span>
                  <span className="text-ber-gray tabular-nums shrink-0 ml-2">{BRL(f.valor)} · {(f.pct * 100).toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-ber-border/60 overflow-hidden mt-0.5">
                  <div className="h-full rounded-full bg-ber-olive" style={{ width: `${Math.min(100, f.pct * 100)}%` }} />
                </div>
              </div>
            ))}
            {gestao.fornecedores.top.length === 0 && <p className="text-sm text-ber-gray">Sem compras registradas.</p>}
          </div>
        </div>
      </div>

      {/* ── ANÁLISE (Bruno 25/09/26: estouros + margens por disciplina + exposições) ── */}
      <p className="text-[11px] font-bold uppercase tracking-wider text-ber-gray mt-8 mb-2">Análise</p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Principais estouros */}
        <div>
          <p className="text-xs font-semibold text-ber-carbon mb-2">
            Principais estouros — comprado acima da meta do item
            {gestao.analise.totalEstouros > 0 && <span className="text-ber-gray font-normal"> · {gestao.analise.totalEstouros} it{gestao.analise.totalEstouros === 1 ? 'em' : 'ens'} · {BRL(gestao.analise.valorTotalEstouros)} no total</span>}
          </p>
          <div className="bg-white border border-ber-border rounded-xl divide-y divide-ber-border/60">
            {gestao.analise.estouros.map(e => (
              <Link key={`${e.obraId}-${e.categoria}-${e.descritivo ?? ''}`} href={`/obras/${e.obraId}/compras`} className="block px-4 py-2.5 hover:bg-ber-bg/40">
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-medium text-ber-carbon truncate" title={`${e.categoria}${e.descritivo ? ` — ${e.descritivo}` : ''}`}>
                    {e.categoria}{e.descritivo ? <span className="text-ber-gray font-normal"> — {e.descritivo}</span> : null}
                  </p>
                  <p className="text-sm font-bold tabular-nums shrink-0 text-red-600">+{BRL(e.estouro)}</p>
                </div>
                <p className="text-[11px] text-ber-gray mt-0.5 tabular-nums">
                  {e.obraNome} · meta {BRL(e.meta)} → comprado {BRL(e.comprado)}
                  {e.acimaVenda && <span className="text-red-700 font-semibold"> · ⚠ acima da venda ({BRL(e.venda)}) — comeu margem do contrato</span>}
                </p>
              </Link>
            ))}
            {gestao.analise.estouros.length === 0 && <p className="px-4 py-3 text-sm text-ber-gray">Nenhum item comprado acima da meta. 👏</p>}
          </div>
        </div>

        {/* Maiores exposições individuais */}
        <div>
          <p className="text-xs font-semibold text-ber-carbon mb-2">Maiores exposições — itens relevantes ainda não comprados</p>
          <div className="bg-white border border-ber-border rounded-xl divide-y divide-ber-border/60">
            {gestao.analise.exposicoes.map(e => (
              <Link key={`${e.obraId}-${e.categoria}`} href={`/obras/${e.obraId}/compras`} className="flex justify-between gap-2 px-4 py-2.5 hover:bg-ber-bg/40">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ber-carbon truncate" title={e.categoria}>{e.categoria}</p>
                  <p className="text-[11px] text-ber-gray truncate">{e.obraNome}</p>
                </div>
                <p className="text-sm font-bold tabular-nums shrink-0 text-ber-carbon self-center">{BRL(e.meta)}</p>
              </Link>
            ))}
            {gestao.analise.exposicoes.length === 0 && <p className="px-4 py-3 text-sm text-ber-gray">Tudo comprado — sem exposição pendente.</p>}
          </div>
          <p className="text-[11px] text-ber-gray mt-1.5">Onde a negociação tem mais impacto daqui pra frente.</p>
        </div>
      </div>

      {/* Margens por disciplina */}
      <div className="mt-6 mb-2">
        <p className="text-xs font-semibold text-ber-carbon mb-2">Margens de negociação por disciplina — saving realizado (todas as obras ativas)</p>
        <div className="bg-white border border-ber-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-ber-gray border-b border-ber-border/60">
                <th className="text-left px-4 py-2 font-medium">Disciplina</th>
                <th className="text-right px-3 py-2 font-medium">Itens</th>
                <th className="text-right px-3 py-2 font-medium">Meta</th>
                <th className="text-right px-3 py-2 font-medium">Comprado</th>
                <th className="text-right px-4 py-2 font-medium">Saving</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ber-border/40">
              {gestao.analise.disciplinas.map(d => (
                <tr key={d.nome}>
                  <td className="px-4 py-2 font-medium text-ber-carbon">{d.nome}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ber-gray">{d.itens}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ber-gray">{BRL(d.meta)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ber-gray">{BRL(d.comprado)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums font-bold ${d.saving >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {BRL(d.saving)} <span className="font-medium text-xs">({d.savingPct >= 0 ? '' : '−'}{Math.abs(d.savingPct).toFixed(1)}%)</span>
                  </td>
                </tr>
              ))}
              {gestao.analise.disciplinas.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-3 text-ber-gray">Ainda sem compras suficientes para ranquear disciplinas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-ber-gray mt-1.5">Disciplinas no topo negociam melhor que a meta; no fim da lista, retorno pro orçamento revisar os percentuais.</p>
      </div>
    </div>
  );
}
