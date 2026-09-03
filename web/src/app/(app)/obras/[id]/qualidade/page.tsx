'use client';

/**
 * Durante a Obra · Qualidade (03/09/26).
 * Digitaliza o "Checklist MODELO.xlsx" do Bruno: vistoria Sim/Não/N/A por
 * categoria, score 0–5 ponderado calculado em código (regras do modelo:
 * N/A fora do denominador, pesos por categoria), scorecard com evolução,
 * itens "Não" viram pendências até serem resolvidos.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, X, ClipboardCheck, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { confirmar } from '@/lib/confirmar';

// ─── Tipos ───
interface TemplateItem { key: string; texto: string }
interface TemplateCategoria { key: string; nome: string; peso: number; itens: TemplateItem[] }

interface ResumoCategoria {
  key: string; nome: string; peso: number;
  sim: number; nao: number; na: number;
  conformidade: number | null; nota: number | null;
}

interface Vistoria {
  id: string;
  data: string;
  notaFinal: string | number;
  classificacao: string;
  resumo: ResumoCategoria[];
  observacoes: string | null;
  vistoriador: { id: string; name: string } | null;
}

interface Pendencia {
  id: string;
  categoriaKey: string;
  itemKey: string;
  texto: string;
  observacao: string | null;
  vistoria: { id: string; data: string };
}

const CLASSIF: Record<string, { label: string; text: string; bg: string }> = {
  excelente:   { label: 'Excelente',        text: 'text-ber-green',  bg: 'bg-ber-green/10' },
  boa:         { label: 'Boa conformidade', text: 'text-[#5E6B0F]', bg: 'bg-ber-olive/15' },
  regular:     { label: 'Regular',          text: 'text-amber-700',  bg: 'bg-amber-100' },
  critico:     { label: 'Crítico',          text: 'text-orange-700', bg: 'bg-orange-100' },
  inaceitavel: { label: 'Inaceitável',      text: 'text-red-700',    bg: 'bg-red-100' },
};

const fmtNota = (n: number) => n.toFixed(2).replace('.', ',');
const fmtBR = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

type Resposta = 'sim' | 'nao' | 'na';

export default function QualidadePage() {
  const { id: obraId } = useParams<{ id: string }>();
  const [obraNome, setObraNome] = useState('');
  const [template, setTemplate] = useState<TemplateCategoria[]>([]);
  const [vistorias, setVistorias] = useState<Vistoria[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [loading, setLoading] = useState(true);

  // Preenchimento
  const [preenchendo, setPreenchendo] = useState(false);
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({}); // `${catKey}:${itemKey}`
  const [obs, setObs] = useState<Record<string, string>>({});
  const [obsGeral, setObsGeral] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Vistoria | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [t, p, o] = await Promise.all([
        api.get(`/obras/${obraId}/qualidade/template`),
        api.get(`/obras/${obraId}/qualidade`),
        api.get(`/obras/${obraId}`).catch(() => null),
      ]);
      setTemplate(t.data.data ?? []);
      setVistorias(p.data.data?.vistorias ?? []);
      setPendencias(p.data.data?.pendencias ?? []);
      if (o) setObraNome(o.data.data?.name ?? '');
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [obraId]);

  const totalItens = useMemo(() => template.reduce((acc, c) => acc + c.itens.length, 0), [template]);
  const respondidos = Object.keys(respostas).length;
  const naosSemObs = useMemo(() =>
    Object.entries(respostas).filter(([k, r]) => r === 'nao' && !(obs[k] ?? '').trim()).length,
  [respostas, obs]);

  function iniciarVistoria() {
    setRespostas({});
    setObs({});
    setObsGeral('');
    setResultado(null);
    setPreenchendo(true);
    window.scrollTo({ top: 0 });
  }

  async function enviarVistoria() {
    if (respondidos === 0) { alert('Responda ao menos um item'); return; }
    if (naosSemObs > 0) { alert(`${naosSemObs} item(ns) marcados "Não" sem observação — descreva o que precisa ser corrigido`); return; }
    if (respondidos < totalItens && !(await confirmar(
      `${totalItens - respondidos} item(ns) ficaram em branco e não entram no cálculo. Enviar assim mesmo?`,
      { titulo: 'Itens em branco', confirmarLabel: 'Enviar' },
    ))) return;
    setEnviando(true);
    try {
      const payload = {
        respostas: Object.entries(respostas).map(([k, resposta]) => {
          const [categoriaKey, itemKey] = k.split(':');
          return { categoriaKey, itemKey, resposta, observacao: (obs[k] ?? '').trim() || null };
        }),
        observacoes: obsGeral.trim() || null,
      };
      const r = await api.post(`/obras/${obraId}/qualidade`, payload);
      setResultado(r.data.data);
      setPreenchendo(false);
      load();
    } catch (e) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      alert(m || 'Erro ao enviar vistoria');
    } finally {
      setEnviando(false);
    }
  }

  async function resolver(p: Pendencia) {
    try {
      await api.patch(`/obras/${obraId}/qualidade/pendencias/${p.id}`, { resolvido: true });
      setPendencias(prev => prev.filter(x => x.id !== p.id));
    } catch { alert('Erro ao resolver pendência'); }
  }

  async function excluirVistoria(v: Vistoria) {
    if (!(await confirmar(`Excluir a vistoria de ${fmtBR(v.data)} (nota ${fmtNota(Number(v.notaFinal))})?`, { confirmarLabel: 'Excluir' }))) return;
    try {
      await api.delete(`/obras/${obraId}/qualidade/vistorias/${v.id}`);
      load();
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      alert(status === 403 ? 'Excluir vistoria exige coordenação ou acima.' : 'Erro ao excluir');
    }
  }

  const ultima = vistorias[0] ?? null;

  // ─── Modo preenchimento ───
  if (preenchendo) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="flex items-baseline gap-2 text-xl font-bold text-ber-carbon flex-wrap">
            Vistoria de Qualidade
            {obraNome && <span className="rounded-md bg-ber-carbon px-2 py-0.5 text-sm font-bold text-white">{obraNome}</span>}
          </h1>
          <button onClick={() => setPreenchendo(false)} className="text-ber-gray hover:text-ber-carbon shrink-0"><X size={20} /></button>
        </div>

        <div className="sticky top-0 z-10 -mx-4 md:-mx-6 mb-4 border-b border-ber-border bg-white/95 px-4 md:px-6 py-2.5 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ber-gray"><span className="font-bold text-ber-carbon">{respondidos}</span> de {totalItens} respondidos{naosSemObs > 0 && <span className="text-red-600 font-semibold"> · {naosSemObs} "Não" sem observação</span>}</p>
            <button onClick={enviarVistoria} disabled={enviando}
              className="rounded-lg bg-ber-olive px-4 py-1.5 text-sm font-semibold text-ber-carbon hover:brightness-95 disabled:opacity-60">
              {enviando ? 'Enviando…' : 'Concluir vistoria'}
            </button>
          </div>
        </div>

        <div className="space-y-5">
          {template.map(cat => {
            const catRespondidos = cat.itens.filter(i => respostas[`${cat.key}:${i.key}`]).length;
            return (
              <div key={cat.key} className="rounded-xl border border-ber-border bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-ber-border bg-ber-surface px-4 py-2.5">
                  <p className="text-sm font-bold text-ber-carbon">{cat.nome}</p>
                  <p className="text-[11px] text-ber-gray">peso {Math.round(cat.peso * 100)}% · {catRespondidos}/{cat.itens.length}</p>
                </div>
                <div className="divide-y divide-ber-border/60">
                  {cat.itens.map(item => {
                    const k = `${cat.key}:${item.key}`;
                    const r = respostas[k];
                    return (
                      <div key={k} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <p className="text-sm text-ber-carbon flex-1 min-w-[200px]"><span className="text-ber-gray/60 text-xs mr-1.5">{item.key}</span>{item.texto}</p>
                          <div className="flex rounded-lg border border-ber-border overflow-hidden shrink-0">
                            {(['sim', 'nao', 'na'] as Resposta[]).map(opt => (
                              <button key={opt}
                                onClick={() => setRespostas(prev => {
                                  const next = { ...prev };
                                  if (next[k] === opt) delete next[k]; else next[k] = opt;
                                  return next;
                                })}
                                className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                                  r === opt
                                    ? opt === 'sim' ? 'bg-ber-green text-white' : opt === 'nao' ? 'bg-red-600 text-white' : 'bg-ber-gray text-white'
                                    : 'bg-white text-ber-gray hover:bg-ber-surface'
                                }`}>
                                {opt === 'sim' ? 'Sim' : opt === 'nao' ? 'Não' : 'N/A'}
                              </button>
                            ))}
                          </div>
                        </div>
                        {r === 'nao' && (
                          <input
                            className="mt-2 w-full rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-400"
                            placeholder="O que precisa ser corrigido? (obrigatório)"
                            value={obs[k] ?? ''}
                            onChange={e => setObs(prev => ({ ...prev, [k]: e.target.value }))}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="rounded-xl border border-ber-border bg-white p-4">
            <label className="mb-1 block text-xs font-medium text-ber-carbon">Observações gerais da vistoria (opcional)</label>
            <textarea className="w-full rounded-lg border border-ber-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ber-teal" rows={3}
              value={obsGeral} onChange={e => setObsGeral(e.target.value)} />
          </div>

          <button onClick={enviarVistoria} disabled={enviando}
            className="w-full rounded-lg bg-ber-olive py-3 text-sm font-semibold text-ber-carbon hover:brightness-95 disabled:opacity-60">
            {enviando ? 'Enviando…' : 'Concluir vistoria'}
          </button>
        </div>
      </div>
    );
  }

  // ─── Painel / scorecard ───
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon mb-4">
        <ArrowLeft size={16} /> Voltar à obra
      </Link>

      <div className="mb-5 flex items-center justify-between gap-2 flex-wrap">
        <h1 className="flex flex-wrap items-baseline gap-2 text-xl font-bold text-ber-carbon">
          <ClipboardCheck size={20} className="text-ber-teal self-center" /> Qualidade
          {obraNome && <span className="rounded-md bg-ber-carbon px-2 py-0.5 text-sm font-bold text-white">{obraNome}</span>}
        </h1>
        <button onClick={iniciarVistoria}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ber-olive px-3.5 py-2 text-sm font-semibold text-ber-carbon hover:brightness-95">
          <Plus size={15} /> Nova vistoria
        </button>
      </div>

      {resultado && (
        <div className={`mb-5 rounded-xl border border-ber-border p-5 ${CLASSIF[resultado.classificacao]?.bg ?? 'bg-white'}`}>
          <p className="text-xs font-bold uppercase tracking-wider text-ber-gray">Vistoria registrada</p>
          <p className={`mt-1 text-3xl font-black ${CLASSIF[resultado.classificacao]?.text ?? 'text-ber-carbon'}`}>
            {fmtNota(Number(resultado.notaFinal))} <span className="text-base font-bold">/ 5 · {CLASSIF[resultado.classificacao]?.label}</span>
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ber-gray">Carregando…</p>
      ) : !ultima ? (
        <div className="rounded-xl border-2 border-dashed border-ber-border bg-white p-10 text-center">
          <ClipboardCheck size={30} className="mx-auto mb-2 text-ber-gray/40" />
          <p className="text-sm font-medium text-ber-gray">Nenhuma vistoria registrada nesta obra</p>
          <p className="mt-1 text-xs text-ber-gray/60">Clique em "Nova vistoria" — o checklist leva uns 10 minutos no canteiro</p>
        </div>
      ) : (
        <>
          {/* Score atual + categorias */}
          <div className="mb-5 grid gap-4 md:grid-cols-[240px_1fr]">
            <div className={`rounded-xl border border-ber-border p-5 ${CLASSIF[ultima.classificacao]?.bg ?? 'bg-white'}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ber-gray">Última vistoria · {fmtBR(ultima.data)}</p>
              <p className={`mt-2 text-4xl font-black ${CLASSIF[ultima.classificacao]?.text ?? 'text-ber-carbon'}`}>{fmtNota(Number(ultima.notaFinal))}</p>
              <p className={`text-sm font-bold ${CLASSIF[ultima.classificacao]?.text ?? 'text-ber-carbon'}`}>{CLASSIF[ultima.classificacao]?.label}</p>
              {ultima.vistoriador && <p className="mt-2 text-[11px] text-ber-gray">por {ultima.vistoriador.name}</p>}
            </div>
            <div className="rounded-xl border border-ber-border bg-white p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-ber-gray">Nota por categoria</p>
              <div className="space-y-2">
                {(ultima.resumo ?? []).map(c => (
                  <div key={c.key} className="flex items-center gap-2">
                    <p className="w-56 truncate text-xs text-ber-carbon" title={`${c.nome} — peso ${Math.round(c.peso * 100)}%`}>{c.nome}</p>
                    <div className="h-2 flex-1 rounded-full bg-ber-surface overflow-hidden">
                      {c.nota !== null && (
                        <div className={`h-full rounded-full ${c.nota >= 3.5 ? 'bg-ber-green' : c.nota >= 2.5 ? 'bg-amber-400' : 'bg-red-500'}`}
                          style={{ width: `${(c.nota / 5) * 100}%` }} />
                      )}
                    </div>
                    <p className="w-10 text-right text-xs font-bold text-ber-carbon">{c.nota !== null ? fmtNota(c.nota) : '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pendências */}
          <div className="mb-5 rounded-xl border border-ber-border bg-white p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ber-gray">
              Pendências em aberto ({pendencias.length})
            </p>
            {pendencias.length === 0 ? (
              <p className="text-sm text-ber-gray">Nenhuma — todos os "Não" foram resolvidos. ✓</p>
            ) : (
              <div className="divide-y divide-ber-border/60">
                {pendencias.map(p => (
                  <div key={p.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-ber-carbon"><span className="text-ber-gray/60 text-xs mr-1.5">{p.itemKey}</span>{p.texto}</p>
                      {p.observacao && <p className="mt-0.5 text-xs text-red-700">{p.observacao}</p>}
                      <p className="mt-0.5 text-[11px] text-ber-gray/70">vistoria de {fmtBR(p.vistoria.data)}</p>
                    </div>
                    <button onClick={() => resolver(p)}
                      className="shrink-0 rounded-lg border border-ber-green/40 px-2.5 py-1 text-xs font-semibold text-ber-green hover:bg-ber-green/10">
                      Resolver
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Histórico */}
          <div className="rounded-xl border border-ber-border bg-white p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ber-gray">Histórico de vistorias</p>
            <div className="divide-y divide-ber-border/60">
              {vistorias.map((v, i) => {
                const nota = Number(v.notaFinal);
                const anterior = vistorias[i + 1] ? Number(vistorias[i + 1].notaFinal) : null;
                const delta = anterior !== null ? nota - anterior : null;
                return (
                  <div key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${CLASSIF[v.classificacao]?.bg} ${CLASSIF[v.classificacao]?.text}`}>
                        {fmtNota(nota)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-ber-carbon">{fmtBR(v.data)}{v.vistoriador ? ` · ${v.vistoriador.name}` : ''}</p>
                        {v.observacoes && <p className="truncate text-xs text-ber-gray" title={v.observacoes}>{v.observacoes}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {delta !== null && (
                        <span className={`text-xs font-semibold ${delta > 0 ? 'text-ber-green' : delta < 0 ? 'text-red-600' : 'text-ber-gray'}`}>
                          {delta > 0 ? `▲ +${fmtNota(delta)}` : delta < 0 ? `▼ ${fmtNota(delta)}` : '—'}
                        </span>
                      )}
                      <button onClick={() => excluirVistoria(v)} className="text-ber-gray/40 hover:text-red-500" title="Excluir vistoria (coordenação+)">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
