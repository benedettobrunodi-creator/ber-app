'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Users, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { useBackToObra } from '@/hooks/useBackToObra';

// ── Tipos ─────────────────────────────────────────────────────────────────

type Status = 'concluido' | 'em_andamento' | 'atrasado';
type Impacto = 'sem_impacto' | 'custo' | 'cronograma' | 'projeto';

interface ObraHeader {
  id: string;
  name: string;
  client: string | null;
  address: string | null;
  arquiteturaEscritorio: string | null;
  gerenciadora: string | null;
  areaM2: number | null;
  dataInicioObra: string | null;
  dataFimObra: string | null;
}

interface Stakeholder {
  id: string;
  empresa: string;
  nome: string;
  funcao: string | null;
  email: string | null;
  telefone: string | null;
}

interface UserOption { id: string; name: string }

interface Topico {
  id: string;
  ordem: number;
  status: Status;
  impacto: Impacto;
  changeOrder: boolean;
  tema: string | null;
  area: string | null;
  responsavelId: string | null;
  dataInfo: string | null;
  dataAlvo: string | null;
  dataFinal: string | null;
  responsavel: UserOption | null;
}

interface Reuniao { id: string; data: string }
interface Nota { topicoId: string; reuniaoId: string; texto: string }

interface AtaCorrida {
  obra: ObraHeader;
  stakeholders: Stakeholder[];
  topicos: Topico[];
  reunioes: Reuniao[];
  notas: Nota[];
}

// ── Constantes UI ─────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: Status; label: string; cls: string }[] = [
  { value: 'em_andamento', label: 'Em andamento', cls: 'bg-blue-100 text-blue-700' },
  { value: 'concluido',    label: 'Concluído',    cls: 'bg-green-100 text-green-700' },
  { value: 'atrasado',     label: 'Atrasado',     cls: 'bg-red-100 text-red-700' },
];

const IMPACTO_OPTIONS: { value: Impacto; label: string; cls: string }[] = [
  { value: 'sem_impacto', label: 'Sem impacto', cls: 'bg-gray-100 text-gray-600' },
  { value: 'custo',       label: 'Custo',       cls: 'bg-amber-100 text-amber-700' },
  { value: 'cronograma',  label: 'Cronograma',  cls: 'bg-purple-100 text-purple-700' },
  { value: 'projeto',     label: 'Projeto',     cls: 'bg-indigo-100 text-indigo-700' },
];

const statusOf = (s: Status) => STATUS_OPTIONS.find(o => o.value === s) ?? STATUS_OPTIONS[0];
const impactoOf = (i: Impacto) => IMPACTO_OPTIONS.find(o => o.value === i) ?? IMPACTO_OPTIONS[0];

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

const daysDiff = (alvo: string | null, fin: string | null) => {
  if (!alvo || !fin) return null;
  const diff = (new Date(fin).getTime() - new Date(alvo).getTime()) / (1000 * 60 * 60 * 24);
  return Math.round(diff);
};

const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

// ── Página ────────────────────────────────────────────────────────────────

export default function AtaCorridaPage() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;
  const backHref = useBackToObra();

  const [ata, setAta] = useState<AtaCorrida | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddReuniao, setShowAddReuniao] = useState(false);
  const [newReuniaoData, setNewReuniaoData] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ataRes, usersRes] = await Promise.all([
        api.get<{ data: AtaCorrida }>(`/obras/${obraId}/atas`),
        api.get<{ data: UserOption[] }>('/users', { params: { limit: 200 } }).catch(() => ({ data: { data: [] as UserOption[] } })),
      ]);
      setAta(ataRes.data.data);
      setUsers(usersRes.data.data);
      setError(null);
    } catch (err) {
      setError(errMsg(err, 'Erro ao carregar ata'));
    } finally {
      setLoading(false);
    }
  }, [obraId]);

  useEffect(() => { load(); }, [load]);

  // mapa rápido de notas por (topicoId|reuniaoId)
  const notaMap = useMemo(() => {
    const m = new Map<string, string>();
    if (ata) for (const n of ata.notas) m.set(`${n.topicoId}|${n.reuniaoId}`, n.texto);
    return m;
  }, [ata]);

  // ── Mutations otimistas ────────────────────────────────────────────────

  async function addTopico() {
    try {
      const res = await api.post<{ data: Topico }>(`/obras/${obraId}/atas/topicos`, {});
      setAta(prev => prev ? { ...prev, topicos: [...prev.topicos, res.data.data] } : prev);
    } catch (err) { alert(errMsg(err, 'Erro ao criar tópico')); }
  }

  async function updateTopicoField<K extends keyof Topico>(topicoId: string, field: K, value: Topico[K]) {
    setAta(prev => prev ? {
      ...prev,
      topicos: prev.topicos.map(t => t.id === topicoId ? { ...t, [field]: value } : t),
    } : prev);
    try {
      await api.patch(`/obras/${obraId}/atas/topicos/${topicoId}`, { [field]: value });
    } catch (err) {
      alert(errMsg(err, 'Erro ao salvar'));
      load();
    }
  }

  async function removeTopico(topicoId: string) {
    if (!confirm('Excluir este tópico? As notas relacionadas também serão removidas.')) return;
    try {
      await api.delete(`/obras/${obraId}/atas/topicos/${topicoId}`);
      setAta(prev => prev ? {
        ...prev,
        topicos: prev.topicos.filter(t => t.id !== topicoId),
        notas: prev.notas.filter(n => n.topicoId !== topicoId),
      } : prev);
    } catch (err) { alert(errMsg(err, 'Erro ao excluir')); }
  }

  async function addReuniao() {
    try {
      const res = await api.post<{ data: Reuniao }>(`/obras/${obraId}/atas/reunioes`, { data: newReuniaoData });
      setAta(prev => prev ? {
        ...prev,
        reunioes: [...prev.reunioes, res.data.data].sort((a, b) => a.data.localeCompare(b.data)),
      } : prev);
      setShowAddReuniao(false);
    } catch (err) { alert(errMsg(err, 'Erro ao criar reunião')); }
  }

  async function removeReuniao(reuniaoId: string) {
    if (!confirm('Excluir esta reunião? Todas as notas dela serão removidas.')) return;
    try {
      await api.delete(`/obras/${obraId}/atas/reunioes/${reuniaoId}`);
      setAta(prev => prev ? {
        ...prev,
        reunioes: prev.reunioes.filter(r => r.id !== reuniaoId),
        notas: prev.notas.filter(n => n.reuniaoId !== reuniaoId),
      } : prev);
    } catch (err) { alert(errMsg(err, 'Erro ao excluir reunião')); }
  }

  async function saveNota(topicoId: string, reuniaoId: string, texto: string) {
    setAta(prev => {
      if (!prev) return prev;
      const without = prev.notas.filter(n => !(n.topicoId === topicoId && n.reuniaoId === reuniaoId));
      const next = texto.trim() ? [...without, { topicoId, reuniaoId, texto }] : without;
      return { ...prev, notas: next };
    });
    try {
      await api.put(`/obras/${obraId}/atas/notas`, { topicoId, reuniaoId, texto });
    } catch (err) {
      alert(errMsg(err, 'Erro ao salvar nota'));
      load();
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={backHref} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> {ata?.obra.name || 'Obra'}
        </Link>
        <span>/</span>
        <span className="font-medium text-ber-carbon">Atas de Reunião</span>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <FileSpreadsheet size={20} className="text-ber-teal" />
        <h1 className="text-xl font-black text-ber-carbon">Ata Corrida</h1>
        <span className="text-xs text-ber-gray">— Tópicos perenes × reuniões</span>
      </div>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center text-sm text-ber-gray">Carregando…</div>
      ) : error ? (
        <div className="rounded-xl border-2 border-dashed border-red-200 bg-red-50 py-8 text-center text-sm text-red-700">{error}</div>
      ) : ata ? (
        <>
          <ObraHeaderBox obra={ata.obra} />
          <StakeholdersBox stakeholders={ata.stakeholders} obraId={obraId} />

          <div className="mt-6 flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ber-gray">Tópicos × Reuniões</h2>
            <div className="flex items-center gap-2">
              <button onClick={addTopico}
                className="flex items-center gap-1.5 rounded-lg border border-ber-gray/30 px-3 py-1.5 text-xs font-medium text-ber-carbon hover:bg-ber-bg">
                <Plus size={12} /> Novo tópico
              </button>
              {showAddReuniao ? (
                <div className="flex items-center gap-2 rounded-lg border border-ber-teal/40 bg-white px-2 py-1">
                  <input type="date" value={newReuniaoData} onChange={e => setNewReuniaoData(e.target.value)}
                    className="rounded border border-ber-gray/30 px-2 py-1 text-xs" />
                  <button onClick={addReuniao} className="rounded bg-ber-teal px-2 py-1 text-xs font-semibold text-white">OK</button>
                  <button onClick={() => setShowAddReuniao(false)} className="rounded px-2 py-1 text-xs text-ber-gray">Cancelar</button>
                </div>
              ) : (
                <button onClick={() => setShowAddReuniao(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-1.5 text-xs font-medium text-white hover:bg-ber-black">
                  <Plus size={12} /> Nova reunião
                </button>
              )}
            </div>
          </div>

          {ata.topicos.length === 0 && ata.reunioes.length === 0 ? (
            <div className="mt-3 rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center">
              <AlertTriangle size={28} className="mx-auto mb-2 text-ber-gray/40" />
              <p className="text-sm font-medium text-ber-gray">Nenhum tópico ou reunião ainda.</p>
              <p className="mt-1 text-xs text-ber-gray/60">Use os botões acima para começar.</p>
            </div>
          ) : (
            <PlanilhaTopicos
              topicos={ata.topicos}
              reunioes={ata.reunioes}
              users={users}
              notaMap={notaMap}
              onUpdateTopico={updateTopicoField}
              onRemoveTopico={removeTopico}
              onRemoveReuniao={removeReuniao}
              onSaveNota={saveNota}
            />
          )}
        </>
      ) : null}
    </div>
  );
}

// ── Cabeçalho da obra ─────────────────────────────────────────────────────

function ObraHeaderBox({ obra }: { obra: ObraHeader }) {
  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-ber-gray/10 py-1.5 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-ber-gray">{label}</span>
      <span className="text-ber-carbon">{value || <span className="text-ber-gray/50 italic">não informado</span>}</span>
    </div>
  );
  return (
    <div className="rounded-xl border border-ber-gray/15 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ber-gray">Obra</h2>
      <Row label="Nome" value={obra.name} />
      <Row label="Cliente" value={obra.client} />
      <Row label="Endereço" value={obra.address} />
      <Row label="Arquitetura" value={obra.arquiteturaEscritorio} />
      <Row label="Gerenciadora" value={obra.gerenciadora} />
      <Row label="Área (m²)" value={obra.areaM2 ? `${obra.areaM2.toLocaleString('pt-BR')} m²` : null} />
      <Row label="Data Início" value={fmtDate(obra.dataInicioObra)} />
      <Row label="Data Fim" value={fmtDate(obra.dataFimObra)} />
    </div>
  );
}

// ── Stakeholders ──────────────────────────────────────────────────────────

function StakeholdersBox({ stakeholders, obraId }: { stakeholders: Stakeholder[]; obraId: string }) {
  return (
    <div className="mt-4 rounded-xl border border-ber-gray/15 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ber-gray flex items-center gap-2">
          <Users size={14} /> Stakeholders ({stakeholders.length})
        </h2>
        <Link href={`/obras/${obraId}/stakeholders`}
          className="text-xs font-medium text-ber-teal hover:underline">
          Gerenciar
        </Link>
      </div>
      {stakeholders.length === 0 ? (
        <p className="text-xs italic text-ber-gray">Nenhum stakeholder cadastrado. Use o link "Gerenciar" para adicionar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-ber-gray/15 text-left">
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-ber-gray">
                <th className="py-1.5 pr-3">Nome</th>
                <th className="py-1.5 pr-3">Empresa</th>
                <th className="py-1.5 pr-3">Função</th>
                <th className="py-1.5 pr-3">Email</th>
                <th className="py-1.5 pr-3">WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {stakeholders.map(s => (
                <tr key={s.id} className="border-b border-ber-gray/5">
                  <td className="py-1.5 pr-3 font-medium text-ber-carbon">{s.nome}</td>
                  <td className="py-1.5 pr-3 text-ber-carbon">{s.empresa}</td>
                  <td className="py-1.5 pr-3 text-ber-gray">{s.funcao || '—'}</td>
                  <td className="py-1.5 pr-3 text-ber-gray">{s.email || '—'}</td>
                  <td className="py-1.5 pr-3 text-ber-gray">{s.telefone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Planilha (tabela rolável) ────────────────────────────────────────────

function PlanilhaTopicos({
  topicos, reunioes, users, notaMap,
  onUpdateTopico, onRemoveTopico, onRemoveReuniao, onSaveNota,
}: {
  topicos: Topico[];
  reunioes: Reuniao[];
  users: UserOption[];
  notaMap: Map<string, string>;
  onUpdateTopico: <K extends keyof Topico>(id: string, field: K, value: Topico[K]) => void;
  onRemoveTopico: (id: string) => void;
  onRemoveReuniao: (id: string) => void;
  onSaveNota: (topicoId: string, reuniaoId: string, texto: string) => void;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-ber-gray/15 bg-white shadow-sm">
      <table className="min-w-max text-xs">
        <thead className="bg-ber-bg sticky top-0">
          <tr className="border-b border-ber-gray/20 text-left">
            <Th className="w-12 text-center">#</Th>
            <Th className="w-32">Status</Th>
            <Th className="w-32">Impacto</Th>
            <Th className="w-20 text-center">CO</Th>
            <Th className="w-56">Tema</Th>
            <Th className="w-40">Área</Th>
            <Th className="w-40">Responsável</Th>
            <Th className="w-28">Data Info</Th>
            <Th className="w-28">Data Alvo</Th>
            <Th className="w-28">Data Final</Th>
            <Th className="w-16 text-center">Δ dias</Th>
            {reunioes.map(r => (
              <Th key={r.id} className="w-56 border-l border-ber-gray/15">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ber-carbon">{fmtDate(r.data)}</span>
                  <button onClick={() => onRemoveReuniao(r.id)}
                    className="rounded p-0.5 text-ber-gray/50 hover:bg-red-50 hover:text-red-600"
                    title="Excluir reunião">
                    <Trash2 size={11} />
                  </button>
                </div>
              </Th>
            ))}
            <Th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {topicos.map(t => {
            const dd = daysDiff(t.dataAlvo, t.dataFinal);
            return (
              <tr key={t.id} className="border-b border-ber-gray/10 hover:bg-ber-bg/30">
                <td className="px-2 py-1 text-center font-mono text-ber-gray">{String(t.ordem).padStart(2, '0')}</td>
                <td className="px-2 py-1"><StatusSelect value={t.status} onChange={v => onUpdateTopico(t.id, 'status', v)} /></td>
                <td className="px-2 py-1"><ImpactoSelect value={t.impacto} onChange={v => onUpdateTopico(t.id, 'impacto', v)} /></td>
                <td className="px-2 py-1 text-center">
                  <input type="checkbox" checked={t.changeOrder}
                    onChange={e => onUpdateTopico(t.id, 'changeOrder', e.target.checked)}
                    className="h-4 w-4 accent-ber-teal" />
                </td>
                <td className="px-2 py-1">
                  <TextField value={t.tema} onSave={v => onUpdateTopico(t.id, 'tema', v)} placeholder="Tema…" />
                </td>
                <td className="px-2 py-1">
                  <TextField value={t.area} onSave={v => onUpdateTopico(t.id, 'area', v)} placeholder="Área…" />
                </td>
                <td className="px-2 py-1">
                  <UserSelect value={t.responsavelId} users={users} onChange={v => onUpdateTopico(t.id, 'responsavelId', v)} />
                </td>
                <td className="px-2 py-1"><DateField value={t.dataInfo} onSave={v => onUpdateTopico(t.id, 'dataInfo', v)} /></td>
                <td className="px-2 py-1"><DateField value={t.dataAlvo} onSave={v => onUpdateTopico(t.id, 'dataAlvo', v)} /></td>
                <td className="px-2 py-1"><DateField value={t.dataFinal} onSave={v => onUpdateTopico(t.id, 'dataFinal', v)} /></td>
                <td className={`px-2 py-1 text-center font-mono ${dd === null ? 'text-ber-gray/50' : dd > 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {dd === null ? '—' : dd}
                </td>
                {reunioes.map(r => (
                  <td key={r.id} className="px-2 py-1 border-l border-ber-gray/10 align-top">
                    <NotaField
                      value={notaMap.get(`${t.id}|${r.id}`) ?? ''}
                      onSave={txt => onSaveNota(t.id, r.id, txt)}
                    />
                  </td>
                ))}
                <td className="px-2 py-1 text-center">
                  <button onClick={() => onRemoveTopico(t.id)}
                    className="rounded p-1 text-ber-gray/50 hover:bg-red-50 hover:text-red-600"
                    title="Excluir tópico">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            );
          })}
          {topicos.length === 0 && (
            <tr>
              <td colSpan={12 + reunioes.length} className="py-8 text-center text-sm italic text-ber-gray">
                Nenhum tópico ainda. Use "Novo tópico" para começar.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-2 text-[10px] font-bold uppercase tracking-wide text-ber-gray ${className}`}>{children}</th>;
}

// ── Editores inline ──────────────────────────────────────────────────────

function StatusSelect({ value, onChange }: { value: Status; onChange: (v: Status) => void }) {
  const opt = statusOf(value);
  return (
    <select value={value} onChange={e => onChange(e.target.value as Status)}
      className={`w-full rounded px-1.5 py-1 text-[11px] font-semibold ${opt.cls} border border-transparent focus:border-ber-teal focus:outline-none`}>
      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function ImpactoSelect({ value, onChange }: { value: Impacto; onChange: (v: Impacto) => void }) {
  const opt = impactoOf(value);
  return (
    <select value={value} onChange={e => onChange(e.target.value as Impacto)}
      className={`w-full rounded px-1.5 py-1 text-[11px] font-semibold ${opt.cls} border border-transparent focus:border-ber-teal focus:outline-none`}>
      {IMPACTO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function UserSelect({ value, users, onChange }: { value: string | null; users: UserOption[]; onChange: (v: string | null) => void }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value || null)}
      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[11px] text-ber-carbon focus:border-ber-teal focus:outline-none">
      <option value="">—</option>
      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  );
}

function TextField({ value, onSave, placeholder }: { value: string | null; onSave: (v: string | null) => void; placeholder?: string }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  return (
    <input value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={() => { const next = draft.trim(); if (next !== (value ?? '')) onSave(next || null); }}
      placeholder={placeholder}
      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[11px] text-ber-carbon placeholder-ber-gray/50 hover:border-ber-gray/20 focus:border-ber-teal focus:outline-none" />
  );
}

function DateField({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const initial = value ? value.slice(0, 10) : '';
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial]);
  return (
    <input type="date" value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (draft !== initial) onSave(draft || null); }}
      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[11px] text-ber-carbon hover:border-ber-gray/20 focus:border-ber-teal focus:outline-none" />
  );
}

function NotaField({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const lastSaved = useRef(value);
  useEffect(() => { setDraft(value); lastSaved.current = value; }, [value]);
  return (
    <textarea value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (draft !== lastSaved.current) { lastSaved.current = draft; onSave(draft); } }}
      rows={2}
      className="w-full resize-y rounded border border-transparent bg-transparent px-1.5 py-1 text-[11px] text-ber-carbon placeholder-ber-gray/50 hover:border-ber-gray/20 focus:border-ber-teal focus:outline-none" />
  );
}
