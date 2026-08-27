'use client';

/**
 * Pós-Obra · Pendências — Ficha de Pendências digitalizada (etapa 2, 27/08/26).
 * Decisões do Bruno: foto do estado atual na abertura + foto do concluído
 * OBRIGATÓRIA na baixa; tipo Pendência × Nova Solicitação (classificação
 * visual); criticidade 3 níveis; mobile-first (engenheiro residente em campo);
 * resumos calculados ao vivo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Camera, CheckCircle2, PauseCircle, PlayCircle, X, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';

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
}

interface Resumo {
  total: number;
  concluidas: number;
  abertas: number;
  atrasadas: number;
  bloqueadas: number;
  solicitacoesCliente: number;
  criticidadeAlta: number;
  porFornecedor: { nome: string; total: number; abertas: number; atrasadas: number }[];
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  aberta: { label: 'Aberta', cls: 'bg-gray-100 text-gray-700' },
  em_andamento: { label: 'Em andamento', cls: 'bg-blue-100 text-blue-700' },
  concluida: { label: 'Concluída', cls: 'bg-green-100 text-green-700' },
  bloqueada: { label: 'Bloqueada', cls: 'bg-red-100 text-red-700' },
};
const CRIT_DOT: Record<string, string> = {
  baixa: 'bg-gray-300',
  media: 'bg-amber-400',
  alta: 'bg-red-500',
};

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
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const fotoConclusaoInputs = useRef<Record<string, HTMLInputElement | null>>({});

  // form state
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
    return lista;
  }, [pendencias, filtroStatus]);

  const porAmbiente = useMemo(() => {
    const m = new Map<string, Pendencia[]>();
    for (const p of visiveis) {
      const arr = m.get(p.ambiente) ?? [];
      arr.push(p);
      m.set(p.ambiente, arr);
    }
    return [...m.entries()];
  }, [visiveis]);

  async function run(fn: () => Promise<unknown>, errMsg: string) {
    setBusy(true);
    setErro(null);
    try {
      await fn();
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setErro(msg || errMsg);
    } finally {
      setBusy(false);
    }
  }

  async function criar() {
    if (!fAmbiente.trim() || !fAtividade.trim()) { setErro('Ambiente e atividade são obrigatórios'); return; }
    await run(async () => {
      const r = await api.post<{ data: Pendencia }>(`/obras/${obraId}/pendencias`, {
        ambiente: fAmbiente.trim(),
        atividade: fAtividade.trim(),
        disciplina: fDisciplina.trim() || undefined,
        fornecedor: fFornecedor.trim() || undefined,
        apontadoPor: fApontado,
        tipo: fTipo,
        criticidade: fCrit,
        dataTermino: fTermino || undefined,
        observacoes: fObs.trim() || undefined,
      });
      if (fFoto) {
        const fd = new FormData();
        fd.append('file', fFoto);
        await api.post(`/obras/${obraId}/pendencias/${r.data.data.id}/foto/abertura`, fd);
      }
      setShowForm(false);
      setFAmbiente(''); setFAtividade(''); setFDisciplina(''); setFFornecedor('');
      setFTermino(''); setFObs(''); setFFoto(null); setFTipo('pendencia'); setFCrit('media'); setFApontado('ber');
    }, 'Erro ao criar pendência');
  }

  async function enviarFotoConclusao(p: Pendencia, file: File) {
    await run(async () => {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/obras/${obraId}/pendencias/${p.id}/foto/conclusao`, fd);
      await api.patch(`/obras/${obraId}/pendencias/${p.id}/status`, { status: 'concluida' });
    }, 'Erro ao concluir');
  }

  async function mudarStatus(p: Pendencia, status: string, motivoBloqueio?: string) {
    await run(
      () => api.patch(`/obras/${obraId}/pendencias/${p.id}/status`, { status, motivoBloqueio }),
      'Erro ao mudar status',
    );
  }

  const inputCls = 'w-full text-sm px-3 py-2 border border-ber-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ber-teal bg-white';
  const chip = (label: string, valor: number, destaque?: string) => (
    <div className={`rounded-lg px-3 py-2 border text-center min-w-[76px] ${destaque ?? 'bg-white border-ber-border'}`}>
      <p className="text-lg font-bold leading-tight">{valor}</p>
      <p className="text-[10px] text-ber-gray font-medium">{label}</p>
    </div>
  );

  return (
    <div className="max-w-3xl pb-24">
      <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1.5 text-sm text-ber-gray hover:text-ber-carbon mb-4">
        <ArrowLeft size={16} /> Voltar à obra
      </Link>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-ber-carbon">Pendências</h1>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-ber-carbon text-white rounded-lg px-3.5 py-2 hover:opacity-90"
        >
          <Plus size={16} /> Nova
        </button>
      </div>

      {resumo && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          {chip('Abertas', resumo.abertas)}
          {chip('Atrasadas', resumo.atrasadas, resumo.atrasadas > 0 ? 'bg-red-50 border-red-200 text-red-700' : undefined)}
          {chip('Alta crit.', resumo.criticidadeAlta, resumo.criticidadeAlta > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : undefined)}
          {chip('Solicit. cliente', resumo.solicitacoesCliente, 'bg-purple-50 border-purple-200 text-purple-700')}
          {chip('Concluídas', resumo.concluidas, 'bg-green-50 border-green-200 text-green-700')}
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4">
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
        porAmbiente.map(([ambiente, itens]) => (
          <div key={ambiente} className="mb-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ber-teal mb-1.5">{ambiente}</p>
            <div className="space-y-2">
              {itens.map((p) => {
                const late = atrasada(p);
                return (
                  <div key={p.id} className={`bg-white border rounded-xl p-3.5 ${late ? 'border-red-300' : 'border-ber-border'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ber-carbon leading-snug">
                          <span className={`inline-block w-2 h-2 rounded-full mr-1.5 align-middle ${CRIT_DOT[p.criticidade]}`} title={`Criticidade ${p.criticidade}`} />
                          {p.atividade}
                          {p.tipo === 'solicitacao' && (
                            <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 align-middle">SOLICITAÇÃO CLIENTE</span>
                          )}
                        </p>
                        <p className="text-[11px] text-ber-gray mt-0.5">
                          {p.fornecedor || 'sem fornecedor'}{p.disciplina ? ` · ${p.disciplina}` : ''} · até{' '}
                          <span className={late ? 'text-red-600 font-bold' : ''}>{fmtBR(p.dataTermino)}</span>
                          {late && ' ⚠'}
                        </p>
                        {p.status === 'bloqueada' && p.motivoBloqueio && (
                          <p className="text-[11px] text-red-600 mt-0.5">🚫 {p.motivoBloqueio}</p>
                        )}
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_CFG[p.status].cls}`}>
                        {STATUS_CFG[p.status].label}
                      </span>
                    </div>

                    {(p.fotoAberturaUrl || p.fotoConclusaoUrl) && (
                      <div className="flex gap-2 mt-2">
                        {p.fotoAberturaUrl && (
                          <a href={p.fotoAberturaUrl} target="_blank" rel="noopener noreferrer" className="block">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.fotoAberturaUrl} alt="Foto do estado atual" className="h-16 w-16 object-cover rounded-lg border border-ber-border" />
                          </a>
                        )}
                        {p.fotoConclusaoUrl && (
                          <a href={p.fotoConclusaoUrl} target="_blank" rel="noopener noreferrer" className="block relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.fotoConclusaoUrl} alt="Foto do concluído" className="h-16 w-16 object-cover rounded-lg border border-green-300" />
                            <CheckCircle2 size={14} className="absolute -top-1 -right-1 text-green-600 bg-white rounded-full" />
                          </a>
                        )}
                      </div>
                    )}

                    {p.status !== 'concluida' && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {p.status === 'aberta' && (
                          <button disabled={busy} onClick={() => mudarStatus(p, 'em_andamento')} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-ber-border hover:bg-ber-surface disabled:opacity-50">
                            <PlayCircle size={13} /> Iniciar
                          </button>
                        )}
                        {p.status === 'bloqueada' ? (
                          <button disabled={busy} onClick={() => mudarStatus(p, 'em_andamento')} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-ber-border hover:bg-ber-surface disabled:opacity-50">
                            <PlayCircle size={13} /> Desbloquear
                          </button>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={() => {
                              const motivo = window.prompt('Motivo do bloqueio:');
                              if (motivo?.trim()) mudarStatus(p, 'bloqueada', motivo.trim());
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-ber-border text-ber-gray hover:bg-ber-surface disabled:opacity-50"
                          >
                            <PauseCircle size={13} /> Bloquear
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => fotoConclusaoInputs.current[p.id]?.click()}
                          className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-ber-green text-white hover:opacity-90 disabled:opacity-50"
                          title="Tira a foto do serviço concluído — a baixa exige a evidência"
                        >
                          <Camera size={13} /> Concluir com foto
                        </button>
                        <input
                          ref={(el) => { fotoConclusaoInputs.current[p.id] = el; }}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) enviarFotoConclusao(p, f);
                            e.target.value = '';
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* ── Nova pendência (sheet mobile-first) ── */}
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
              <input value={fAmbiente} onChange={(e) => setFAmbiente(e.target.value)} placeholder="Ambiente (ex: Recepção)" className={inputCls} />
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
