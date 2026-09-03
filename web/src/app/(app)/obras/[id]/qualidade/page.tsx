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

interface Atividade { itCode?: string | null; titulo: string }

interface Vistoria {
  id: string;
  data: string;
  notaFinal: string | number;
  classificacao: string;
  resumo: ResumoCategoria[];
  atividades?: Atividade[];
  observacoes: string | null;
  vistoriador: { id: string; name: string } | null;
}

interface CatalogoIT { code: string; title: string; discipline: string }

interface Ficha {
  id: string;
  itCode: string | null;
  titulo: string;
  trecho: string | null;
  status: string; // pendente | preenchida
  prazo: string | null;
  preenchidoPor: { name: string } | null;
  preenchidoEm: string | null;
  itens: { id: string; resposta: string | null }[];
}

interface Pendencia {
  id: string;
  categoriaKey: string;
  itemKey: string;
  texto: string;
  observacao: string | null;
  fotoUrl: string | null;
  vistoria: { id: string; data: string };
}

/** Comprime a foto no cliente (mesma técnica do Rel. de Recebimento). */
async function comprimirFoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const MAX = 1600;
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.82),
  );
}

function nomeUsuarioLogado(): string {
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? '');
    return u?.name ?? '';
  } catch { return ''; }
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
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [loading, setLoading] = useState(true);

  // Preenchimento
  const [preenchendo, setPreenchendo] = useState(false);
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({}); // `${catKey}:${itemKey}`
  const [obs, setObs] = useState<Record<string, string>>({});
  const [fotos, setFotos] = useState<Record<string, File>>({});
  const [obsGeral, setObsGeral] = useState('');
  const [dataVistoria, setDataVistoria] = useState('');
  const [vistoriadorNome, setVistoriadorNome] = useState('');
  // Atividades em execução no momento (03/09, Bruno)
  const [catalogo, setCatalogo] = useState<CatalogoIT[]>([]);
  const [atividadesSel, setAtividadesSel] = useState<Set<string>>(new Set()); // itCodes
  const [atividadesLivres, setAtividadesLivres] = useState<string[]>([]);
  const [atividadeLivreInput, setAtividadeLivreInput] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Vistoria | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [t, p, o, cat] = await Promise.all([
        api.get(`/obras/${obraId}/qualidade/template`),
        api.get(`/obras/${obraId}/qualidade`),
        api.get(`/obras/${obraId}`).catch(() => null),
        api.get(`/obras/${obraId}/qualidade/atividades`).catch(() => null),
      ]);
      setTemplate(t.data.data ?? []);
      setVistorias(p.data.data?.vistorias ?? []);
      setPendencias(p.data.data?.pendencias ?? []);
      setFichas(p.data.data?.fichas ?? []);
      if (o) setObraNome(o.data.data?.name ?? '');
      if (cat) setCatalogo(cat.data.data ?? []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [obraId]);

  const totalItens = useMemo(() => template.reduce((acc, c) => acc + c.itens.length, 0), [template]);
  const respondidos = Object.keys(respostas).length;
  // "Não" e "N/A" exigem justificativa (critério Bruno 03/09)
  const semJustificativa = useMemo(() =>
    Object.entries(respostas).filter(([k, r]) => (r === 'nao' || r === 'na') && !(obs[k] ?? '').trim()).length,
  [respostas, obs]);
  // Foto obrigatória em TODO item Sim/Não ("foto pra tudo", Bruno 03/09)
  const semFoto = useMemo(() =>
    Object.entries(respostas).filter(([k, r]) => (r === 'sim' || r === 'nao') && !fotos[k]).length,
  [respostas, fotos]);

  function iniciarVistoria() {
    setRespostas({});
    setObs({});
    setFotos({});
    setAtividadesSel(new Set());
    setAtividadesLivres([]);
    setAtividadeLivreInput('');
    setObsGeral('');
    setDataVistoria(new Date().toISOString().slice(0, 10));
    setVistoriadorNome(nomeUsuarioLogado());
    setResultado(null);
    setPreenchendo(true);
    window.scrollTo({ top: 0 });
  }

  async function enviarVistoria() {
    if (respondidos === 0) { alert('Responda ao menos um item'); return; }
    if (semJustificativa > 0) { alert(`${semJustificativa} item(ns) "Não"/"N/A" sem justificativa — descreva o motivo em cada um`); return; }
    if (semFoto > 0) { alert(`${semFoto} item(ns) sem foto — toda resposta Sim/Não precisa de foto de evidência`); return; }
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
        data: dataVistoria || undefined,
        atividades: [
          ...catalogo.filter(c => atividadesSel.has(c.code)).map(c => ({ itCode: c.code, titulo: c.title })),
          ...atividadesLivres.map(t => ({ titulo: t })),
        ],
      };
      const r = await api.post(`/obras/${obraId}/qualidade`, payload);
      const vistoria = r.data.data as Vistoria & { itens: { id: string; categoriaKey: string; itemKey: string }[] };

      // Sobe as fotos comprimidas, item a item (falha avisa mas não perde a vistoria)
      const itemId = new Map(vistoria.itens.map(i => [`${i.categoriaKey}:${i.itemKey}`, i.id]));
      let falhas = 0;
      for (const [k, file] of Object.entries(fotos)) {
        const id = itemId.get(k);
        if (!id) continue;
        try {
          const blob = await comprimirFoto(file);
          const fd = new FormData();
          fd.append('file', blob, `${k.replace(':', '-')}.jpg`);
          await api.post(`/obras/${obraId}/qualidade/itens/${id}/foto`, fd);
        } catch { falhas++; }
      }
      if (falhas > 0) alert(`Vistoria registrada, mas ${falhas} foto(s) falharam ao subir — dá pra reenviar depois`);

      setResultado(vistoria);
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

        <div className="mb-4 flex items-end gap-4 flex-wrap rounded-xl border border-ber-border bg-white p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-ber-carbon">Data da vistoria</label>
            <input type="date" className="rounded-lg border border-ber-border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ber-teal"
              value={dataVistoria} max={new Date().toISOString().slice(0, 10)}
              onChange={e => setDataVistoria(e.target.value)} />
          </div>
          <div className="min-w-[180px]">
            <p className="mb-1 text-xs font-medium text-ber-carbon">Responsável pela vistoria</p>
            <p className="rounded-lg bg-ber-surface px-3 py-1.5 text-sm font-semibold text-ber-carbon">{vistoriadorNome || 'você (login)'}</p>
          </div>
        </div>

        {/* Atividades em execução no momento (03/09, Bruno) */}
        <div className="mb-4 rounded-xl border border-ber-border bg-white p-4">
          <p className="text-sm font-bold text-ber-carbon">Atividades em execução no momento</p>
          <p className="mt-0.5 text-xs text-ber-gray">Marque o que está rodando no canteiro hoje — cada atividade tem a IT (instrução de trabalho) linkada.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {catalogo.map(c => {
              const on = atividadesSel.has(c.code);
              return (
                <button key={c.code} type="button"
                  onClick={() => setAtividadesSel(prev => {
                    const next = new Set(prev);
                    if (next.has(c.code)) next.delete(c.code); else next.add(c.code);
                    return next;
                  })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    on ? 'border-ber-teal bg-ber-teal text-white' : 'border-ber-border bg-white text-ber-carbon hover:bg-ber-surface'
                  }`}
                  title={c.title}>
                  {c.code} · {c.title.length > 34 ? c.title.slice(0, 34) + '…' : c.title}
                </button>
              );
            })}
          </div>
          {atividadesSel.size > 0 && (
            <div className="mt-3 space-y-1">
              {catalogo.filter(c => atividadesSel.has(c.code)).map(c => {
                const ficha = fichas.find(f => f.itCode === c.code && f.status === 'pendente')
                  ?? fichas.find(f => f.itCode === c.code);
                return (
                  <p key={c.code} className="text-xs text-ber-gray">
                    {c.code} · {c.title} — <Link href={`/instrucoes?it=${c.code}`} target="_blank" className="text-ber-teal hover:underline">abrir IT ↗</Link>
                    {ficha ? (
                      ficha.status === 'pendente'
                        ? <span className="ml-1 font-semibold text-amber-700">· FVS pendente ⚠</span>
                        : <span className="ml-1 font-semibold text-ber-green">· FVS preenchida ✓</span>
                    ) : (
                      <span className="ml-1 text-ber-gray/70">· FVS será aberta ao concluir</span>
                    )}
                  </p>
                );
              })}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <input className="flex-1 rounded-lg border border-ber-border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ber-teal"
              placeholder="Outra atividade (sem IT) — digite e Adicionar"
              value={atividadeLivreInput}
              onChange={e => setAtividadeLivreInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && atividadeLivreInput.trim()) { setAtividadesLivres(prev => [...prev, atividadeLivreInput.trim()]); setAtividadeLivreInput(''); } }} />
            <button type="button" disabled={!atividadeLivreInput.trim()}
              onClick={() => { setAtividadesLivres(prev => [...prev, atividadeLivreInput.trim()]); setAtividadeLivreInput(''); }}
              className="rounded-lg border border-ber-border px-3 py-1.5 text-sm text-ber-carbon hover:bg-ber-surface disabled:opacity-50">
              Adicionar
            </button>
          </div>
          {atividadesLivres.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {atividadesLivres.map((t, i) => (
                <span key={`${t}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-ber-surface px-3 py-1 text-xs text-ber-carbon">
                  {t}
                  <button onClick={() => setAtividadesLivres(prev => prev.filter((_, j) => j !== i))} className="text-ber-gray hover:text-red-600"><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="sticky top-0 z-10 -mx-4 md:-mx-6 mb-4 border-b border-ber-border bg-white/95 px-4 md:px-6 py-2.5 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ber-gray">
              <span className="font-bold text-ber-carbon">{respondidos}</span> de {totalItens} respondidos
              {semJustificativa > 0 && <span className="text-red-600 font-semibold"> · {semJustificativa} sem justificativa</span>}
              {semFoto > 0 && <span className="text-amber-700 font-semibold"> · {semFoto} sem foto</span>}
            </p>
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
                        {r === 'na' && (
                          <input
                            className="mt-2 w-full rounded-lg border border-ber-border bg-ber-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ber-teal"
                            placeholder="Por que este item não se aplica? (obrigatório)"
                            value={obs[k] ?? ''}
                            onChange={e => setObs(prev => ({ ...prev, [k]: e.target.value }))}
                          />
                        )}
                        {(r === 'sim' || r === 'nao') && (
                          <div className="mt-2 flex items-center gap-2">
                            <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                              fotos[k] ? 'border-ber-green/40 text-ber-green bg-ber-green/5' : 'border-amber-400 text-amber-700 bg-amber-50'
                            }`}>
                              📷 {fotos[k] ? 'Foto anexada ✓' : 'Tirar foto (obrigatória)'}
                              <input type="file" accept="image/*" capture="environment" className="hidden"
                                onChange={e => {
                                  const f = e.target.files?.[0];
                                  if (f) setFotos(prev => ({ ...prev, [k]: f }));
                                  e.target.value = '';
                                }} />
                            </label>
                            {fotos[k] && (
                              <button onClick={() => setFotos(prev => { const n = { ...prev }; delete n[k]; return n; })}
                                className="text-xs text-ber-gray hover:text-red-600">trocar/remover</button>
                            )}
                          </div>
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
              {(ultima.atividades?.length ?? 0) > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ber-gray">Em execução</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {ultima.atividades!.map((a, i) => (
                      <span key={i} className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-ber-carbon" title={a.titulo}>
                        {a.itCode ?? a.titulo.slice(0, 18)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
                      <p className="mt-0.5 text-[11px] text-ber-gray/70">
                        vistoria de {fmtBR(p.vistoria.data)}
                        {p.fotoUrl && <> · <a href={p.fotoUrl} target="_blank" rel="noreferrer" className="text-ber-teal hover:underline">ver foto</a></>}
                      </p>
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

          {/* Fichas de Verificação de Serviço */}
          <div className="mb-5 rounded-xl border border-ber-border bg-white p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ber-gray">
              Fichas de Verificação de Serviço — FVS ({fichas.filter(f => f.status === 'pendente').length} pendente(s))
            </p>
            {fichas.length === 0 ? (
              <p className="text-sm text-ber-gray">Nenhuma ficha ainda — elas abrem sozinhas quando uma vistoria marca a atividade como em execução.</p>
            ) : (
              <div className="divide-y divide-ber-border/60">
                {fichas.map(f => {
                  const vencida = f.status === 'pendente' && f.prazo && new Date(f.prazo) < new Date(new Date().toDateString());
                  const respondidosF = f.itens.filter(i => i.resposta).length;
                  return (
                    <div key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm text-ber-carbon">
                          <span className="font-semibold">{f.itCode ?? '—'}</span> · {f.titulo}
                          {f.trecho && <span className="text-ber-gray"> · {f.trecho}</span>}
                        </p>
                        <p className="mt-0.5 text-[11px]">
                          {f.status === 'preenchida' ? (
                            <span className="text-ber-green font-semibold">preenchida ✓{f.preenchidoPor ? ` por ${f.preenchidoPor.name}` : ''}{f.preenchidoEm ? ` em ${fmtBR(f.preenchidoEm)}` : ''}</span>
                          ) : vencida ? (
                            <span className="text-red-600 font-semibold">VENCIDA — prazo era {fmtBR(f.prazo!)}</span>
                          ) : (
                            <span className="text-amber-700 font-semibold">pendente{f.prazo ? ` · prazo ${fmtBR(f.prazo)}` : ''} · {respondidosF}/{f.itens.length} critérios</span>
                          )}
                        </p>
                      </div>
                      <Link href={`/obras/${obraId}/qualidade/fvs/${f.id}`}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          f.status === 'preenchida'
                            ? 'border border-ber-border text-ber-carbon hover:bg-ber-surface'
                            : 'bg-ber-olive text-ber-carbon hover:brightness-95'
                        }`}>
                        {f.status === 'preenchida' ? 'Ver' : 'Preencher'}
                      </Link>
                    </div>
                  );
                })}
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
