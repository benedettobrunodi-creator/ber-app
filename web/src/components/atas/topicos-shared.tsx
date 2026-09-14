'use client';

/**
 * Tabela de tópicos da ATA VIVA — compartilhada entre a página da obra
 * (obras/[id]/atas) e a Reunião de Engenharia (/atas/[id]). Extraída em
 * 14/09/26; comportamento idêntico ao original, + prop opcional `diff`
 * (selos "novo/alterado/concluído desde a última reunião").
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Trash2, ChevronDown, ChevronRight, Check } from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────────────────

export type Status = 'concluido' | 'em_andamento' | 'atrasado';
export type Impacto = 'sem_impacto' | 'custo' | 'cronograma' | 'projeto';

export interface ObraHeader {
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

export interface Stakeholder {
  id: string;
  empresa: string;
  nome: string;
  funcao: string | null;
  email: string | null;
  telefone: string | null;
}

export interface UserOption { id: string; name: string }

export interface Atualizacao {
  id: string;
  data: string;
  texto: string;
  createdAt?: string;
}

export interface Topico {
  id: string;
  ordem: number;
  status: Status;
  impacto: Impacto;
  changeOrder: boolean;
  disciplina: string | null;
  tema: string | null;
  observacoes: string | null;
  responsavelId: string | null;
  responsavelStakeholderId: string | null;
  acao: string | null;
  confirmado: boolean;
  dataInfo: string | null;
  dataAlvo: string | null;
  dataFinal: string | null;
  responsavel: UserOption | null;
  responsavelStakeholder: { id: string; nome: string; empresa: string } | null;
  atualizacoes: Atualizacao[];
}

export interface AtaCorrida {
  obra: ObraHeader;
  stakeholders: Stakeholder[];
  topicos: Topico[];
}

// ── Constantes UI ─────────────────────────────────────────────────────────

export const STATUS_OPTIONS: { value: Status; label: string; cls: string; rank: number }[] = [
  { value: 'atrasado',     label: 'Atrasado',     cls: 'bg-red-100 text-red-700',     rank: 0 },
  { value: 'em_andamento', label: 'Em andamento', cls: 'bg-blue-100 text-blue-700',   rank: 1 },
  { value: 'concluido',    label: 'Concluído',    cls: 'bg-green-100 text-green-700', rank: 2 },
];

export const IMPACTO_OPTIONS: { value: Impacto; label: string; cls: string }[] = [
  { value: 'sem_impacto', label: 'Sem impacto', cls: 'bg-gray-100 text-gray-600' },
  { value: 'custo',       label: 'Custo',       cls: 'bg-amber-100 text-amber-700' },
  { value: 'cronograma',  label: 'Cronograma',  cls: 'bg-purple-100 text-purple-700' },
  { value: 'projeto',     label: 'Projeto',     cls: 'bg-indigo-100 text-indigo-700' },
];

// Classificação do item: informação registrada ou ação a executar.
export const ACAO_OPTIONS: { value: string; label: string }[] = [
  { value: 'informacao', label: 'Informação' },
  { value: 'acao',       label: 'Ação' },
];

export const statusOf  = (s: Status)  => STATUS_OPTIONS.find(o => o.value === s) ?? STATUS_OPTIONS[1];
export const impactoOf = (i: Impacto) => IMPACTO_OPTIONS.find(o => o.value === i) ?? IMPACTO_OPTIONS[0];

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

export const daysDiff = (alvo: string | null, fin: string | null) => {
  if (!alvo || !fin) return null;
  const diff = (new Date(fin).getTime() - new Date(alvo).getTime()) / (1000 * 60 * 60 * 24);
  return Math.round(diff);
};

export const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

/** Timestamp usado pra ordenar dentro de cada bucket de status: mais antigo primeiro.
 *  Prioridade: dataAlvo > dataInfo > createdAt implícito (nunca chega null aqui). */
export const priorityTs = (t: Topico) => {
  const d = t.dataAlvo ?? t.dataInfo;
  if (!d) return Number.POSITIVE_INFINITY; // sem data cai por último
  return new Date(d).getTime();
};

export const sortTopicos = (topicos: Topico[]): Topico[] => {
  // Itens confirmados entram na ordenação por prioridade (status + data).
  // Itens ainda NÃO confirmados ficam fixos no fim, em ordem de criação, pra não
  // "pular de lugar" enquanto o usuário preenche (só entram na ordem ao confirmar).
  const confirmados = topicos.filter(t => t.confirmado);
  const pendentes = topicos.filter(t => !t.confirmado);
  confirmados.sort((a, b) => {
    const rankDiff = statusOf(a.status).rank - statusOf(b.status).rank;
    if (rankDiff !== 0) return rankDiff;
    return priorityTs(a) - priorityTs(b);
  });
  pendentes.sort((a, b) => a.ordem - b.ordem);
  return [...confirmados, ...pendentes];
};

// ── Página ────────────────────────────────────────────────────────────────


const DIFF_CLS: Record<string, string> = {
  novo: 'bg-blue-100 text-blue-700',
  alterado: 'bg-amber-100 text-amber-700',
  concluido: 'bg-green-100 text-green-700',
};
const DIFF_LABEL: Record<string, string> = { novo: 'novo', alterado: 'alterado', concluido: 'concluído' };
function DiffBadge({ tipo }: { tipo?: string }) {
  if (!tipo) return null;
  return <span className={`ml-1.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase align-middle ${DIFF_CLS[tipo] ?? ''}`}>{DIFF_LABEL[tipo] ?? tipo}</span>;
}

export function TopicosTable({
  topicos, stakeholders, diff,
  onUpdateTopico, onRemoveTopico, onAddAtualizacao, onRemoveAtualizacao,
}: {
  topicos: Topico[];
  stakeholders: Stakeholder[];
  diff?: Record<string, 'novo' | 'alterado' | 'concluido'>;
  onUpdateTopico: <K extends keyof Topico>(id: string, field: K, value: Topico[K]) => void;
  onRemoveTopico: (id: string) => void;
  onAddAtualizacao: (topicoId: string, data: string, texto: string) => void;
  onRemoveAtualizacao: (topicoId: string, atualizacaoId: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setExpanded(s => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <>
    {/* Cards mobile (auditoria 11/09): a tabela de 16 colunas fica só no desktop */}
    <div className="mt-3 space-y-3 md:hidden">
      {topicos.map((t) => {
        const st = STATUS_OPTIONS.find(o => o.value === t.status);
        return (
          <div key={t.id} className="rounded-xl border border-ber-gray/15 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-sm font-semibold text-ber-carbon">{t.tema || t.disciplina || `Tópico #${t.ordem}`}<DiffBadge tipo={diff?.[t.id]} /></p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st?.cls ?? ''}`}>{st?.label ?? t.status}</span>
            </div>
            {t.observacoes && <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-ber-gray">{t.observacoes}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ber-gray">
              {(t.responsavel?.name || t.responsavelStakeholder?.nome) && <span>resp. {t.responsavel?.name ?? t.responsavelStakeholder?.nome}</span>}
              {t.dataAlvo && <span>alvo {new Date(t.dataAlvo).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>}
              {t.changeOrder && <span className="font-semibold text-amber-700">CO</span>}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <StatusSelect value={t.status} onChange={v => onUpdateTopico(t.id, 'status', v)} />
              <input type="date" value={t.dataAlvo ? t.dataAlvo.slice(0, 10) : ''}
                onChange={e => onUpdateTopico(t.id, 'dataAlvo', (e.target.value || null) as Topico['dataAlvo'])}
                className="min-h-[36px] rounded border border-ber-gray/20 bg-white px-2 py-1 text-xs" />
            </div>
          </div>
        );
      })}
      <p className="text-center text-[11px] text-ber-gray/70">Edição completa dos tópicos: use o computador (tabela integral).</p>
    </div>

    <div className="mt-3 hidden max-h-[70vh] overflow-auto rounded-xl border border-ber-gray/15 bg-white shadow-sm md:block">
      <table className="min-w-max text-xs">
        <thead className="bg-ber-bg sticky top-0 z-10">
          <tr className="border-b border-ber-gray/20 text-left">
            <Th className="w-8" />
            <Th className="w-10 text-center">#</Th>
            <Th className="w-32">Status</Th>
            <Th className="w-32">Impacto</Th>
            <Th className="w-16 text-center">CO</Th>
            <Th className="w-40">Disciplina</Th>
            <Th className="w-56">Tema</Th>
            <Th className="w-96">Observações</Th>
            <Th className="w-40">Responsável</Th>
            <Th className="w-36">Informação / Ação</Th>
            <Th className="w-28">Data Info</Th>
            <Th className="w-28">Data Alvo</Th>
            <Th className="w-28">Data Final</Th>
            <Th className="w-16 text-center">Δ dias</Th>
            <Th className="w-24 text-center">Histórico</Th>
            <Th className="w-20 text-center" />
          </tr>
        </thead>
        <tbody>
          {topicos.map((t, i) => {
            const dd = daysDiff(t.dataAlvo, t.dataFinal);
            const isOpen = expanded.has(t.id);
            return (
              <Fragment key={t.id}>
                <tr className={`border-b border-ber-gray/10 hover:bg-ber-bg/30 ${!t.confirmado ? 'bg-amber-50/70' : ''}`}>
                  <td className="px-1 py-1 text-center">
                    <button onClick={() => toggle(t.id)} className="rounded p-1 text-ber-gray hover:bg-ber-bg" title="Ver histórico">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </td>
                  <td className="px-1 py-2 text-center align-top text-xs font-bold text-ber-gray">{i + 1}</td>
                  <td className="px-2 py-2 align-top"><StatusSelect value={t.status} onChange={v => onUpdateTopico(t.id, 'status', v)} /></td>
                  <td className="px-2 py-2 align-top"><ImpactoSelect value={t.impacto} onChange={v => onUpdateTopico(t.id, 'impacto', v)} /></td>
                  <td className="px-2 py-2 text-center align-top">
                    <input type="checkbox" checked={t.changeOrder}
                      onChange={e => onUpdateTopico(t.id, 'changeOrder', e.target.checked)}
                      className="h-4 w-4 accent-ber-teal" />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <TextField value={t.disciplina} onSave={v => onUpdateTopico(t.id, 'disciplina', v)} placeholder="Disciplina…" />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <TextField value={t.tema} onSave={v => onUpdateTopico(t.id, 'tema', v)} placeholder="Tema…" />
                    <DiffBadge tipo={diff?.[t.id]} />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <TextAreaField value={t.observacoes} onSave={v => onUpdateTopico(t.id, 'observacoes', v)} placeholder="Observações livres…" />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <StakeholderSelect value={t.responsavelStakeholderId} stakeholders={stakeholders} onChange={v => onUpdateTopico(t.id, 'responsavelStakeholderId', v)} />
                  </td>
                  <td className="px-2 py-2 align-top">
                    <AcaoSelect value={t.acao} onChange={v => onUpdateTopico(t.id, 'acao', v)} />
                  </td>
                  <td className="px-2 py-2 align-top"><DateField value={t.dataInfo} onSave={v => onUpdateTopico(t.id, 'dataInfo', v)} /></td>
                  <td className="px-2 py-2 align-top"><DateField value={t.dataAlvo} onSave={v => onUpdateTopico(t.id, 'dataAlvo', v)} /></td>
                  <td className="px-2 py-2 align-top"><DateField value={t.dataFinal} onSave={v => onUpdateTopico(t.id, 'dataFinal', v)} /></td>
                  <td className={`px-2 py-1 text-center font-mono ${dd === null ? 'text-ber-gray/50' : dd > 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {dd === null ? '—' : dd}
                  </td>
                  <td className="px-2 py-2 text-center align-top">
                    <button onClick={() => toggle(t.id)}
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        t.atualizacoes.length > 0
                          ? 'bg-ber-teal/10 text-ber-teal hover:bg-ber-teal/20'
                          : 'text-ber-gray/60 hover:bg-ber-bg'
                      }`}
                      title="Ver histórico de atualizações">
                      {t.atualizacoes.length} {t.atualizacoes.length === 1 ? 'entrada' : 'entradas'}
                    </button>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex items-center justify-center gap-1">
                      {!t.confirmado && (
                        <button onClick={() => onUpdateTopico(t.id, 'confirmado', true)}
                          className="flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-green-700"
                          title="Confirmar item — entra na ordenação por prioridade">
                          <Check size={12} /> Confirmar
                        </button>
                      )}
                      <button onClick={() => onRemoveTopico(t.id)}
                        className="rounded p-1 text-ber-gray/50 hover:bg-red-50 hover:text-red-600"
                        title="Excluir tópico">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-ber-bg/30">
                    <td colSpan={16} className="px-4 py-3">
                      <HistoricoBlock
                        atualizacoes={t.atualizacoes}
                        onAdd={(data, texto) => onAddAtualizacao(t.id, data, texto)}
                        onRemove={(id) => onRemoveAtualizacao(t.id, id)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-2 py-2 text-[10px] font-bold uppercase tracking-wide text-ber-gray ${className}`}>{children}</th>;
}

// ── Histórico ─────────────────────────────────────────────────────────────

function HistoricoBlock({
  atualizacoes, onAdd, onRemove,
}: {
  atualizacoes: Atualizacao[];
  onAdd: (data: string, texto: string) => void;
  onRemove: (id: string) => void;
}) {
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [texto, setTexto] = useState('');
  const sorted = useMemo(
    () => [...atualizacoes].sort((a, b) => b.data.localeCompare(a.data)),
    [atualizacoes],
  );

  function submit() {
    const t = texto.trim();
    if (!t) return;
    onAdd(data, t);
    setTexto('');
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-ber-gray/20 bg-white p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-ber-gray">
          Nova atualização
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <input type="date" value={data} onChange={e => setData(e.target.value)}
            className="w-full rounded border border-ber-gray/30 px-2 py-1.5 text-xs sm:w-36" />
          <textarea value={texto} onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
            placeholder="O que aconteceu com esse tópico? (Cmd/Ctrl+Enter para salvar)"
            rows={2}
            className="flex-1 resize-y rounded border border-ber-gray/30 px-2 py-1.5 text-xs" />
          <button onClick={submit} disabled={!texto.trim()}
            className="rounded bg-ber-carbon px-3 py-1.5 text-xs font-semibold text-white hover:bg-ber-black disabled:cursor-not-allowed disabled:opacity-40">
            Adicionar
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs italic text-ber-gray">Sem atualizações ainda.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map(a => (
            <li key={a.id} className="flex items-start gap-3 rounded-lg border border-ber-gray/15 bg-white p-2 pl-3">
              <span className="mt-0.5 shrink-0 rounded bg-ber-bg px-2 py-0.5 font-mono text-[10px] font-semibold text-ber-carbon">
                {fmtDate(a.data)}
              </span>
              <p className="flex-1 whitespace-pre-wrap text-xs text-ber-carbon">{a.texto}</p>
              <button onClick={() => onRemove(a.id)}
                className="shrink-0 rounded p-1 text-ber-gray/50 hover:bg-red-50 hover:text-red-600"
                title="Excluir">
                <Trash2 size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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

function AcaoSelect({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value || null)}
      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[11px] text-ber-carbon focus:border-ber-teal focus:outline-none">
      <option value="">—</option>
      {ACAO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function StakeholderSelect({ value, stakeholders, onChange }: { value: string | null; stakeholders: Stakeholder[]; onChange: (v: string | null) => void }) {
  const emptyHint = stakeholders.length === 0 ? 'Sem stakeholders' : '—';
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value || null)}
      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[11px] text-ber-carbon focus:border-ber-teal focus:outline-none"
      disabled={stakeholders.length === 0 && !value}>
      <option value="">{emptyHint}</option>
      {stakeholders.map(s => (
        <option key={s.id} value={s.id}>{s.nome}{s.empresa ? ` — ${s.empresa}` : ''}</option>
      ))}
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

function TextAreaField({ value, onSave, placeholder }: { value: string | null; onSave: (v: string | null) => void; placeholder?: string }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  return (
    <textarea value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={() => { const next = draft.trim(); if (next !== (value ?? '')) onSave(next || null); }}
      placeholder={placeholder}
      rows={3}
      className="w-full resize-y rounded border border-transparent bg-transparent px-1.5 py-1 text-xs leading-relaxed text-ber-carbon placeholder-ber-gray/50 hover:border-ber-gray/20 focus:border-ber-teal focus:outline-none" />
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
