'use client';

/**
 * Reunião de Engenharia — detalhe (14/09/26).
 * ABERTA: cada obra em andamento é uma seção expansível com a ATA VIVA da
 * obra (a MESMA de obras/[id]/atas — editar aqui edita lá), com selos de
 * diff vs a reunião anterior. ENCERRADA: mostra a fotografia imutável.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronRight, ClipboardList, FileDown, Lock, Plus } from 'lucide-react';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import { confirmar } from '@/lib/confirmar';
import {
  TopicosTable, sortTopicos, errMsg, fmtDate, STATUS_OPTIONS,
  type AtaCorrida, type Topico, type Atualizacao,
} from '@/components/atas/topicos-shared';

interface UserRow { id: string; name: string; email?: string | null; isActive?: boolean }
interface SnapshotTopico {
  id: string; status: string; impacto: string; changeOrder: boolean;
  disciplina: string | null; tema: string | null; observacoes: string | null;
  acao: string | null; dataInfo: string | null; dataAlvo: string | null; dataFinal: string | null;
  responsavelStakeholder: { nome: string } | null;
  atualizacoes: { id: string; data: string; texto: string }[];
}
interface ObraDaReuniao {
  obraId: string; obraNome: string;
  coordenadorId: string | null; coordenadorNome: string | null;
  engenheiroId?: string | null;
  engenheiroNome?: string | null;
  participantes?: { id: string; name: string }[];
  topicos: SnapshotTopico[];
}
interface Detalhe {
  reuniao: { id: string; data: string; status: 'aberta' | 'encerrada'; participantesIds: string[]; encerradaEm: string | null; enviadaEm: string | null };
  participantes: { id: string; name: string; email: string | null }[];
  obras: ObraDaReuniao[];
  diff?: Record<string, 'novo' | 'alterado' | 'concluido'>;
  diffBase?: { id: string; data: string } | null;
}

const fmtDataLonga = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

export default function ReuniaoDetalhePage() {
  const params = useParams<{ id: string }>();
  const reuniaoId = params.id;

  const [det, setDet] = useState<Detalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [equipe, setEquipe] = useState<UserRow[]>([]);
  const [encerrando, setEncerrando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/reunioes-engenharia/${reuniaoId}`);
      setDet(r.data.data);
    } catch {
      toast('Erro ao carregar a reunião', 'erro');
    } finally {
      setLoading(false);
    }
  }, [reuniaoId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/users', { params: { limit: 200 } }).then(r => setEquipe(r.data.data ?? [])).catch(() => {});
  }, []);

  const aberta = det?.reuniao.status === 'aberta';

  async function encerrar() {
    if (!(await confirmar('Encerrar a reunião? O estado atual de todas as obras vira a fotografia definitiva desta ata (não muda mais).', { titulo: 'Encerrar reunião', confirmarLabel: 'Encerrar' }))) return;
    setEncerrando(true);
    try {
      await api.post(`/reunioes-engenharia/${reuniaoId}/encerrar`);
      toast('Reunião encerrada — fotografia gravada ✓');
      await load();
    } catch (e) { toast(errMsg(e, 'Erro ao encerrar'), 'erro'); }
    finally { setEncerrando(false); }
  }

  async function gerarPdf() {
    setGerandoPdf(true);
    try {
      const win = window.open('', '_blank'); // síncrono no toque — iOS não bloqueia
      const res = await api.get(`/reunioes-engenharia/${reuniaoId}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      if (win) win.location.href = url; else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { toast(errMsg(e, 'Erro ao gerar o PDF'), 'erro'); }
    finally { setGerandoPdf(false); }
  }

  async function enviar() {
    if (!(await confirmar('Enviar a ata por e-mail? Cada engenheiro residente recebe as SUAS obras, com os participantes da obra em cópia.', { titulo: 'Enviar por engenheiro', confirmarLabel: 'Enviar' }))) return;
    setEnviando(true);
    try {
      const r = await api.post(`/reunioes-engenharia/${reuniaoId}/enviar`);
      const d = r.data.data ?? {};
      const n = (d.enviados ?? []).length;
      const fora = (d.semEngenheiro ?? []).length;
      toast(`E-mail enviado pra ${n} engenheiro(s) ✓${fora ? ` — ${fora} obra(s) sem engenheiro ficaram fora` : ''}`, fora ? 'aviso' : 'ok');
      await load();
    } catch (e) { toast(errMsg(e, 'Erro ao enviar'), 'erro'); }
    finally { setEnviando(false); }
  }

  // obras agrupadas por ENGENHEIRO residente (Bruno 14/09: a reunião é por engenheiro)
  const grupos = useMemo(() => {
    if (!det) return [];
    const m = new Map<string, ObraDaReuniao[]>();
    for (const o of det.obras) {
      const k = o.engenheiroNome ?? 'Sem engenheiro';
      m.set(k, [...(m.get(k) ?? []), o]);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [det]);

  if (loading) return <div className="p-6 text-sm text-ber-gray">Carregando…</div>;
  if (!det) return <div className="p-6 text-sm text-red-600">Reunião não encontrada.</div>;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href="/atas" className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> Reuniões
        </Link>
        <span>/</span>
        <span className="font-medium capitalize text-ber-carbon">{fmtDataLonga(det.reuniao.data)}</span>
      </div>

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <ClipboardList size={20} className="text-ber-teal" />
        <h1 className="text-xl font-black capitalize text-ber-carbon">Reunião de Engenharia</h1>
        {aberta ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Aberta</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
            <Lock size={10} /> Encerrada {det.reuniao.encerradaEm ? `em ${new Date(det.reuniao.encerradaEm).toLocaleDateString('pt-BR')}` : ''}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button onClick={gerarPdf} disabled={gerandoPdf}
            className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-ber-carbon px-3 py-1.5 text-xs font-medium text-ber-carbon hover:bg-ber-carbon hover:text-white disabled:opacity-50">
            <FileDown size={14} /> {gerandoPdf ? 'Gerando…' : 'PDF consolidado'}
          </button>
          <button onClick={enviar} disabled={enviando}
            title="Cada engenheiro residente recebe um e-mail com as SUAS obras (participantes da obra em cópia)"
            className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-ber-olive px-3 py-1.5 text-xs font-semibold text-ber-carbon hover:brightness-95 disabled:opacity-50">
            ✉ {enviando ? 'Enviando…' : 'Enviar por engenheiro'}
          </button>
          {aberta && (
            <button onClick={encerrar} disabled={encerrando}
              className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-1.5 text-xs font-semibold text-white hover:bg-ber-black disabled:opacity-50">
              <Lock size={13} /> {encerrando ? 'Encerrando…' : 'Encerrar reunião'}
            </button>
          )}
        </div>
      </div>

      {det.diffBase && aberta && (
        <p className="mb-3 text-xs text-ber-gray">
          Selos <span className="rounded bg-blue-100 px-1 font-bold text-blue-700">NOVO</span>{' '}
          <span className="rounded bg-amber-100 px-1 font-bold text-amber-700">ALTERADO</span>{' '}
          <span className="rounded bg-green-100 px-1 font-bold text-green-700">CONCLUÍDO</span>{' '}
          comparam com a reunião de {new Date(det.diffBase.data).toLocaleDateString('pt-BR')}.
        </p>
      )}

      {grupos.map(([coordenador, obras]) => (
        <div key={coordenador} className="mb-6">
          <h2 className="mb-2 border-b border-ber-gray/15 pb-1.5 text-sm font-bold uppercase tracking-wide text-ber-gray">
            {coordenador}
          </h2>
          <div className="space-y-2.5">
            {obras.map(o => aberta
              ? <ObraSecaoViva key={o.obraId} reuniaoId={reuniaoId} obraId={o.obraId} obraNome={o.obraNome} coordenadorNome={o.coordenadorNome} participantesIniciais={o.participantes ?? []} equipe={equipe} totalTopicos={o.topicos.length} diff={det.diff} />
              : <ObraSecaoSnapshot key={o.obraId} obra={o} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Reunião ABERTA: ata viva da obra, editável (mesma API da página da obra) ─── */

function ObraSecaoViva({ reuniaoId, obraId, obraNome, coordenadorNome, participantesIniciais, equipe, totalTopicos, diff }: {
  reuniaoId: string; obraId: string; obraNome: string; coordenadorNome?: string | null;
  participantesIniciais: { id: string; name: string }[];
  equipe: UserRow[];
  totalTopicos: number;
  diff?: Record<string, 'novo' | 'alterado' | 'concluido'>;
}) {
  const [open, setOpen] = useState(false);
  const [parts, setParts] = useState<{ id: string; name: string }[]>(participantesIniciais);
  const [mostrarSeletor, setMostrarSeletor] = useState(false);
  async function togglePart(u: UserRow) {
    const tem = parts.some(p => p.id === u.id);
    const novos = tem ? parts.filter(p => p.id !== u.id) : [...parts, { id: u.id, name: u.name }];
    setParts(novos);
    try {
      await api.patch(`/reunioes-engenharia/${reuniaoId}/participantes-obra`, { obraId, userIds: novos.map(p => p.id) });
    } catch { toast('Erro ao salvar participantes', 'erro'); setParts(parts); }
  }
  const [ata, setAta] = useState<AtaCorrida | null>(null);
  const [carregando, setCarregando] = useState(false);

  const load = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await api.get<{ data: AtaCorrida }>(`/obras/${obraId}/atas`);
      setAta(r.data.data);
    } catch { toast('Erro ao carregar a ata da obra', 'erro'); }
    finally { setCarregando(false); }
  }, [obraId]);

  useEffect(() => { if (open && !ata) load(); }, [open, ata, load]);

  const sorted = useMemo(() => ata ? sortTopicos(ata.topicos) : [], [ata]);

  async function addTopico() {
    try {
      const res = await api.post<{ data: Topico }>(`/obras/${obraId}/atas/topicos`, {});
      setAta(prev => prev ? { ...prev, topicos: [...prev.topicos, res.data.data] } : prev);
    } catch (e) { toast(errMsg(e, 'Erro ao criar tópico'), 'erro'); }
  }
  async function updateTopicoField<K extends keyof Topico>(topicoId: string, field: K, value: Topico[K]) {
    setAta(prev => prev ? { ...prev, topicos: prev.topicos.map(t => t.id === topicoId ? { ...t, [field]: value } : t) } : prev);
    try { await api.patch(`/obras/${obraId}/atas/topicos/${topicoId}`, { [field]: value }); }
    catch (e) { toast(errMsg(e, 'Erro ao salvar'), 'erro'); load(); }
  }
  async function removeTopico(topicoId: string) {
    if (!(await confirmar('Excluir este tópico? O histórico de atualizações também será removido.', { confirmarLabel: 'Excluir' }))) return;
    try {
      await api.delete(`/obras/${obraId}/atas/topicos/${topicoId}`);
      setAta(prev => prev ? { ...prev, topicos: prev.topicos.filter(t => t.id !== topicoId) } : prev);
    } catch (e) { toast(errMsg(e, 'Erro ao excluir'), 'erro'); }
  }
  async function addAtualizacao(topicoId: string, data: string, texto: string) {
    try {
      const res = await api.post<{ data: Atualizacao }>(`/obras/${obraId}/atas/topicos/${topicoId}/atualizacoes`, { data, texto });
      setAta(prev => prev ? { ...prev, topicos: prev.topicos.map(t => t.id === topicoId ? { ...t, atualizacoes: [res.data.data, ...t.atualizacoes] } : t) } : prev);
    } catch (e) { toast(errMsg(e, 'Erro ao adicionar atualização'), 'erro'); }
  }
  async function removeAtualizacao(topicoId: string, atualizacaoId: string) {
    if (!(await confirmar('Excluir esta entrada do histórico?', { confirmarLabel: 'Excluir' }))) return;
    try {
      await api.delete(`/obras/${obraId}/atas/atualizacoes/${atualizacaoId}`);
      setAta(prev => prev ? { ...prev, topicos: prev.topicos.map(t => t.id === topicoId ? { ...t, atualizacoes: t.atualizacoes.filter(a => a.id !== atualizacaoId) } : t) } : prev);
    } catch (e) { toast(errMsg(e, 'Erro ao excluir atualização'), 'erro'); }
  }

  const badges = useMemo(() => {
    if (!diff || !ata) return { novo: 0, alterado: 0, concluido: 0 };
    const c = { novo: 0, alterado: 0, concluido: 0 };
    for (const t of ata.topicos) { const d = diff[t.id]; if (d) c[d]++; }
    return c;
  }, [diff, ata]);

  return (
    <div className="rounded-xl border border-ber-gray/15 bg-white shadow-sm">
      <button onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left">
        {open ? <ChevronDown size={16} className="shrink-0 text-ber-gray" /> : <ChevronRight size={16} className="shrink-0 text-ber-gray" />}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ber-carbon">{obraNome}{coordenadorNome && <span className="ml-2 font-normal text-xs text-ber-gray">· Coord. {coordenadorNome.split(' ')[0]}</span>}{parts.length > 0 && <span className="ml-2 font-normal text-xs text-ber-teal">· {parts.length} participante(s)</span>}</span>
        {badges.novo > 0 && <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">{badges.novo} novo(s)</span>}
        {badges.alterado > 0 && <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{badges.alterado} alterado(s)</span>}
        {badges.concluido > 0 && <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">{badges.concluido} concluído(s)</span>}
        <span className="shrink-0 text-xs text-ber-gray">{ata ? ata.topicos.length : totalTopicos} tópico(s)</span>
      </button>
      {open && (
        <div className="border-t border-ber-gray/10 px-3 pb-4 pt-2">
          {carregando ? (
            <p className="py-6 text-center text-xs text-ber-gray">Carregando ata…</p>
          ) : ata ? (
            <>
              <div className="mb-2 rounded-lg border border-ber-gray/15 bg-ber-offwhite/50 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ber-gray">Participantes desta obra</p>
                  <button onClick={() => setMostrarSeletor(v => !v)}
                    className="rounded border border-ber-gray/30 px-2 py-1 text-[11px] font-medium text-ber-carbon hover:bg-white">
                    {mostrarSeletor ? 'Fechar' : 'Selecionar'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-ber-carbon">
                  {parts.length === 0 ? <span className="italic text-ber-gray/60">ninguém marcado</span> : parts.map(p => p.name).join(' · ')}
                </p>
                {mostrarSeletor && (
                  <div className="mt-2 grid grid-cols-1 gap-1 border-t border-ber-gray/10 pt-2 sm:grid-cols-2 lg:grid-cols-3">
                    {equipe.filter(u => u.isActive !== false).map(u => {
                      const marcado = parts.some(p => p.id === u.id);
                      return (
                        <label key={u.id} className={`flex min-h-[36px] cursor-pointer items-center gap-2 rounded border px-2 py-1 text-xs ${marcado ? 'border-ber-olive bg-ber-olive/10 font-medium' : 'border-ber-gray/15 text-ber-gray hover:bg-white'}`}>
                          <input type="checkbox" checked={marcado} onChange={() => togglePart(u)} className="h-3.5 w-3.5 accent-ber-olive" />
                          <span className="truncate">{u.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <Link href={`/obras/${obraId}/atas`} className="text-xs text-ber-teal hover:underline">abrir ata completa da obra →</Link>
                <button onClick={addTopico}
                  className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-1.5 text-xs font-medium text-white hover:bg-ber-black">
                  <Plus size={12} /> Novo tópico
                </button>
              </div>
              {sorted.length === 0 ? (
                <p className="py-6 text-center text-xs text-ber-gray">Nenhum tópico nesta obra ainda.</p>
              ) : (
                <TopicosTable
                  topicos={sorted}
                  stakeholders={ata.stakeholders}
                  diff={diff}
                  onUpdateTopico={updateTopicoField}
                  onRemoveTopico={removeTopico}
                  onAddAtualizacao={addAtualizacao}
                  onRemoveAtualizacao={removeAtualizacao}
                />
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ─── Reunião ENCERRADA: fotografia imutável ─── */

function ObraSecaoSnapshot({ obra }: { obra: ObraDaReuniao }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-ber-gray/15 bg-white shadow-sm">
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        {open ? <ChevronDown size={16} className="shrink-0 text-ber-gray" /> : <ChevronRight size={16} className="shrink-0 text-ber-gray" />}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ber-carbon">{obra.obraNome}{obra.coordenadorNome && <span className="ml-2 font-normal text-xs text-ber-gray">· Coord. {obra.coordenadorNome.split(' ')[0]}</span>}</span>
        <span className="shrink-0 text-xs text-ber-gray">{obra.topicos.length} tópico(s)</span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-ber-gray/10 px-3 pb-4 pt-3">
          {(obra.participantes ?? []).length > 0 && (
            <p className="mb-2 text-xs text-ber-gray"><span className="font-bold uppercase tracking-wide">Participantes:</span> {(obra.participantes ?? []).map(p => p.name).join(' · ')}</p>
          )}
          {obra.topicos.length === 0 ? (
            <p className="py-4 text-center text-xs text-ber-gray">Nenhum tópico nesta obra na data da reunião.</p>
          ) : (
            <table className="min-w-max text-xs">
              <thead>
                <tr className="border-b border-ber-gray/20 text-left text-[10px] font-bold uppercase tracking-wide text-ber-gray">
                  <th className="px-2 py-2 w-10 text-center">#</th>
                  <th className="px-2 py-2 w-28">Status</th>
                  <th className="px-2 py-2 w-40">Disciplina</th>
                  <th className="px-2 py-2 w-56">Tema</th>
                  <th className="px-2 py-2 w-96">Observações</th>
                  <th className="px-2 py-2 w-40">Responsável</th>
                  <th className="px-2 py-2 w-28">Data Alvo</th>
                  <th className="px-2 py-2 w-28">Data Final</th>
                </tr>
              </thead>
              <tbody>
                {obra.topicos.map((t, i) => {
                  const st = STATUS_OPTIONS.find(o => o.value === t.status);
                  return (
                    <tr key={t.id} className="border-b border-ber-gray/10 align-top">
                      <td className="px-2 py-2 text-center font-bold text-ber-gray">{i + 1}</td>
                      <td className="px-2 py-2"><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${st?.cls ?? ''}`}>{st?.label ?? t.status}</span></td>
                      <td className="px-2 py-2">{t.disciplina ?? '—'}</td>
                      <td className="px-2 py-2 font-medium text-ber-carbon">{t.tema ?? '—'}{t.changeOrder && <span className="ml-1 font-bold text-amber-700">CO</span>}</td>
                      <td className="px-2 py-2 whitespace-pre-line text-ber-gray">{t.observacoes ?? ''}</td>
                      <td className="px-2 py-2">{t.responsavelStakeholder?.nome ?? '—'}</td>
                      <td className="px-2 py-2">{t.dataAlvo ? fmtDate(t.dataAlvo) : '—'}</td>
                      <td className="px-2 py-2">{t.dataFinal ? fmtDate(t.dataFinal) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
