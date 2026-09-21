'use client';

/**
 * Liberação de Medição — painel GERAL (Bruno 21/09/26): antes só dava pra ver
 * o semáforo "pode medir?" entrando em cada obra. Aqui é a visão de todas
 * juntas, ordenada por quem tem mais bloqueio — clica e vai pra tela da obra
 * (que já faz override/vínculo de ficha).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Scale, ShieldAlert, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/lib/toast';

type StatusLiberacao = 'liberado' | 'bloqueado' | 'aguardando_execucao' | 'liberado_excecao' | 'bloqueado_manual';

type Linha = {
  planoId: string;
  pacote: string;
  fornecedor: string | null;
  status: StatusLiberacao;
  motivos: string[];
};

type ObraPainel = {
  obra: { id: string; nome: string };
  linhas: Linha[];
  resumo: { bloqueados: number; aguardando: number; liberados: number; total: number };
};

type Resposta = {
  obras: ObraPainel[];
  totais: { bloqueados: number; aguardando: number; liberados: number };
};

const BADGE: Record<StatusLiberacao, { rotulo: string; cls: string }> = {
  liberado: { rotulo: '🟢 Liberado', cls: 'bg-green-50 text-green-800 border-green-300' },
  aguardando_execucao: { rotulo: '⏳ Aguardando', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
  liberado_excecao: { rotulo: '🟢 Exceção', cls: 'bg-green-50 text-green-800 border-green-300' },
  bloqueado: { rotulo: '🔴 Bloqueado', cls: 'bg-red-50 text-red-700 border-red-300' },
  bloqueado_manual: { rotulo: '🔴 Manual', cls: 'bg-red-50 text-red-700 border-red-300' },
};

export default function LiberacaoMedicaoGeralPage() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [obrasAbertas, setObrasAbertas] = useState<Set<string>>(new Set());
  const [soComBloqueio, setSoComBloqueio] = useState(false);

  async function carregar() {
    setLoading(true);
    setErro(false);
    try {
      const r = await api.get<{ data: Resposta }>('/liberacao-medicao');
      setDados(r.data.data);
      // abre por padrão as obras que têm bloqueio
      setObrasAbertas(new Set(r.data.data.obras.filter((o) => o.resumo.bloqueados > 0).map((o) => o.obra.id)));
    } catch {
      setErro(true);
      toast('Não consegui carregar o painel — sem conexão?', 'erro');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(obraId: string) {
    setObrasAbertas((prev) => {
      const next = new Set(prev);
      if (next.has(obraId)) next.delete(obraId);
      else next.add(obraId);
      return next;
    });
  }

  const obrasFiltradas = dados?.obras.filter((o) => !soComBloqueio || o.resumo.bloqueados > 0) ?? [];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
        <h1 className="flex flex-wrap items-baseline gap-2 text-xl font-bold text-ber-carbon">
          <Scale size={20} className="text-ber-teal self-center" /> Liberação de Medição
        </h1>
        {dados && (
          <p className="text-sm text-ber-gray">
            <b className="text-green-700">{dados.totais.liberados} liberado(s)</b> ·{' '}
            <b className="text-amber-700">{dados.totais.aguardando} aguardando</b> ·{' '}
            <b className="text-red-700">{dados.totais.bloqueados} bloqueado(s)</b>
          </p>
        )}
      </div>
      <p className="mb-4 text-xs text-ber-gray max-w-2xl">
        Semáforo de qualidade por fornecedor, todas as obras juntas — clique numa obra pra ver o detalhe e liberar exceções.
        FVS pendente ou não conformidade aberta bloqueia; consulta obrigatória do financeiro antes de lançar a % no app de medição.
      </p>

      {!loading && dados && dados.totais.bloqueados > 0 && (
        <label className="mb-4 flex items-center gap-2 text-xs text-ber-carbon">
          <input type="checkbox" checked={soComBloqueio} onChange={(e) => setSoComBloqueio(e.target.checked)} />
          Mostrar só obras com bloqueio
        </label>
      )}

      {loading ? (
        <p className="text-sm text-ber-gray">Carregando…</p>
      ) : erro ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Não consegui carregar o painel.{' '}
          <button onClick={carregar} className="font-semibold underline hover:no-underline">Tentar de novo</button>
        </div>
      ) : obrasFiltradas.length === 0 ? (
        <div className="rounded-xl border border-ber-border bg-white p-6 text-sm text-ber-gray">
          {soComBloqueio ? 'Nenhuma obra com bloqueio no momento. 🎉' : 'Nenhum pacote contratado com semáforo ainda.'}
        </div>
      ) : (
        <div className="space-y-3">
          {obrasFiltradas.map((o) => {
            const aberta = obrasAbertas.has(o.obra.id);
            return (
              <div key={o.obra.id} className="rounded-xl border border-ber-border bg-white overflow-hidden">
                <button
                  onClick={() => toggle(o.obra.id)}
                  className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-ber-surface"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronRight size={16} className={`shrink-0 text-ber-gray transition-transform ${aberta ? 'rotate-90' : ''}`} />
                    <p className="text-sm font-bold text-ber-carbon truncate">{o.obra.nome}</p>
                  </div>
                  <p className="shrink-0 text-xs text-ber-gray">
                    {o.resumo.liberados > 0 && <span className="text-green-700">{o.resumo.liberados}🟢</span>}
                    {o.resumo.aguardando > 0 && <span className="ml-1.5 text-amber-700">{o.resumo.aguardando}⏳</span>}
                    {o.resumo.bloqueados > 0 && <span className="ml-1.5 font-bold text-red-700">{o.resumo.bloqueados}🔴</span>}
                  </p>
                </button>

                {aberta && (
                  <div className="border-t border-ber-border divide-y divide-ber-border/60">
                    {o.linhas.map((l) => (
                      <div key={l.planoId} className="flex items-start justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ber-carbon truncate">{l.pacote}</p>
                          <p className="text-xs text-ber-gray truncate">{l.fornecedor ?? 'fornecedor não informado'}</p>
                          {l.motivos.length > 0 && (
                            <p className="mt-1 flex items-start gap-1 text-[11px] text-red-700">
                              <ShieldAlert size={12} className="mt-0.5 shrink-0" /> {l.motivos[0]}
                              {l.motivos.length > 1 && ` (+${l.motivos.length - 1})`}
                            </p>
                          )}
                        </div>
                        <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-bold ${BADGE[l.status].cls}`}>
                          {BADGE[l.status].rotulo}
                        </span>
                      </div>
                    ))}
                    <Link
                      href={`/obras/${o.obra.id}/liberacao-medicao`}
                      className="flex items-center justify-center gap-1.5 p-3 text-xs font-semibold text-ber-teal hover:bg-ber-surface"
                    >
                      Abrir na obra pra liberar/bloquear <ChevronRight size={13} />
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
