'use client';

/**
 * Pós-Obra · Pendências — Ficha de Pendências digitalizada.
 * Iterações do Bruno 27/08: visualização ÚNICA em lista; clique na linha abre
 * card de detalhe com infos e fotos; sem botão "Iniciar" (status simplificado);
 * Gerar PDF no padrão BÈR; filtros por status e ambiente; edição completa;
 * concluir exige foto (câmera no mobile).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Camera, PauseCircle, PlayCircle, X, AlertTriangle, Pencil, FileDown, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { confirmar } from '@/lib/confirmar';

interface Pendencia {
  id: string;
  ambiente: string;
  atividade: string;
  disciplina: string | null;
  fornecedor: string | null;
  apontadoPor: 'ber' | 'cliente';
  tipo: 'pendencia' | 'solicitacao';
  criticidade: 'baixa' | 'media' | 'alta';
  status: 'aberta' | 'em_andamento' | 'concluida' | 'bloqueada';
  motivoBloqueio: string | null;
  dataInicio: string | null;
  dataTermino: string | null;
  fotoAberturaUrl: string | null;
  fotoConclusaoUrl: string | null;
  observacoes: string | null;
  responsavel: { id: string; name: string } | null;
  criador: { id: string; name: string } | null;
}

interface Resumo {
  total: number;
  concluidas: number;
  abertas: number;
  atrasadas: number;
  solicitacoesCliente: number;
  criticidadeAlta: number;
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  aberta: { label: 'Aberta', cls: 'bg-gray-100 text-gray-700' },
  em_andamento: { label: 'Em andamento', cls: 'bg-blue-100 text-blue-700' },
  concluida: { label: 'Concluída', cls: 'bg-green-100 text-green-700' },
  bloqueada: { label: 'Bloqueada', cls: 'bg-red-100 text-red-700' },
};
const CRIT_DOT: Record<string, string> = { baixa: 'bg-gray-300', media: 'bg-amber-400', alta: 'bg-red-500' };
const CRIT_LABEL: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };

function atrasada(p: Pendencia): boolean {
  if (p.status === 'concluida' || !p.dataTermino) return false;
  return new Date(`${p.dataTermino.slice(0, 10)}T23:59:59`) < new Date();
}
function fmtBR(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

export default function PendenciasPage() {
  const { id: obraId } = useParams<{ id: string }>();
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<string>('abertas');
  const [filtroAmbiente, setFiltroAmbiente] = useState<string>('todos');
  const [showForm, setShowForm] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [pdfFiltro, setPdfFiltro] = useState('abertas');
  const [pdfAmbiente, setPdfAmbiente] = useState('todos');
  const [pdfFotos, setPdfFotos] = useState(true);
  const [detalhe, setDetalhe] = useState<Pendencia | null>(null);
  const [editando, setEditando] = useState<Pendencia | null>(null);
  const [busy, setBusy] = useState(false);
  const fotoConclusaoInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const detFotoAberturaInput = useRef<HTMLInputElement | null>(null);
  const detFotoConclusaoInput = useRef<HTMLInputElement | null>(null);

  const [fAmbiente, setFAmbiente] = useState('');
  const [fAtividade, setFAtividade] = useState('');
  const [fDisciplina, setFDisciplina] = useState('');
  const [fFornecedor, setFFornecedor] = useState('');
  const [fApontado, setFApontado] = useState<'ber' | 'cliente'>('ber');
  const [fTipo, setFTipo] = useState<'pendencia' | 'solicitacao'>('pendencia');
  const [fCrit, setFCrit] = useState<'baixa' | 'media' | 'alta'>('media');
  const [fTermino, setFTermino] = useState('');
  const [fObs, setFObs] = useState('');
  const [fFoto, setFFoto] = useState<File | null>(null);

  const load = useCallback(async () => {
    try {
      const [pRes, rRes] = await Promise.all([
        api.get<{ data: Pendencia[] }>(`/obras/${obraId}/pendencias`),
        api.get<{ data: Resumo }>(`/obras/${obraId}/pendencias/resumo`),
      ]);
      setPendencias(pRes.data.data);
      setResumo(rRes.data.data);
      setErro(null);
      setDetalhe((d) => (d ? pRes.data.data.find((p) => p.id === d.id) ?? null : null));
    } catch {
      setErro('Erro ao carregar pendências');
    } finally {
      setLoading(false);
    }
  }, [obraId]);
  useEffect(() => { load(); }, [load]);

  const visiveis = useMemo(() => {
    let lista = pendencias;
    if (filtroStatus === 'abertas') lista = lista.filter((p) => p.status !== 'concluida');
    else if (filtroStatus === 'atrasadas') lista = lista.filter(atrasada);
    else if (filtroStatus === 'concluidas') lista = lista.filter((p) => p.status === 'concluida');
    else if (filtroStatus === 'solicitacoes') lista = lista.filter((p) => p.tipo === 'solicitacao');
    else if (filtroStatus === 'alta') lista = lista.filter((p) => p.criticidade === 'alta' && p.status !== 'concluida');
    if (filtroAmbiente !== 'todos') lista = lista.filter((p) => p.ambiente === filtroAmbiente);
    return lista;
  }, [pendencias, filtroStatus, filtroAmbiente]);

  const ambientes = useMemo(
    () => [...new Set(pendencias.map((p) => p.ambiente))].sort((a, b) => a.localeCompare(b)),
    [pendencias],
  );

  // Dados dos gráficos — calculados ao vivo do mesmo dataset da lista
  const graficos = useMemo(() => {
    const abertas = pendencias.filter((p) => p.status !== 'concluida');
    const porChave = (chave: 'ambiente' | 'fornecedor') => {
      const m = new Map<string, { abertas: number; atrasadas: number }>();
      for (const p of abertas) {
        const k = (chave === 'fornecedor' ? (p.fornecedor || 'Sem fornecedor') : p.ambiente);
        const cur = m.get(k) ?? { abertas: 0, atrasadas: 0 };
        cur.abertas++;
        if (atrasada(p)) cur.atrasadas++;
        m.set(k, cur);
      }
      const all = [...m.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.abertas - a.abertas);
      const top = all.slice(0, 8);
      const resto = all.slice(8);
      if (resto.length > 0) {
        top.push({
          nome: `Outros (${resto.length})`,
          abertas: resto.reduce((s2, x) => s2 + x.abertas, 0),
          atrasadas: resto.reduce((s2, x) => s2 + x.atrasadas, 0),
        });
      }
      return top;
    };
    return {
      porAmbiente: porChave('ambiente'),
      porFornecedor: porChave('fornecedor'),
      concluidas: pendencias.filter((p) => p.status === 'concluida').length,
      bloqueadas: pendencias.filter((p) => p.status === 'bloqueada').length,
      emAberto: abertas.filter((p) => p.status !== 'bloqueada').length,
      solicAbertas: abertas.filter((p) => p.tipo === 'solicitacao').length,
      pendAbertas: abertas.filter((p) => p.tipo === 'pendencia').length,
      total: pendencias.length,
    };
  }, [pendencias]);

  async function run(fn: () => Promise<unknown>, errMsg: string) {
    setBusy(true); setErro(null);
    try { await fn(); await load(); }
    catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setErro(msg || errMsg);
    } finally { setBusy(false); }
  }

  async function criar() {
    if (!fAmbiente.trim() || !fAtividade.trim()) { setErro('Ambiente e atividade são obrigatórios'); return; }
    await run(async () => {
      const r = await api.post<{ data: Pendencia }>(`/obras/${obraId}/pendencias`, {
        ambiente: fAmbiente.trim(), atividade: fAtividade.trim(),
        disciplina: fDisciplina.trim() || undefined, fornecedor: fFornecedor.trim() || undefined,
        apontadoPor: fApontado, tipo: fTipo, criticidade: fCrit,
        dataTermino: fTermino || undefined, observacoes: fObs.trim() || undefined,
      });
      if (fFoto) {
        const fd = new FormData(); fd.append('file', fFoto);
        await api.post(`/obras/${obraId}/pendencias/${r.data.data.id}/foto/abertura`, fd);
      }
      setShowForm(false);
      setFAmbiente(''); setFAtividade(''); setFDisciplina(''); setFFornecedor('');
      setFTermino(''); setFObs(''); setFFoto(null); setFTipo('pendencia'); setFCrit('media'); setFApontado('ber');
    }, 'Erro ao criar pendência');
  }

  async function enviarFotoConclusao(p: Pendencia, file: File) {
    await run(async () => {
      const fd = new FormData(); fd.append('file', file);
      await api.post(`/obras/${obraId}/pendencias/${p.id}/foto/conclusao`, fd);
      await api.patch(`/obras/${obraId}/pendencias/${p.id}/status`, { status: 'concluida' });
    }, 'Erro ao concluir');
  }

  async function enviarFoto(p: Pendencia, tipo: 'abertura' | 'conclusao', file: File) {
    await run(async () => {
      const fd = new FormData(); fd.append('file', file);
      await api.post(`/obras/${obraId}/pendencias/${p.id}/foto/${tipo}`, fd);
    }, 'Erro ao enviar foto');
  }

  async function mudarStatus(p: Pendencia, status: string, motivoBloqueio?: string) {
    await run(() => api.patch(`/obras/${obraId}/pendencias/${p.id}/status`, { status, motivoBloqueio }), 'Erro ao mudar status');
  }

  async function gerarPdf() {
    setBusy(true); setErro(null);
    try {
      const params = new URLSearchParams({ filtro: pdfFiltro, fotos: pdfFotos ? '1' : '0' });
      if (pdfAmbiente !== 'todos') params.set('ambiente', pdfAmbiente);
      const r = await api.get(`/obras/${obraId}/pendencias/pdf?${params}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data as BlobPart], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setShowPdf(false);
    } catch { setErro('Erro ao gerar PDF'); }
    finally { setBusy(false); }
  }

  const inputCls = 'w-full text-sm px-3 py-2 border border-ber-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ber-teal bg-white';
  const chip = (label: string, valor: number, filtro: string, destaque?: string) => (
    <button
      onClick={() => setFiltroStatus(filtro)}
      className={`rounded-lg px-3 py-2 border text-center min-w-[76px] transition-shadow ${destaque ?? 'bg-white border-ber-border'} ${filtroStatus === filtro ? 'ring-2 ring-inset ring-ber-carbon' : 'hover:shadow-sm'}`}
      title={`Filtrar: ${label}`}
    >
      <p className="text-lg font-bold leading-tight">{valor}</p>
      <p className="text-[10px] text-ber-gray font-medium">{label}</p>
    </button>
  );

  return (
    <div className="w-full max-w-[1500px] pb-24">
      <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon mb-4">
        <ArrowLeft size={16} /> Voltar à obra
      </Link>

      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h1 className="text-xl font-semibold text-ber-carbon">Pendências</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setPdfFiltro(filtroStatus === 'todas' ? 'todas' : filtroStatus); setPdfAmbiente(filtroAmbiente); setShowPdf(true); }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-sm font-semibold border border-ber-border bg-white rounded-lg px-3 py-2 hover:bg-ber-surface disabled:opacity-50"
          >
            <FileDown size={15} /> Gerar PDF
          </button>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold bg-ber-carbon text-white rounded-lg px-3.5 py-2 hover:opacity-90">
            <Plus size={16} /> Nova
          </button>
        </div>
      </div>

      {resumo && (
        <div className="flex gap-2 overflow-x-auto p-0.5 pb-1.5 mb-3">
          {chip('Abertas', resumo.abertas, 'abertas')}
          {chip('Atrasadas', resumo.atrasadas, 'atrasadas', resumo.atrasadas > 0 ? 'bg-red-50 border-red-200 text-red-700' : undefined)}
          {chip('Alta crit.', resumo.criticidadeAlta, 'alta', resumo.criticidadeAlta > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : undefined)}
          {chip('Solicit. cliente', resumo.solicitacoesCliente, 'solicitacoes', 'bg-purple-50 border-purple-200 text-purple-700')}
          {chip('Concluídas', resumo.concluidas, 'concluidas', 'bg-green-50 border-green-200 text-green-700')}
        </div>
      )}

      {graficos.total > 0 && (
        <div className="grid gap-3 lg:grid-cols-2 mb-4">
          {/* Progresso geral — barra empilhada + hero % */}
          <div className="lg:col-span-2 bg-white border border-ber-border rounded-xl p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ber-teal">Progresso geral</p>
              <div className="flex items-center gap-4 text-[11px] text-ber-gray">
                <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-ber-green mr-1 align-middle" />Concluídas {graficos.concluidas}</span>
                <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#C9C9C9] mr-1 align-middle" />Em aberto {graficos.emAberto}</span>
                {graficos.bloqueadas > 0 && <span><span className="inline-block w-2.5 h-2.5 rounded-sm bg-ber-red mr-1 align-middle" />Bloqueadas {graficos.bloqueadas}</span>}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2.5">
              <div className="flex-1 h-4 rounded-full bg-ber-surface overflow-hidden flex gap-[2px]">
                {graficos.concluidas > 0 && <div className="h-full bg-ber-green rounded-l-full" style={{ width: `${(graficos.concluidas / graficos.total) * 100}%` }} title={`Concluídas: ${graficos.concluidas}`} />}
                {graficos.emAberto > 0 && <div className="h-full bg-[#C9C9C9]" style={{ width: `${(graficos.emAberto / graficos.total) * 100}%` }} title={`Em aberto: ${graficos.emAberto}`} />}
                {graficos.bloqueadas > 0 && <div className="h-full bg-ber-red rounded-r-full" style={{ width: `${(graficos.bloqueadas / graficos.total) * 100}%` }} title={`Bloqueadas: ${graficos.bloqueadas}`} />}
              </div>
              <p className="text-xl font-bold text-ber-carbon tabular-nums shrink-0">{Math.round((graficos.concluidas / graficos.total) * 100)}%</p>
            </div>
            <div className="flex items-center gap-3 mt-2.5">
              <div className="flex-1 h-2 rounded-full bg-ber-surface overflow-hidden flex gap-[2px]">
                {graficos.pendAbertas > 0 && <div className="h-full bg-ber-carbon rounded-l-full" style={{ width: `${(graficos.pendAbertas / Math.max(1, graficos.pendAbertas + graficos.solicAbertas)) * 100}%` }} title={`Pendências: ${graficos.pendAbertas}`} />}
                {graficos.solicAbertas > 0 && <div className="h-full bg-[#7A3FB8] rounded-r-full" style={{ width: `${(graficos.solicAbertas / Math.max(1, graficos.pendAbertas + graficos.solicAbertas)) * 100}%` }} title={`Solicitações: ${graficos.solicAbertas}`} />}
              </div>
              <p className="text-[11px] text-ber-gray shrink-0">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-ber-carbon mr-1 align-middle" />Pendências {graficos.pendAbertas}
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#7A3FB8] ml-3 mr-1 align-middle" />Solicit. cliente {graficos.solicAbertas}
              </p>
            </div>
          </div>

          {/* Abertas por ambiente / fornecedor — barras horizontais */}
          {([['Abertas por ambiente', graficos.porAmbiente], ['Abertas por fornecedor', graficos.porFornecedor]] as const).map(([titulo, dados]) => {
            const max = Math.max(1, ...dados.map((d) => d.abertas));
            return (
              <div key={titulo} className="bg-white border border-ber-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ber-teal">{titulo}</p>
                  <p className="text-[10px] text-ber-gray"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-ber-olive mr-1 align-middle" />no prazo <span className="inline-block w-2.5 h-2.5 rounded-sm bg-ber-red ml-2 mr-1 align-middle" />atrasadas</p>
                </div>
                <div className="space-y-1.5">
                  {dados.map((d) => (
                    <div key={d.nome} className="flex items-center gap-2" title={`${d.nome}: ${d.abertas} abertas${d.atrasadas ? `, ${d.atrasadas} atrasadas` : ''}`}>
                      <p className="w-[38%] min-w-0 truncate text-[11px] text-ber-carbon text-right pr-1">{d.nome}</p>
                      <div className="flex-1 h-3.5 flex items-center">
                        <div className="h-full flex gap-[2px] rounded-r" style={{ width: `${(d.abertas / max) * 100}%`, minWidth: 6 }}>
                          {d.abertas - d.atrasadas > 0 && <div className="h-full bg-ber-olive rounded-l-sm" style={{ flex: d.abertas - d.atrasadas }} />}
                          {d.atrasadas > 0 && <div className="h-full bg-ber-red rounded-r-sm" style={{ flex: d.atrasadas }} />}
                        </div>
                        <span className="text-[10px] text-ber-gray tabular-nums pl-1.5">{d.abertas}{d.atrasadas > 0 ? <span className="text-ber-red font-bold"> ({d.atrasadas}⚠)</span> : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 items-center">
        {([['abertas', 'Abertas'], ['atrasadas', 'Atrasadas'], ['solicitacoes', 'Solicitações'], ['concluidas', 'Concluídas'], ['todas', 'Todas']] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFiltroStatus(k)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap border ${
              filtroStatus === k ? 'bg-ber-carbon text-white border-ber-carbon' : 'bg-white text-ber-gray border-ber-border hover:text-ber-carbon'
            }`}
          >
            {label}
          </button>
        ))}
        <select
          value={filtroAmbiente}
          onChange={(e) => setFiltroAmbiente(e.target.value)}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-full border border-ber-border bg-white text-ber-gray shrink-0 focus:outline-none"
        >
          <option value="todos">Todos os ambientes</option>
          {ambientes.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {erro && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle size={15} /> {erro}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ber-gray">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <div className="bg-white border border-ber-border rounded-xl p-8 text-center text-sm text-ber-gray">
          Nenhuma pendência neste filtro.
        </div>
      ) : (
        <div className="bg-white border border-ber-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ber-gray bg-ber-surface border-b border-ber-border">
                <th className="text-left px-3 py-2.5 font-bold">Ambiente</th>
                <th className="text-left px-3 py-2.5 font-bold">Atividade</th>
                <th className="text-left px-3 py-2.5 font-bold">Fornecedor</th>
                <th className="text-left px-3 py-2.5 font-bold">Prazo</th>
                <th className="text-left px-3 py-2.5 font-bold">Status</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visiveis.map((p) => {
                const late = atrasada(p);
                return (
                  <tr
                    key={p.id}
                    onClick={() => setDetalhe(p)}
                    className="border-b border-ber-border/60 last:border-b-0 hover:bg-ber-surface/70 cursor-pointer"
                  >
                    <td className="px-3 py-2.5 text-[12px] text-ber-gray whitespace-nowrap">{p.ambiente}</td>
                    <td className="px-3 py-2.5 text-[13px] text-ber-carbon">
                      <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${CRIT_DOT[p.criticidade]}`} />
                      {p.atividade}
                      {p.tipo === 'solicitacao' && <span className="ml-1.5 text-[8px] font-bold px-1 py-0.5 rounded bg-purple-100 text-purple-700 align-middle">SOLIC.</span>}
                      {(p.fotoAberturaUrl || p.fotoConclusaoUrl) && <Camera size={11} className="inline ml-1.5 text-ber-gray align-middle" />}
                    </td>
                    <td className="px-3 py-2.5 text-[12px] text-ber-gray whitespace-nowrap">{p.fornecedor || '—'}</td>
                    <td className={`px-3 py-2.5 text-[12px] whitespace-nowrap ${late ? 'text-red-600 font-bold' : 'text-ber-gray'}`}>{fmtBR(p.dataTermino)}{late ? ' ⚠' : ''}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${STATUS_CFG[p.status].cls}`}>{STATUS_CFG[p.status].label}</span>
                    </td>
                    <td className="px-2 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {p.status !== 'concluida' && (
                        <button disabled={busy} onClick={() => fotoConclusaoInputs.current[p.id]?.click()} className="text-ber-green hover:opacity-70 p-1" title="Concluir com foto">
                          <Camera size={15} />
                        </button>
                      )}
                      <input
                        ref={(el) => { fotoConclusaoInputs.current[p.id] = el; }}
                        type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarFotoConclusao(p, f); e.target.value = ''; }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Card de detalhe (clique na linha) ── */}
      {detalhe && !editando && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setDetalhe(null)}>
          <div className="bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-ber-border px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_CFG[detalhe.status].cls}`}>{STATUS_CFG[detalhe.status].label}</span>
                {detalhe.tipo === 'solicitacao' && <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">SOLICITAÇÃO CLIENTE</span>}
              </div>
              <button onClick={() => setDetalhe(null)} className="text-ber-gray hover:text-ber-carbon"><X size={20} /></button>
            </div>

            <div className="p-5">
              <p className="text-base font-semibold text-ber-carbon leading-snug">{detalhe.atividade}</p>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
                {([
                  ['Ambiente', detalhe.ambiente],
                  ['Fornecedor', detalhe.fornecedor || '—'],
                  ['Disciplina', detalhe.disciplina || '—'],
                  ['Criticidade', CRIT_LABEL[detalhe.criticidade]],
                  ['Apontado por', detalhe.apontadoPor === 'cliente' ? 'Cliente' : 'BÈR'],
                  ['Prazo', `${fmtBR(detalhe.dataTermino)}${atrasada(detalhe) ? ' ⚠ atrasada' : ''}`],
                ] as const).map(([l, v]) => (
                  <div key={l}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ber-gray">{l}</p>
                    <p className={`text-[13px] ${l === 'Prazo' && atrasada(detalhe) ? 'text-red-600 font-bold' : 'text-ber-carbon'}`}>{v}</p>
                  </div>
                ))}
              </div>

              {detalhe.status === 'bloqueada' && detalhe.motivoBloqueio && (
                <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">🚫 {detalhe.motivoBloqueio}</p>
              )}
              {detalhe.observacoes && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ber-gray mb-0.5">Observações</p>
                  <p className="text-[13px] text-ber-carbon whitespace-pre-wrap">{detalhe.observacoes}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ber-gray">Foto atual (ao apontar)</p>
                    <button disabled={busy} onClick={() => detFotoAberturaInput.current?.click()} className="text-[10px] font-bold text-ber-teal hover:underline disabled:opacity-50">
                      {detalhe.fotoAberturaUrl ? 'Trocar' : '+ Adicionar'}
                    </button>
                  </div>
                  {detalhe.fotoAberturaUrl ? (
                    <a href={detalhe.fotoAberturaUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={detalhe.fotoAberturaUrl} alt="Estado ao apontar" className="w-full rounded-xl border border-ber-border" />
                    </a>
                  ) : (
                    <button disabled={busy} onClick={() => detFotoAberturaInput.current?.click()} className="w-full h-28 rounded-xl border-2 border-dashed border-ber-border flex flex-col items-center justify-center gap-1 text-ber-gray hover:bg-ber-surface disabled:opacity-50">
                      <Camera size={20} className="text-ber-teal" />
                      <span className="text-[11px]">Adicionar foto do estado atual</span>
                    </button>
                  )}
                  <input ref={detFotoAberturaInput} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarFoto(detalhe, 'abertura', f); e.target.value = ''; }} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ber-gray">Foto do resolvido</p>
                    <button disabled={busy} onClick={() => detFotoConclusaoInput.current?.click()} className="text-[10px] font-bold text-ber-green hover:underline disabled:opacity-50">
                      {detalhe.fotoConclusaoUrl ? 'Trocar' : '+ Adicionar'}
                    </button>
                  </div>
                  {detalhe.fotoConclusaoUrl ? (
                    <a href={detalhe.fotoConclusaoUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={detalhe.fotoConclusaoUrl} alt="Concluído" className="w-full rounded-xl border border-green-300" />
                    </a>
                  ) : (
                    <button disabled={busy} onClick={() => detFotoConclusaoInput.current?.click()} className="w-full h-28 rounded-xl border-2 border-dashed border-ber-border flex flex-col items-center justify-center gap-1 text-ber-gray hover:bg-ber-surface disabled:opacity-50">
                      <Camera size={20} className="text-ber-green" />
                      <span className="text-[11px]">Adicionar foto do resolvido</span>
                    </button>
                  )}
                  <input ref={detFotoConclusaoInput} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) enviarFoto(detalhe, 'conclusao', f); e.target.value = ''; }} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-ber-border">
                <button disabled={busy} onClick={() => setEditando(detalhe)} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-ber-border hover:bg-ber-surface disabled:opacity-50">
                  <Pencil size={13} /> Editar
                </button>
                {detalhe.status !== 'concluida' && (
                  <>
                    {detalhe.status === 'bloqueada' ? (
                      <button disabled={busy} onClick={() => mudarStatus(detalhe, 'aberta')} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-ber-border hover:bg-ber-surface disabled:opacity-50">
                        <PlayCircle size={13} /> Desbloquear
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => { const motivo = window.prompt('Motivo do bloqueio:'); if (motivo?.trim()) mudarStatus(detalhe, 'bloqueada', motivo.trim()); }}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-ber-border text-ber-gray hover:bg-ber-surface disabled:opacity-50"
                      >
                        <PauseCircle size={13} /> Bloquear
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => fotoConclusaoInputs.current[detalhe.id]?.click()}
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-ber-green text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <Camera size={13} /> Concluir com foto
                    </button>
                  </>
                )}
                <button
                  disabled={busy}
                  onClick={async () => { if (await confirmar('Excluir esta pendência?', { confirmarLabel: 'Excluir' })) run(async () => { await api.delete(`/obras/${obraId}/pendencias/${detalhe.id}`); setDetalhe(null); }, 'Sem permissão pra excluir (coordenação+)'); }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-ber-red/40 text-ber-red hover:bg-red-50 disabled:opacity-50 ml-auto"
                >
                  <Trash2 size={13} /> Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editando && (
        <EditSheet
          pendencia={editando}
          busy={busy}
          onClose={() => setEditando(null)}
          onSave={(patch) => run(async () => {
            await api.patch(`/obras/${obraId}/pendencias/${editando.id}`, patch);
            setEditando(null);
          }, 'Erro ao salvar edição')}
        />
      )}

      {/* ── Opções do PDF ── */}
      {showPdf && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => !busy && setShowPdf(false)}>
          <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-ber-carbon">Gerar PDF</h2>
              <button onClick={() => setShowPdf(false)} disabled={busy} className="text-ber-gray hover:text-ber-carbon"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <label className="block text-[11px] font-semibold text-ber-gray">
                O que incluir
                <select value={pdfFiltro} onChange={(e) => setPdfFiltro(e.target.value)} className={`${inputCls} mt-1`}>
                  <option value="abertas">Só as em aberto</option>
                  <option value="atrasadas">Só as atrasadas</option>
                  <option value="solicitacoes">Só solicitações do cliente</option>
                  <option value="alta">Só alta criticidade</option>
                  <option value="concluidas">Só concluídas</option>
                  <option value="todas">Tudo (abertas + concluídas)</option>
                </select>
              </label>
              <label className="block text-[11px] font-semibold text-ber-gray">
                Ambiente
                <select value={pdfAmbiente} onChange={(e) => setPdfAmbiente(e.target.value)} className={`${inputCls} mt-1`}>
                  <option value="todos">Todos os ambientes</option>
                  {ambientes.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-ber-carbon">
                <input type="checkbox" checked={pdfFotos} onChange={(e) => setPdfFotos(e.target.checked)} className="accent-ber-carbon" />
                Incluir registro fotográfico (antes/depois)
              </label>
              <button onClick={gerarPdf} disabled={busy} className="w-full bg-ber-carbon text-white font-bold text-sm py-3 rounded-lg hover:opacity-90 disabled:opacity-50">
                {busy ? 'Gerando…' : 'Gerar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Nova pendência ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => !busy && setShowForm(false)}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl p-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-ber-carbon">Nova pendência</h2>
              <button onClick={() => setShowForm(false)} disabled={busy} className="text-ber-gray hover:text-ber-carbon"><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                {(['pendencia', 'solicitacao'] as const).map((t) => (
                  <button key={t} onClick={() => setFTipo(t)} className={`flex-1 text-xs font-semibold py-2 rounded-lg border ${fTipo === t ? (t === 'solicitacao' ? 'bg-purple-600 text-white border-purple-600' : 'bg-ber-carbon text-white border-ber-carbon') : 'bg-white text-ber-gray border-ber-border'}`}>
                    {t === 'pendencia' ? 'Pendência' : 'Solicitação do cliente'}
                  </button>
                ))}
              </div>
              <input value={fAmbiente} onChange={(e) => setFAmbiente(e.target.value)} placeholder="Ambiente (ex: Recepção)" className={inputCls} list="ambientes-list" />
              <datalist id="ambientes-list">{ambientes.map((a) => <option key={a} value={a} />)}</datalist>
              <textarea value={fAtividade} onChange={(e) => setFAtividade(e.target.value)} placeholder="Atividade / o que precisa ser feito" rows={2} className={inputCls} />
              <div className="grid grid-cols-2 gap-2">
                <input value={fDisciplina} onChange={(e) => setFDisciplina(e.target.value)} placeholder="Disciplina" className={inputCls} />
                <input value={fFornecedor} onChange={(e) => setFFornecedor(e.target.value)} placeholder="Fornecedor" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] font-semibold text-ber-gray">
                  Apontado por
                  <select value={fApontado} onChange={(e) => setFApontado(e.target.value as 'ber' | 'cliente')} className={`${inputCls} mt-1`}>
                    <option value="ber">BÈR</option>
                    <option value="cliente">Cliente</option>
                  </select>
                </label>
                <label className="text-[11px] font-semibold text-ber-gray">
                  Criticidade
                  <select value={fCrit} onChange={(e) => setFCrit(e.target.value as 'baixa' | 'media' | 'alta')} className={`${inputCls} mt-1`}>
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                  </select>
                </label>
              </div>
              <label className="block text-[11px] font-semibold text-ber-gray">
                Prazo (término previsto)
                <input type="date" value={fTermino} onChange={(e) => setFTermino(e.target.value)} className={`${inputCls} mt-1`} />
              </label>
              <textarea value={fObs} onChange={(e) => setFObs(e.target.value)} placeholder="Observações (opcional)" rows={2} className={inputCls} />
              <label className="flex items-center gap-2 text-sm text-ber-gray border border-dashed border-ber-border rounded-lg px-3 py-3 cursor-pointer hover:bg-ber-surface">
                <Camera size={18} className="text-ber-teal" />
                {fFoto ? <span className="text-ber-carbon font-medium">{fFoto.name}</span> : 'Foto do estado atual (opcional)'}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setFFoto(e.target.files?.[0] ?? null)} />
              </label>
              <button onClick={criar} disabled={busy} className="w-full bg-ber-carbon text-white font-bold text-sm py-3 rounded-lg hover:opacity-90 disabled:opacity-50">
                {busy ? 'Salvando…' : 'Criar pendência'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditSheet({ pendencia, busy, onClose, onSave }: {
  pendencia: Pendencia;
  busy: boolean;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [ambiente, setAmbiente] = useState(pendencia.ambiente);
  const [atividade, setAtividade] = useState(pendencia.atividade);
  const [disciplina, setDisciplina] = useState(pendencia.disciplina ?? '');
  const [fornecedor, setFornecedor] = useState(pendencia.fornecedor ?? '');
  const [apontadoPor, setApontadoPor] = useState<'ber' | 'cliente'>(pendencia.apontadoPor);
  const [tipo, setTipo] = useState<'pendencia' | 'solicitacao'>(pendencia.tipo);
  const [criticidade, setCriticidade] = useState<'baixa' | 'media' | 'alta'>(pendencia.criticidade);
  const [termino, setTermino] = useState(pendencia.dataTermino?.slice(0, 10) ?? '');
  const [obs, setObs] = useState(pendencia.observacoes ?? '');
  const inputCls = 'w-full text-sm px-3 py-2 border border-ber-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ber-teal bg-white';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => !busy && onClose()}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl p-5 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-ber-carbon">Editar pendência</h2>
          <button onClick={onClose} disabled={busy} className="text-ber-gray hover:text-ber-carbon"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['pendencia', 'solicitacao'] as const).map((t) => (
              <button key={t} onClick={() => setTipo(t)} className={`flex-1 text-xs font-semibold py-2 rounded-lg border ${tipo === t ? (t === 'solicitacao' ? 'bg-purple-600 text-white border-purple-600' : 'bg-ber-carbon text-white border-ber-carbon') : 'bg-white text-ber-gray border-ber-border'}`}>
                {t === 'pendencia' ? 'Pendência' : 'Solicitação do cliente'}
              </button>
            ))}
          </div>
          <input value={ambiente} onChange={(e) => setAmbiente(e.target.value)} placeholder="Ambiente" className={inputCls} />
          <textarea value={atividade} onChange={(e) => setAtividade(e.target.value)} rows={2} className={inputCls} />
          <div className="grid grid-cols-2 gap-2">
            <input value={disciplina} onChange={(e) => setDisciplina(e.target.value)} placeholder="Disciplina" className={inputCls} />
            <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Fornecedor" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-semibold text-ber-gray">
              Apontado por
              <select value={apontadoPor} onChange={(e) => setApontadoPor(e.target.value as 'ber' | 'cliente')} className={`${inputCls} mt-1`}>
                <option value="ber">BÈR</option>
                <option value="cliente">Cliente</option>
              </select>
            </label>
            <label className="text-[11px] font-semibold text-ber-gray">
              Criticidade
              <select value={criticidade} onChange={(e) => setCriticidade(e.target.value as 'baixa' | 'media' | 'alta')} className={`${inputCls} mt-1`}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </label>
          </div>
          <label className="block text-[11px] font-semibold text-ber-gray">
            Prazo (término previsto)
            <input type="date" value={termino} onChange={(e) => setTermino(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observações" rows={2} className={inputCls} />
          <button
            onClick={() => onSave({
              ambiente: ambiente.trim(), atividade: atividade.trim(),
              disciplina: disciplina.trim() || undefined, fornecedor: fornecedor.trim() || undefined,
              apontadoPor, tipo, criticidade,
              dataTermino: termino || undefined, observacoes: obs.trim() || undefined,
            })}
            disabled={busy || !ambiente.trim() || !atividade.trim()}
            className="w-full bg-ber-carbon text-white font-bold text-sm py-3 rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
