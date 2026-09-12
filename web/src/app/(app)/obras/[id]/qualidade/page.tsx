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
import { toast } from '@/lib/toast';
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
  responsavel?: { id: string; name: string } | null;
  prazo?: string | null;
}

interface Membro { id: string; name: string }

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

  const [obsGeral, setObsGeral] = useState('');
  const [dataVistoria, setDataVistoria] = useState('');
  const [vistoriadorNome, setVistoriadorNome] = useState('');
  // Atividades em execução no momento (03/09, Bruno)
  const [catalogo, setCatalogo] = useState<CatalogoIT[]>([]);
  const [atividadesSel, setAtividadesSel] = useState<Set<string>>(new Set()); // itCodes
  const [atividadesLivres, setAtividadesLivres] = useState<string[]>([]);
  const [atividadeLivreInput, setAtividadeLivreInput] = useState('');
  // Conferência com projeto por atividade (Bruno 10/09) — chave: itCode ou `livre:${i}`
  type ProjCheck = { disc: string; rev: '' | Resposta; exec: '' | Resposta; obs: string };
  const [projCheck, setProjCheck] = useState<Record<string, ProjCheck>>({});
  const [disciplinas, setDisciplinas] = useState<string[]>([]);
  const setPC = (k: string, patch: Partial<ProjCheck>) =>
    setProjCheck(prev => {
      const base: ProjCheck = prev[k] ?? { disc: '', rev: '', exec: '', obs: '' };
      return { ...prev, [k]: { ...base, ...patch } };
    });
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Vistoria | null>(null);
  // ─── Onda 1 UX (aprovação 1-a-1, 10/09): wizard + rascunho + upload em 2º plano ───
  const [etapa, setEtapa] = useState(0); // 0 = dados/atividades · 1..N = categorias · N+1 = revisão
  type FotoUp = { status: 'subindo' | 'ok' | 'erro'; url?: string };
  const [fotoUp, setFotoUp] = useState<Record<string, FotoUp>>({}); // evidência por item ("Não")
  const [pano, setPano] = useState<Record<string, FotoUp>>({}); // panorâmica por categoria
  const [trechos, setTrechos] = useState<Record<string, string>>({}); // frente de serviço por atividade
  const [membros, setMembros] = useState<Membro[]>([]);
  const [cienciaNome, setCienciaNome] = useState('');
  const DRAFT_KEY = `vq-rascunho-${obraId}`;

  async function load() {
    setLoading(true);
    try {
      const [t, p, o, cat, docs] = await Promise.all([
        api.get(`/obras/${obraId}/qualidade/template`),
        api.get(`/obras/${obraId}/qualidade`),
        api.get(`/obras/${obraId}`).catch(() => null),
        api.get(`/obras/${obraId}/qualidade/atividades`).catch(() => null),
        api.get(`/obras/${obraId}/controle-documentos`).catch(() => null),
      ]);
      setTemplate(t.data.data ?? []);
      setVistorias(p.data.data?.vistorias ?? []);
      setPendencias(p.data.data?.pendencias ?? []);
      setFichas(p.data.data?.fichas ?? []);
      if (o) {
        setObraNome(o.data.data?.name ?? '');
        const ms = (o.data.data?.members ?? []) as { user: { id: string; name: string } }[];
        setMembros(ms.map(m => ({ id: m.user.id, name: m.user.name })));
      }
      if (cat) setCatalogo(cat.data.data ?? []);
      if (docs) {
        // disciplinas de PROJETO (ART/Seguro/adm ficam fora da conferência)
        const fora = new Set(['ART', 'Seguro', 'Docs do Condomínio', 'SD - Aprovações']);
        const ds = [...new Set(((docs.data.data ?? []) as { disciplina: string; obsoleto?: boolean }[])
          .filter(d => !d.obsoleto && !fora.has(d.disciplina)).map(d => d.disciplina))].sort();
        setDisciplinas(ds);
      }
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [obraId]);

  const totalItens = useMemo(() => template.reduce((acc, c) => acc + c.itens.length, 0), [template]);
  const respondidos = Object.keys(respostas).length;
  // "Não" e "N/A" exigem justificativa (critério Bruno 03/09)
  const semJustificativa = useMemo(() =>
    Object.entries(respostas).filter(([k, r]) => (r === 'nao' || r === 'na') && !(obs[k] ?? '').trim()).length,
  [respostas, obs]);
  // Regra de foto 10/09 (substitui o "foto pra tudo" de 03/09): evidência
  // obrigatória no "Não"; os "Sim" são cobertos pela panorâmica da categoria.
  const semFoto = useMemo(() =>
    Object.entries(respostas).filter(([k, r]) => r === 'nao' && fotoUp[k]?.status !== 'ok').length,
  [respostas, fotoUp]);
  const panoFaltando = useMemo(() =>
    template.filter(cat => cat.itens.some(i => respostas[`${cat.key}:${i.key}`] === 'sim') && pano[cat.key]?.status !== 'ok').length,
  [template, respostas, pano]);
  const subindo = useMemo(() =>
    [...Object.values(fotoUp), ...Object.values(pano)].filter(f => f.status === 'subindo').length,
  [fotoUp, pano]);
  // Nota parcial ao vivo — espelho do cálculo do servidor
  const notaParcial = useMemo(() => {
    const cats = template.map(cat => {
      const rs = cat.itens.map(i => respostas[`${cat.key}:${i.key}`]).filter(Boolean);
      const sim = rs.filter(r => r === 'sim').length; const nao = rs.filter(r => r === 'nao').length;
      return { peso: cat.peso, nota: sim + nao > 0 ? (sim / (sim + nao)) * 5 : null };
    }).filter(c => c.nota !== null) as { peso: number; nota: number }[];
    const somaP = cats.reduce((a, c) => a + c.peso, 0);
    return somaP > 0 ? Math.round((cats.reduce((a, c) => a + c.nota * c.peso, 0) / somaP) * 100) / 100 : null;
  }, [template, respostas]);

  // Rascunho automático: tudo (menos foto ainda subindo) salvo no aparelho a cada mudança
  useEffect(() => {
    if (!preenchendo) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        respostas, obs, obsGeral, dataVistoria, etapa,
        atividadesSel: [...atividadesSel], atividadesLivres, projCheck, trechos,
        fotoUp: Object.fromEntries(Object.entries(fotoUp).filter(([, v]) => v.status === 'ok')),
        pano: Object.fromEntries(Object.entries(pano).filter(([, v]) => v.status === 'ok')),
        em: new Date().toISOString(),
      }));
    } catch { /* quota cheia não pode travar a vistoria */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preenchendo, respostas, obs, obsGeral, dataVistoria, etapa, atividadesSel, atividadesLivres, projCheck, trechos, fotoUp, pano]);

  // Upload em segundo plano: comprime e sobe assim que a foto é anexada
  // Trava de etapa (Bruno 10/09): o que é obrigatório se resolve NA categoria —
  // ninguém descobre pendência só na revisão final.
  function pendenciasDaEtapa(): string[] {
    const faltas: string[] = [];
    if (etapa === 0) {
      const confRuim = Object.values(projCheck).filter(pc =>
        (pc.rev === 'nao' || pc.rev === 'na' || pc.exec === 'nao' || pc.exec === 'na') && !pc.obs.trim()).length;
      if (confRuim > 0) faltas.push(`${confRuim} conferência(s) de projeto com "Não"/"N.A." sem justificativa`);
      return faltas;
    }
    const cat = template[etapa - 1];
    if (!cat) return faltas;
    let semJust = 0, semFotoNao = 0, subindoCat = 0;
    for (const item of cat.itens) {
      const k = `${cat.key}:${item.key}`;
      const r = respostas[k];
      if ((r === 'nao' || r === 'na') && !(obs[k] ?? '').trim()) semJust++;
      if (r === 'nao') {
        if (fotoUp[k]?.status === 'subindo') subindoCat++;
        else if (fotoUp[k]?.status !== 'ok') semFotoNao++;
      }
    }
    const temSim = cat.itens.some(i => respostas[`${cat.key}:${i.key}`] === 'sim');
    if (semJust > 0) faltas.push(`${semJust} item(ns) "Não"/"N/A" sem justificativa`);
    if (semFotoNao > 0) faltas.push(`${semFotoNao} item(ns) "Não" sem a foto da falha`);
    if (temSim && pano[cat.key]?.status === 'subindo') subindoCat++;
    else if (temSim && pano[cat.key]?.status !== 'ok') faltas.push('falta a foto panorâmica da categoria');
    if (subindoCat > 0) faltas.push(`${subindoCat} foto(s) ainda subindo — aguarde uns segundos`);
    return faltas;
  }

  function avancarEtapa() {
    const faltas = pendenciasDaEtapa();
    if (faltas.length > 0) {
      toast(`Antes de avançar, resolva nesta etapa:\n• ${faltas.join('\n• ')}`);
      return;
    }
    setEtapa(e => e + 1);
    window.scrollTo({ top: 0 });
  }

  async function subirFoto(destino: 'item' | 'pano', chave: string, file: File) {
    const setMap = destino === 'item' ? setFotoUp : setPano;
    setMap(prev => ({ ...prev, [chave]: { status: 'subindo' } }));
    try {
      const blob = await comprimirFoto(file);
      const fd = new FormData();
      fd.append('file', blob, `${chave.replace(/[^a-zA-Z0-9]/g, '-')}.jpg`);
      const r = await api.post(`/obras/${obraId}/qualidade/foto-temp`, fd);
      setMap(prev => ({ ...prev, [chave]: { status: 'ok', url: r.data.data.url } }));
    } catch {
      setMap(prev => ({ ...prev, [chave]: { status: 'erro' } }));
    }
  }

  // Bloco de conferência com projeto de uma atividade (Bruno 10/09):
  // qual projeto rege + revisão vigente em uso + execução conforme.
  function ConfProjeto({ ck }: { ck: string }) {
    const pc = projCheck[ck] ?? { disc: '', rev: '', exec: '', obs: '' };
    const precisaObs = pc.rev === 'nao' || pc.rev === 'na' || pc.exec === 'nao' || pc.exec === 'na';
    const Trio = ({ campo }: { campo: 'rev' | 'exec' }) => (
      <span className="inline-flex gap-1">
        {(['sim', 'nao', 'na'] as const).map(v => (
          <button key={v} type="button" onClick={() => setPC(ck, { [campo]: pc[campo] === v ? '' : v } as Partial<typeof pc>)}
            className={`rounded px-2 py-0.5 text-[11px] font-semibold border transition-colors ${
              pc[campo] === v
                ? v === 'sim' ? 'border-ber-green bg-ber-green text-white' : v === 'nao' ? 'border-red-600 bg-red-600 text-white' : 'border-ber-gray bg-ber-gray text-white'
                : 'border-ber-border bg-white text-ber-carbon hover:bg-ber-surface'
            }`}>
            {v === 'sim' ? 'Sim' : v === 'nao' ? 'Não' : 'N.A.'}
          </button>
        ))}
      </span>
    );
    return (
      <div className="mt-1.5 mb-2 ml-3 rounded-lg border border-ber-border bg-ber-surface/60 p-2.5 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-ber-carbon">
          <span className="font-semibold">Conferência com projeto:</span>
          <select value={pc.disc} onChange={e => setPC(ck, { disc: e.target.value })}
            className="rounded border border-ber-border bg-white px-2 py-0.5 text-[11px]">
            <option value="">projeto/disciplina…</option>
            {disciplinas.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-ber-gray">
          <span>Última revisão em uso no canteiro?</span> <Trio campo="rev" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-ber-gray">
          <span>Execução conforme o projeto?</span> <Trio campo="exec" />
        </div>
        {(precisaObs || pc.obs) && (
          <input value={pc.obs} onChange={e => setPC(ck, { obs: e.target.value })}
            placeholder={precisaObs ? 'Justificativa obrigatória — o que diverge?' : 'Observação (opcional)'}
            className={`w-full rounded border px-2 py-1 text-[11px] focus:outline-none ${precisaObs && !pc.obs.trim() ? 'border-red-400' : 'border-ber-border'}`} />
        )}
      </div>
    );
  }

  async function iniciarVistoria() {
    // Rascunho automático (10/09): oferece retomar exatamente de onde parou
    let draft: Record<string, unknown> | null = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null'); } catch { draft = null; }
    if (draft?.em && await confirmar(
      `Existe uma vistoria em andamento salva (${new Date(String(draft.em)).toLocaleString('pt-BR')}). Retomar de onde parou?`,
      { titulo: 'Rascunho encontrado', confirmarLabel: 'Retomar' },
    )) {
      setRespostas((draft.respostas as Record<string, Resposta>) ?? {});
      setObs((draft.obs as Record<string, string>) ?? {});
      setObsGeral(String(draft.obsGeral ?? ''));
      setDataVistoria(String(draft.dataVistoria ?? '') || new Date().toISOString().slice(0, 10));
      setAtividadesSel(new Set((draft.atividadesSel as string[]) ?? []));
      setAtividadesLivres((draft.atividadesLivres as string[]) ?? []);
      setProjCheck((draft.projCheck as Record<string, ProjCheck>) ?? {});
      setTrechos((draft.trechos as Record<string, string>) ?? {});
      setFotoUp((draft.fotoUp as Record<string, FotoUp>) ?? {});
      setPano((draft.pano as Record<string, FotoUp>) ?? {});
      setEtapa(Number(draft.etapa ?? 0));
    } else {
      localStorage.removeItem(DRAFT_KEY);
      setRespostas({});
      setObs({});
      setFotoUp({});
      setPano({});
      setAtividadesSel(new Set());
      setAtividadesLivres([]);
      setProjCheck({});
      setTrechos({});
      setObsGeral('');
      setCienciaNome('');
      setDataVistoria(new Date().toISOString().slice(0, 10));
      setEtapa(0);
    }
    setAtividadeLivreInput('');
    setVistoriadorNome(nomeUsuarioLogado());
    setResultado(null);
    setPreenchendo(true);
    window.scrollTo({ top: 0 });
  }

  async function enviarVistoria() {
    if (respondidos === 0) { toast('Responda ao menos um item', 'erro'); return; }
    if (semJustificativa > 0) { toast(`${semJustificativa} item(ns) "Não"/"N/A" sem justificativa — descreva o motivo em cada um`, 'erro'); return; }
    if (semFoto > 0) { toast(`${semFoto} item(ns) "Não" sem foto da falha — evidência é obrigatória no que reprovou`, 'erro'); return; }
    if (panoFaltando > 0) { toast(`${panoFaltando} categoria(s) com "Sim" sem a foto panorâmica`, 'erro'); return; }
    if (subindo > 0) { toast(`${subindo} foto(s) ainda subindo — aguarda uns segundos e tenta de novo`, 'erro'); return; }
    const confSemJust = Object.values(projCheck).filter(pc => (pc.rev === 'nao' || pc.rev === 'na' || pc.exec === 'nao' || pc.exec === 'na') && !pc.obs.trim()).length;
    if (confSemJust > 0) { toast(`${confSemJust} conferência(s) de projeto com "Não"/"N.A." sem justificativa — descreva o motivo`, 'erro'); return; }
    if (respondidos < totalItens && !(await confirmar(
      `${totalItens - respondidos} item(ns) ficaram em branco e não entram no cálculo. Enviar assim mesmo?`,
      { titulo: 'Itens em branco', confirmarLabel: 'Enviar' },
    ))) return;
    setEnviando(true);
    try {
      // fotos: cada "Não" leva a própria evidência; a panorâmica da categoria
      // entra no primeiro "Sim" sem foto própria (regra aprovada 10/09)
      const fotoDoItem: Record<string, string> = {};
      for (const [k, f] of Object.entries(fotoUp)) if (f.status === 'ok' && f.url) fotoDoItem[k] = f.url;
      for (const cat of template) {
        const pn = pano[cat.key];
        if (pn?.status !== 'ok' || !pn.url) continue;
        const alvo = cat.itens.find(i => respostas[`${cat.key}:${i.key}`] === 'sim' && !fotoDoItem[`${cat.key}:${i.key}`]);
        if (alvo) fotoDoItem[`${cat.key}:${alvo.key}`] = pn.url;
      }
      const payload = {
        respostas: Object.entries(respostas).map(([k, resposta]) => {
          const [categoriaKey, itemKey] = k.split(':');
          return { categoriaKey, itemKey, resposta, observacao: (obs[k] ?? '').trim() || null, fotoUrl: fotoDoItem[k] ?? null };
        }),
        observacoes: obsGeral.trim() || null,
        cienciaNome: cienciaNome.trim() || null,
        data: dataVistoria || undefined,
        atividades: [
          ...catalogo.filter(c => atividadesSel.has(c.code)).map(c => {
            const pc = projCheck[c.code];
            return { itCode: c.code, titulo: c.title, trecho: (trechos[c.code] ?? '').trim() || null, projetoDisciplina: pc?.disc || null, revisaoOk: pc?.rev || null, conformeProjeto: pc?.exec || null, projetoObs: pc?.obs?.trim() || null };
          }),
          ...atividadesLivres.map((t, i) => {
            const pc = projCheck[`livre:${i}`];
            return { titulo: t, trecho: (trechos[`livre:${i}`] ?? '').trim() || null, projetoDisciplina: pc?.disc || null, revisaoOk: pc?.rev || null, conformeProjeto: pc?.exec || null, projetoObs: pc?.obs?.trim() || null };
          }),
        ],
      };
      const r = await api.post(`/obras/${obraId}/qualidade`, payload);
      const vistoria = r.data.data as Vistoria & { itens: { id: string; categoriaKey: string; itemKey: string }[] };
      localStorage.removeItem(DRAFT_KEY); // registrada — o rascunho cumpriu o papel

      setResultado(vistoria);
      setPreenchendo(false);
      load();
    } catch (e) {
      const m = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast(m || 'Erro ao enviar vistoria', 'erro');
    } finally {
      setEnviando(false);
    }
  }

  async function atribuir(p: Pendencia, patch: { responsavelId?: string | null; prazo?: string | null }) {
    try {
      const r = await api.patch(`/obras/${obraId}/qualidade/pendencias/${p.id}/atribuicao`, patch);
      const novo = r.data.data as { responsavel?: { id: string; name: string } | null; prazo?: string | null };
      setPendencias(prev => prev.map(x => x.id === p.id ? { ...x, responsavel: novo.responsavel ?? null, prazo: novo.prazo ?? null } : x));
    } catch { toast('Erro ao atribuir pendência', 'erro'); }
  }

  async function abrirPdf(v: Vistoria) {
    try {
      const win = window.open('', '_blank'); // síncrono no toque — iOS não bloqueia
      const r = await api.get(`/obras/${obraId}/qualidade/vistorias/${v.id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      if (win) win.location.href = url; else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { toast('Erro ao gerar o PDF', 'erro'); }
  }

  async function resolver(p: Pendencia) {
    try {
      await api.patch(`/obras/${obraId}/qualidade/pendencias/${p.id}`, { resolvido: true });
      setPendencias(prev => prev.filter(x => x.id !== p.id));
    } catch { toast('Erro ao resolver pendência', 'erro'); }
  }

  async function excluirVistoria(v: Vistoria) {
    if (!(await confirmar(`Excluir a vistoria de ${fmtBR(v.data)} (nota ${fmtNota(Number(v.notaFinal))})?`, { confirmarLabel: 'Excluir' }))) return;
    try {
      await api.delete(`/obras/${obraId}/qualidade/vistorias/${v.id}`);
      load();
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      toast(status === 403 ? 'Excluir vistoria exige coordenação ou acima.' : 'Erro ao excluir', 'erro');
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

        {etapa === 0 && (<>
        {pendencias.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-800">Reinspeção — {pendencias.length} pendência(s) da(s) visita(s) anterior(es)</p>
            <p className="mt-0.5 text-xs text-amber-700">Antes do checklist: o que foi reprovado foi corrigido?</p>
            <div className="mt-2 divide-y divide-amber-200">
              {pendencias.map(p => (
                <div key={p.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0 text-xs text-ber-carbon">
                    <p><span className="text-ber-gray/70 mr-1">{p.itemKey}</span>{p.texto}</p>
                    <p className="text-[11px] text-ber-gray">de {fmtBR(p.vistoria.data)}{p.responsavel ? ` · resp. ${p.responsavel.name}` : ''}</p>
                  </div>
                  <button onClick={() => resolver(p)}
                    className="shrink-0 rounded-lg border border-ber-green/40 px-2.5 py-1 text-[11px] font-semibold text-ber-green hover:bg-ber-green/10">
                    Corrigida ✓
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-amber-700">O que continuar errado, reprova de novo no item correspondente do checklist.</p>
          </div>
        )}
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
                  <div key={c.code}>
                    <p className="text-xs text-ber-gray">
                      {c.code} · {c.title} — <Link href={`/instrucoes?it=${c.code}`} target="_blank" className="text-ber-teal hover:underline">abrir IT ↗</Link>
                      {ficha ? (
                        ficha.status === 'pendente'
                          ? <span className="ml-1 font-semibold text-amber-700">· FVS pendente ⚠</span>
                          : <span className="ml-1 font-semibold text-ber-green">· FVS preenchida ✓</span>
                      ) : (
                        <span className="ml-1 text-ber-gray/70">· FVS será aberta ao concluir</span>
                      )}
                    </p>
                    <input value={trechos[c.code] ?? ''} onChange={e => setTrechos(prev => ({ ...prev, [c.code]: e.target.value }))}
                      placeholder="Frente/trecho — ex.: 3º pavimento, bloco B (vira a FVS desta frente)"
                      className="mt-1 ml-3 w-full max-w-md rounded border border-ber-border px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ber-teal" />
                    <ConfProjeto ck={c.code} />
                  </div>
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
                <div key={`${t}-${i}`} className="w-full">
                  <span className="inline-flex items-center gap-1 rounded-full bg-ber-surface px-3 py-1 text-xs text-ber-carbon">
                    {t}
                    <button onClick={() => setAtividadesLivres(prev => prev.filter((_, j) => j !== i))} className="text-ber-gray hover:text-red-600"><X size={12} /></button>
                  </span>
                  <input value={trechos[`livre:${i}`] ?? ''} onChange={e => setTrechos(prev => ({ ...prev, [`livre:${i}`]: e.target.value }))}
                    placeholder="Frente/trecho — ex.: 3º pavimento (vira a FVS desta frente)"
                    className="mt-1 ml-3 w-full max-w-md rounded border border-ber-border px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ber-teal" />
                  <ConfProjeto ck={`livre:${i}`} />
                </div>
              ))}
            </div>
          )}
        </div>
        </>)}

        <div className="sticky top-0 z-10 -mx-4 md:-mx-6 mb-4 border-b border-ber-border bg-white/95 px-4 md:px-6 py-2.5 backdrop-blur">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-ber-gray">
              <span className="font-bold text-ber-carbon">
                {etapa === 0 ? 'Atividades' : etapa <= template.length ? `${template[etapa - 1]?.nome ?? ''} · ${etapa}/${template.length}` : 'Revisão final'}
              </span>
              <span className="ml-2">{respondidos}/{totalItens}</span>
              {notaParcial !== null && <span className="ml-2 font-bold text-ber-carbon">nota parcial {fmtNota(notaParcial)}</span>}
              {subindo > 0 && <span className="ml-2 text-ber-teal font-semibold">↑ {subindo} foto(s) subindo…</span>}
              {semJustificativa > 0 && <span className="ml-2 text-red-600 font-semibold">{semJustificativa} sem justificativa</span>}
            </p>
            <div className="flex gap-2">
              {etapa > 0 && (
                <button onClick={() => { setEtapa(e => e - 1); window.scrollTo({ top: 0 }); }}
                  className="rounded-lg border border-ber-border px-3 py-1.5 text-sm text-ber-carbon hover:bg-ber-surface">← Voltar</button>
              )}
              {etapa <= template.length ? (
                <button onClick={avancarEtapa}
                  className="rounded-lg bg-ber-olive px-4 py-1.5 text-sm font-semibold text-ber-carbon hover:brightness-95">
                  {etapa === 0 ? 'Começar checklist →' : 'Avançar →'}
                </button>
              ) : (
                <button onClick={enviarVistoria} disabled={enviando}
                  className="rounded-lg bg-ber-olive px-4 py-1.5 text-sm font-semibold text-ber-carbon hover:brightness-95 disabled:opacity-60">
                  {enviando ? 'Enviando…' : 'Concluir vistoria'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {template.filter((_, ci) => ci === etapa - 1).map(cat => {
            const catRespondidos = cat.itens.filter(i => respostas[`${cat.key}:${i.key}`]).length;
            return (
              <div key={cat.key} className="rounded-xl border border-ber-border bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-ber-border bg-ber-surface px-4 py-2.5">
                  <p className="text-sm font-bold text-ber-carbon">{cat.nome}</p>
                  <p className="text-[11px] text-ber-gray">peso {Math.round(cat.peso * 100)}% · {catRespondidos}/{cat.itens.length}</p>
                </div>
                {cat.itens.some(i => respostas[`${cat.key}:${i.key}`] === 'sim') && (
                  <div className="border-b border-ber-border bg-white px-4 py-2">
                    <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                      pano[cat.key]?.status === 'ok' ? 'border-ber-green/40 text-ber-green bg-ber-green/5'
                      : pano[cat.key]?.status === 'subindo' ? 'border-ber-border text-ber-gray'
                      : 'border-amber-400 text-amber-700 bg-amber-50'
                    }`}>
                      📷 {pano[cat.key]?.status === 'ok' ? 'Panorâmica anexada ✓'
                        : pano[cat.key]?.status === 'subindo' ? 'Subindo…'
                        : pano[cat.key]?.status === 'erro' ? 'Falhou — tocar pra tentar de novo'
                        : 'Foto panorâmica da categoria (obrigatória — cobre os "Sim")'}
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto('pano', cat.key, f); e.target.value = ''; }} />
                    </label>
                  </div>
                )}
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
                        {r === 'nao' && (
                          <div className="mt-2 flex items-center gap-2">
                            <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                              fotoUp[k]?.status === 'ok' ? 'border-ber-green/40 text-ber-green bg-ber-green/5'
                              : fotoUp[k]?.status === 'subindo' ? 'border-ber-border text-ber-gray'
                              : 'border-amber-400 text-amber-700 bg-amber-50'
                            }`}>
                              📷 {fotoUp[k]?.status === 'ok' ? 'Evidência anexada ✓'
                                : fotoUp[k]?.status === 'subindo' ? 'Subindo…'
                                : fotoUp[k]?.status === 'erro' ? 'Falhou — tocar pra tentar de novo'
                                : 'Foto da falha (obrigatória)'}
                              <input type="file" accept="image/*" capture="environment" className="hidden"
                                onChange={e => { const f = e.target.files?.[0]; if (f) subirFoto('item', k, f); e.target.value = ''; }} />
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {etapa > template.length && (<>
          <div className="rounded-xl border border-ber-border bg-white p-4">
            <p className="mb-2 text-sm font-bold text-ber-carbon">Revisão final</p>
            <p className="text-xs text-ber-gray">
              {respondidos} de {totalItens} itens respondidos
              {notaParcial !== null && <> · nota parcial <b className="text-ber-carbon">{fmtNota(notaParcial)}</b></>}
            </p>
            {(semJustificativa > 0 || semFoto > 0 || panoFaltando > 0) && (
              <ul className="mt-2 space-y-1 text-xs text-red-700">
                {semJustificativa > 0 && <li>• {semJustificativa} item(ns) "Não"/"N/A" sem justificativa</li>}
                {semFoto > 0 && <li>• {semFoto} item(ns) "Não" sem foto da falha</li>}
                {panoFaltando > 0 && <li>• {panoFaltando} categoria(s) com "Sim" sem panorâmica</li>}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-ber-border bg-white p-4">
            <label className="mb-1 block text-xs font-medium text-ber-carbon">Visita acompanhada por (ciência da obra — opcional)</label>
            <input value={cienciaNome} onChange={e => setCienciaNome(e.target.value)}
              placeholder="Nome de quem acompanhou pela obra (residente, mestre…)"
              className="mb-3 w-full rounded-lg border border-ber-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ber-teal" />
            <label className="mb-1 block text-xs font-medium text-ber-carbon">Observações gerais da vistoria (opcional)</label>
            <textarea className="w-full rounded-lg border border-ber-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ber-teal" rows={3}
              value={obsGeral} onChange={e => setObsGeral(e.target.value)} />
          </div>

          <button onClick={enviarVistoria} disabled={enviando}
            className="w-full rounded-lg bg-ber-olive py-3 text-sm font-semibold text-ber-carbon hover:brightness-95 disabled:opacity-60">
            {enviando ? 'Enviando…' : 'Concluir vistoria'}
          </button>
          </>)}
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

          {/* Evolução por categoria (10/09): tendência das últimas visitas */}
          {vistorias.length >= 2 && (
            <div className="mb-5 rounded-xl border border-ber-border bg-white p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ber-gray">Evolução por categoria (últimas {Math.min(5, vistorias.length)} visitas)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {(vistorias[0]?.resumo ?? []).map(cat => {
                      const serie = vistorias.slice(0, 5).reverse().map(v => {
                        const c = (v.resumo ?? []).find(x => x.key === cat.key);
                        return c?.nota ?? null;
                      });
                      const validos = serie.filter((n): n is number => n !== null);
                      const ult = validos[validos.length - 1] ?? null;
                      const pen = validos[validos.length - 2] ?? null;
                      const antepen = validos[validos.length - 3] ?? null;
                      const caiu2 = ult !== null && pen !== null && antepen !== null && ult < pen && pen < antepen;
                      const seta = ult !== null && pen !== null ? (ult > pen + 0.05 ? '↑' : ult < pen - 0.05 ? '↓' : '→') : '';
                      return (
                        <tr key={cat.key} className="border-b border-ber-border/40 last:border-0">
                          <td className="py-1.5 pr-3 text-ber-carbon whitespace-nowrap">{cat.nome}{caiu2 && <span className="ml-1.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">caiu 2 visitas seguidas</span>}</td>
                          <td className="py-1.5 text-right whitespace-nowrap text-ber-gray">
                            {serie.map((n, i) => <span key={i} className="ml-2 tabular-nums">{n === null ? '·' : fmtNota(n)}</span>)}
                            <span className={`ml-2 font-bold ${seta === '↓' ? 'text-red-600' : seta === '↑' ? 'text-ber-green' : 'text-ber-gray'}`}>{seta}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <button onClick={() => resolver(p)}
                        className="rounded-lg border border-ber-green/40 px-2.5 py-1 text-xs font-semibold text-ber-green hover:bg-ber-green/10">
                        Resolver
                      </button>
                      <select value={p.responsavel?.id ?? ''}
                        onChange={e => atribuir(p, { responsavelId: e.target.value || null })}
                        className="min-h-[36px] max-w-[170px] rounded border border-ber-border bg-white px-2 py-1.5 text-xs">
                        <option value="">sem dono…</option>
                        {membros.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <input type="date" value={p.prazo ? p.prazo.slice(0, 10) : ''}
                        onChange={e => atribuir(p, { prazo: e.target.value || null })}
                        className="min-h-[36px] rounded border border-ber-border bg-white px-2 py-1.5 text-xs" />
                    </div>
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
                      <button onClick={() => abrirPdf(v)} className="rounded border border-ber-border px-2 py-0.5 text-[11px] font-semibold text-ber-carbon hover:bg-ber-surface" title="PDF da vistoria (identidade BÈR)">
                        PDF
                      </button>
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
