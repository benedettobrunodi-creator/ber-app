'use client';

/**
 * Liberação de Medição (Bruno 10/09/26) — semáforo "pode medir?" por fornecedor.
 * A medição financeira acontece no app de medição; esta tela AUTORIZA: verde
 * libera, vermelho bloqueia (FVS pendente/não conformidade), com override de
 * exceção restrito a diretoria/coordenação e justificativa registrada.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Scale, ShieldCheck, ShieldAlert } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/lib/toast';

type Linha = {
  planoId: string;
  pacote: string;
  fornecedor: string | null;
  responsavel: string | null;
  status: 'liberado' | 'bloqueado' | 'liberado_excecao' | 'bloqueado_manual';
  motivos: string[];
  fichas: { id: string; titulo: string; trecho: string | null; status: string; prazo: string | null }[];
  override: { liberado: boolean; justificativa: string; por: string | null; em: string } | null;
};
type FichaSolta = { id: string; titulo: string; trecho: string | null; status: string };

const BADGE: Record<Linha['status'], { rotulo: string; cls: string }> = {
  liberado: { rotulo: '🟢 Liberado para medir', cls: 'bg-green-50 text-green-800 border-green-300' },
  liberado_excecao: { rotulo: '🟢 Liberado — exceção', cls: 'bg-green-50 text-green-800 border-green-300' },
  bloqueado: { rotulo: '🔴 Bloqueado', cls: 'bg-red-50 text-red-700 border-red-300' },
  bloqueado_manual: { rotulo: '🔴 Bloqueado — manual', cls: 'bg-red-50 text-red-700 border-red-300' },
};

export default function LiberacaoMedicaoPage() {
  const { id: obraId } = useParams<{ id: string }>();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [fichasSoltas, setFichasSoltas] = useState<FichaSolta[]>([]);
  const [obraNome, setObraNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [overrideAlvo, setOverrideAlvo] = useState<Linha | null>(null);
  const [overrideLiberar, setOverrideLiberar] = useState(true);
  const [justificativa, setJustificativa] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await api.get(`/obras/${obraId}/liberacao-medicao`);
      setLinhas(r.data.data?.linhas ?? []);
      setFichasSoltas(r.data.data?.fichasSemVinculo ?? []);
      setObraNome(r.data.data?.obra?.nome ?? '');
    } catch { toast('Não consegui carregar o painel — sem conexão?', 'erro'); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [obraId]); // eslint-disable-line react-hooks/exhaustive-deps

  const resumo = useMemo(() => {
    const lib = linhas.filter(l => l.status.startsWith('liberado')).length;
    return { lib, blo: linhas.length - lib };
  }, [linhas]);

  async function salvarOverride() {
    if (!overrideAlvo || justificativa.trim().length < 5) return;
    setSalvando(true); setErro('');
    try {
      await api.post(`/obras/${obraId}/liberacao-medicao/${overrideAlvo.planoId}/override`, {
        liberado: overrideLiberar, justificativa: justificativa.trim(),
      });
      setOverrideAlvo(null); setJustificativa('');
      await load();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setErro(msg ?? 'Não foi possível salvar (ação restrita à diretoria/coordenação).');
    } finally { setSalvando(false); }
  }

  async function removerOverride(l: Linha) {
    try { await api.delete(`/obras/${obraId}/liberacao-medicao/${l.planoId}/override`); await load(); }
    catch { toast('Remoção restrita à diretoria/coordenação', 'erro'); }
  }

  async function vincular(fvsId: string, planoId: string) {
    if (!planoId) return;
    try {
      await api.patch(`/obras/${obraId}/liberacao-medicao/fichas/${fvsId}/vinculo`, { planoId });
      toast('Ficha vinculada ✓');
      await load();
    } catch { toast('Não consegui vincular — tente de novo', 'erro'); }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon mb-4">
        <ArrowLeft size={16} /> Voltar à obra
      </Link>

      <div className="mb-2 flex items-center justify-between gap-2 flex-wrap">
        <h1 className="flex flex-wrap items-baseline gap-2 text-xl font-bold text-ber-carbon">
          <Scale size={20} className="text-ber-teal self-center" /> Liberação de Medição
          {obraNome && <span className="rounded-md bg-ber-carbon px-2 py-0.5 text-sm font-bold text-white">{obraNome}</span>}
        </h1>
        {linhas.length > 0 && (
          <p className="text-sm text-ber-gray"><b className="text-green-700">{resumo.lib} liberado(s)</b> · <b className="text-red-700">{resumo.blo} bloqueado(s)</b></p>
        )}
      </div>
      <p className="mb-5 text-xs text-ber-gray max-w-2xl">
        Consulta obrigatória do financeiro antes de lançar a % dos fornecedores no app de medição.
        O status vem da Qualidade: FVS pendente ou não conformidade aberta bloqueia. Exceções: só diretoria/coordenação, com justificativa registrada.
      </p>

      {loading ? (
        <p className="text-sm text-ber-gray">Carregando…</p>
      ) : linhas.length === 0 ? (
        <div className="rounded-xl border border-ber-border bg-white p-6 text-sm text-ber-gray">
          Nenhum pacote contratado no Cronograma de Contratações desta obra ainda — o semáforo nasce de lá.
        </div>
      ) : (
        <div className="space-y-3">
          {linhas.map((l) => (
            <div key={l.planoId} className="rounded-xl border border-ber-border bg-white p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-[220px]">
                  <p className="text-sm font-bold text-ber-carbon">{l.pacote}</p>
                  <p className="text-xs text-ber-gray">{l.fornecedor ?? 'fornecedor não informado'}{l.responsavel ? ` · resp. ${l.responsavel}` : ''}</p>
                </div>
                <span className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${BADGE[l.status].cls}`}>{BADGE[l.status].rotulo}</span>
              </div>

              {l.motivos.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {l.motivos.map((m, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-red-700"><ShieldAlert size={13} className="mt-0.5 shrink-0" /> {m}</li>
                  ))}
                </ul>
              )}
              {l.motivos.length === 0 && l.status === 'liberado' && l.fichas.length > 0 && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-green-700"><ShieldCheck size={13} /> {l.fichas.length} ficha(s) de verificação em dia</p>
              )}
              {l.override && (
                <p className="mt-2 text-xs text-ber-gray bg-ber-surface rounded-lg px-3 py-2">
                  Override de {l.override.por ?? '—'} em {new Date(l.override.em).toLocaleDateString('pt-BR')}: “{l.override.justificativa}”
                  <button onClick={() => removerOverride(l)} className="ml-2 text-red-600 hover:underline">remover</button>
                </p>
              )}

              <div className="mt-3">
                <button onClick={() => { setOverrideAlvo(l); setOverrideLiberar(l.status.startsWith('bloqueado')); setJustificativa(''); setErro(''); }}
                  className="rounded-lg border border-ber-border px-3 py-1.5 text-xs font-semibold text-ber-carbon hover:bg-ber-surface">
                  {l.status.startsWith('bloqueado') ? 'Liberar excepcionalmente…' : 'Bloquear manualmente…'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {fichasSoltas.length > 0 && linhas.length > 0 && (
        <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-800">Fichas de verificação sem fornecedor vinculado ({fichasSoltas.length})</p>
          <p className="mt-0.5 text-xs text-amber-700">Sem o vínculo, a ficha não trava a medição de ninguém. Aponte de qual pacote/fornecedor é cada uma:</p>
          <div className="mt-3 space-y-2">
            {fichasSoltas.map((f) => (
              <div key={f.id} className="flex items-center gap-2 flex-wrap text-xs text-ber-carbon">
                <span className="font-semibold">{f.titulo}{f.trecho ? ` (${f.trecho})` : ''}</span>
                <span className={f.status === 'pendente' ? 'text-amber-700' : 'text-green-700'}>· {f.status}</span>
                <select defaultValue="" onChange={(e) => vincular(f.id, e.target.value)}
                  className="rounded border border-ber-border bg-white px-2 py-1 text-xs">
                  <option value="" disabled>vincular ao pacote…</option>
                  {linhas.map((l) => <option key={l.planoId} value={l.planoId}>{l.pacote}{l.fornecedor ? ` — ${l.fornecedor}` : ''}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {overrideAlvo && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={() => setOverrideAlvo(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-ber-carbon">{overrideLiberar ? 'Liberar excepcionalmente' : 'Bloquear manualmente'}</p>
            <p className="mt-0.5 mb-3 text-xs text-ber-gray">{overrideAlvo.pacote}{overrideAlvo.fornecedor ? ` — ${overrideAlvo.fornecedor}` : ''} · ação restrita à diretoria/coordenação, registrada com teu nome. Vale por um ciclo (31 dias).</p>
            <textarea rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Justificativa (obrigatória)"
              className="w-full rounded-lg border border-ber-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ber-teal" />
            {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
            <div className="mt-3 flex gap-2">
              <button disabled={salvando || justificativa.trim().length < 5} onClick={salvarOverride}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50 ${overrideLiberar ? 'bg-green-700 hover:brightness-110' : 'bg-red-700 hover:brightness-110'}`}>
                {salvando ? 'Salvando…' : overrideLiberar ? 'Confirmar liberação' : 'Confirmar bloqueio'}
              </button>
              <button onClick={() => setOverrideAlvo(null)} className="rounded-lg border border-ber-border px-4 py-2 text-sm text-ber-carbon hover:bg-ber-surface">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
