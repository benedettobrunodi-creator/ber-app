'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useBackToObra } from '@/hooks/useBackToObra';
import Link from 'next/link';
import { ArrowLeft, Rocket, FileDown } from 'lucide-react';
import api from '@/lib/api';

// ── Tipos ───────────────────────────────────────────────────────────────
interface KickoffHeader {
  coordenador: string | null;
  engenheiro: string | null;
  supervisor: string | null;
  mestreEncarregado: string | null;
  inicioObra: string | null;
  terminoObra: string | null;
  dataKickoff: string | null;
  participantesDeptos: Record<string, string> | null;
}
interface KickoffItem {
  id: string;
  secao: string;
  item: string;
  ordem: number;
  responsavel: string | null;
  resposta: string | null;
  naRede: string | null;
  dataAlvo: string | null;
  status: string | null;
  observacoes: string | null;
}
interface KickoffData {
  obra: { id: string; name: string };
  header: KickoffHeader | null;
  itens: KickoffItem[];
}

const DEPTOS: { key: string; label: string }[] = [
  { key: 'comercial', label: 'Comercial' },
  { key: 'pmo', label: 'PMO' },
  { key: 'suprimentos', label: 'Suprimentos' },
  { key: 'orcamentos', label: 'Orçamentos' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'coordenador', label: 'Coordenador' },
  { key: 'engenheiro', label: 'Engenheiro' },
];

const NAREDE_OPTS = [
  { value: '', label: '—' },
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
  { value: 'na', label: 'N/A' },
];
const STATUS_OPTS: { value: string; label: string; cls: string }[] = [
  { value: '', label: '—', cls: 'bg-ber-offwhite/40 text-ber-gray' },
  { value: 'concluido', label: 'Concluído', cls: 'bg-green-100 text-green-700' },
  { value: 'em_andamento', label: 'Em andamento', cls: 'bg-blue-100 text-blue-700' },
  { value: 'atrasado', label: 'Atrasado', cls: 'bg-red-100 text-red-700' },
  { value: 'na', label: 'N/A', cls: 'bg-ber-offwhite/40 text-ber-gray' },
];
const statusCls = (s: string | null) => STATUS_OPTS.find(o => o.value === (s ?? ''))?.cls ?? STATUS_OPTS[0].cls;

const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

export default function KickoffPage() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;
  const backHref = useBackToObra();

  const [data, setData] = useState<KickoffData | null>(null);
  const [users, setUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: KickoffData }>(`/obras/${obraId}/kickoff`);
      setData(res.data.data);
      setError('');
    } catch (err) {
      setError(errMsg(err, 'Erro ao carregar o kickoff'));
    } finally {
      setLoading(false);
    }
  }, [obraId]);

  useEffect(() => { load(); }, [load]);

  // Usuários cadastrados no app — sugestões pros campos de pessoas (datalist).
  useEffect(() => {
    api.get<{ data: { name: string }[] }>('/users/responsaveis')
      .then(r => setUsers((r.data.data ?? []).map(u => u.name).filter(Boolean)))
      .catch(() => setUsers([]));
  }, []);

  // Agrupa itens por seção preservando a ordem
  const secoes = useMemo(() => {
    const map = new Map<string, KickoffItem[]>();
    for (const it of data?.itens ?? []) {
      if (!map.has(it.secao)) map.set(it.secao, []);
      map.get(it.secao)!.push(it);
    }
    return Array.from(map.entries());
  }, [data]);

  // ── Salvar cabeçalho (auto-save por campo) ──
  async function saveHeader(patch: Record<string, unknown>) {
    setData(prev => prev ? { ...prev, header: { ...(prev.header ?? emptyHeader()), ...patch } as KickoffHeader } : prev);
    try {
      await api.put(`/obras/${obraId}/kickoff`, patch);
    } catch (err) { alert(errMsg(err, 'Erro ao salvar')); load(); }
  }
  function saveDepto(key: string, value: string) {
    const atual = data?.header?.participantesDeptos ?? {};
    saveHeader({ participantesDeptos: { ...atual, [key]: value } });
  }

  // ── Salvar item (auto-save inline) ──
  async function saveItem(id: string, patch: Partial<KickoffItem>) {
    setData(prev => prev ? { ...prev, itens: prev.itens.map(i => i.id === id ? { ...i, ...patch } : i) } : prev);
    try {
      await api.patch(`/obras/${obraId}/kickoff/itens/${id}`, patch);
    } catch (err) { alert(errMsg(err, 'Erro ao salvar item')); load(); }
  }

  async function gerarPdf() {
    setGeneratingPdf(true);
    try {
      const res = await api.get(`/obras/${obraId}/kickoff/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      alert(errMsg(err, 'Não consegui gerar o PDF do kickoff.'));
    } finally { setGeneratingPdf(false); }
  }

  const h = data?.header;
  const deptos = h?.participantesDeptos ?? {};
  // Pessoas cadastradas no cabeçalho do kickoff — viram sugestões da coluna Responsável.
  const pessoas = Array.from(new Set(
    [h?.coordenador, h?.engenheiro, h?.supervisor, h?.mestreEncarregado, ...Object.values(deptos)]
      .map(x => (x ?? '').trim())
      .filter(Boolean),
  ));

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={backHref} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> {data?.obra.name || 'Obra'}
        </Link>
        <span>/</span>
        <span className="font-medium text-ber-carbon">Kickoff</span>
      </div>

      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <Rocket size={20} className="text-ber-teal" />
        <h1 className="text-xl font-black text-ber-carbon">Kickoff da Obra</h1>
        <button onClick={gerarPdf} disabled={generatingPdf || !data}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-ber-carbon px-3 py-1.5 text-xs font-medium text-ber-carbon hover:bg-ber-carbon hover:text-white disabled:opacity-50">
          <FileDown size={14} /> {generatingPdf ? 'Gerando…' : 'Gerar PDF'}
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center text-sm text-ber-gray">Carregando…</div>
      ) : error ? (
        <div className="rounded-xl border-2 border-dashed border-red-200 bg-red-50 py-8 text-center text-sm text-red-700">{error}</div>
      ) : data ? (
        <>
          {/* Cabeçalho */}
          <div className="rounded-xl border border-ber-gray/15 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ber-gray">Dados do Kickoff</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <HField label="Coordenador" value={h?.coordenador} onSave={v => saveHeader({ coordenador: v })} options={users} />
              <HField label="Engenheiro" value={h?.engenheiro} onSave={v => saveHeader({ engenheiro: v })} options={users} />
              <HField label="Supervisor / Estagiário" value={h?.supervisor} onSave={v => saveHeader({ supervisor: v })} options={users} />
              <HField label="Mestre / Encarregado de Obras" value={h?.mestreEncarregado} onSave={v => saveHeader({ mestreEncarregado: v })} options={users} />
              <HDate label="Início da obra" value={h?.inicioObra} onSave={v => saveHeader({ inicioObra: v })} />
              <HDate label="Término da obra" value={h?.terminoObra} onSave={v => saveHeader({ terminoObra: v })} />
              <HDate label="Data do Kick Off" value={h?.dataKickoff} onSave={v => saveHeader({ dataKickoff: v })} />
            </div>
          </div>

          {/* Comercial x Engenharia */}
          <div className="mt-4 rounded-xl border border-ber-gray/15 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ber-gray">Comercial × Engenharia</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DEPTOS.map(d => (
                <HField key={d.key} label={d.label} value={deptos[d.key] ?? ''} onSave={v => saveDepto(d.key, v ?? '')} options={users} />
              ))}
            </div>
          </div>

          {/* Checklist por seção */}
          <div className="mt-6 space-y-5">
            {secoes.map(([secao, itens]) => (
              <div key={secao} className="overflow-hidden rounded-xl border border-ber-gray/15 bg-white shadow-sm">
                <div className="border-b border-ber-gray/15 bg-ber-bg px-4 py-2 text-xs font-bold uppercase tracking-wide text-ber-carbon">
                  {secao}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[900px] w-full text-xs">
                    <thead className="bg-ber-bg/50 text-left">
                      <tr className="text-[10px] font-bold uppercase tracking-wide text-ber-gray">
                        <th className="px-3 py-2 w-[32%]">Documento / Ação</th>
                        <th className="px-2 py-2 w-[16%]">Responsável</th>
                        <th className="px-2 py-2 w-[10%]">Na Rede</th>
                        <th className="px-2 py-2 w-[12%]">Data Alvo</th>
                        <th className="px-2 py-2 w-[14%]">Status</th>
                        <th className="px-2 py-2 w-[16%]">Observações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map(it => (
                        <tr key={it.id} className="border-b border-ber-gray/10 align-top">
                          <td className="px-3 py-2 text-ber-carbon">
                            <div className="flex items-center gap-2">
                              <span>{it.item}</span>
                              {/gest[ãa]o de gerenciadora/i.test(it.item) && (
                                <select value={it.resposta ?? ''} onChange={e => saveItem(it.id, { resposta: e.target.value || null })}
                                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-semibold focus:border-ber-teal focus:outline-none ${it.resposta === 'sim' ? 'border-green-300 bg-green-50 text-green-700' : it.resposta === 'nao' ? 'border-red-300 bg-red-50 text-red-700' : 'border-ber-gray/30 text-ber-gray'}`}>
                                  <option value="">Sim/Não?</option>
                                  <option value="sim">Sim</option>
                                  <option value="nao">Não</option>
                                </select>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <PessoaCell value={it.responsavel} onSave={v => saveItem(it.id, { responsavel: v })} options={pessoas} />
                          </td>
                          <td className="px-2 py-2">
                            <select value={it.naRede ?? ''} onChange={e => saveItem(it.id, { naRede: e.target.value || null })}
                              className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-[11px] hover:border-ber-gray/20 focus:border-ber-teal focus:outline-none">
                              {NAREDE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <DateCell value={it.dataAlvo} onSave={v => saveItem(it.id, { dataAlvo: v })} />
                          </td>
                          <td className="px-2 py-2">
                            <select value={it.status ?? ''} onChange={e => saveItem(it.id, { status: e.target.value || null })}
                              className={`w-full rounded px-1.5 py-1 text-[11px] font-semibold border border-transparent focus:border-ber-teal focus:outline-none ${statusCls(it.status)}`}>
                              {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <TextCell value={it.observacoes} onSave={v => saveItem(it.id, { observacoes: v })} placeholder="—" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function emptyHeader(): KickoffHeader {
  return { coordenador: null, engenheiro: null, supervisor: null, mestreEncarregado: null, inicioObra: null, terminoObra: null, dataKickoff: null, participantesDeptos: {} };
}

function HField({ label, value, onSave, options }: { label: string; value: string | null | undefined; onSave: (v: string | null) => void; options?: string[] }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  const listId = useId();
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-ber-gray">{label}</span>
      <input value={draft} onChange={e => setDraft(e.target.value)}
        list={options && options.length ? listId : undefined}
        placeholder={options && options.length ? 'Selecione ou digite…' : undefined}
        onBlur={() => { const n = draft.trim(); if (n !== (value ?? '')) onSave(n || null); }}
        className="w-full rounded-md border border-ber-gray/30 px-2 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
      {options && options.length > 0 && (
        <datalist id={listId}>
          {options.map(o => <option key={o} value={o} />)}
        </datalist>
      )}
    </label>
  );
}

function HDate({ label, value, onSave }: { label: string; value: string | null | undefined; onSave: (v: string | null) => void }) {
  const initial = value ? value.slice(0, 10) : '';
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial]);
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-ber-gray">{label}</span>
      <input type="date" value={draft} onChange={e => { setDraft(e.target.value); onSave(e.target.value || null); }}
        className="w-full rounded-md border border-ber-gray/30 px-2 py-1.5 text-sm focus:border-ber-teal focus:ring-1 focus:ring-ber-teal focus:outline-none" />
    </label>
  );
}

function TextCell({ value, onSave, placeholder }: { value: string | null; onSave: (v: string | null) => void; placeholder?: string }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  return (
    <textarea rows={1} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={() => { const n = draft.trim(); if (n !== (value ?? '')) onSave(n || null); }}
      placeholder={placeholder}
      className="w-full resize-y rounded border border-transparent bg-transparent px-1.5 py-1 text-[11px] text-ber-carbon placeholder-ber-gray/50 hover:border-ber-gray/20 focus:border-ber-teal focus:outline-none" />
  );
}

// Célula de Responsável — dropdown com as pessoas cadastradas no cabeçalho do
// kickoff (Dados do Kickoff + Comercial × Engenharia). Preserva valor legado.
function PessoaCell({ value, onSave, options }: { value: string | null; onSave: (v: string | null) => void; options: string[] }) {
  const opts = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select value={value ?? ''} onChange={e => onSave(e.target.value || null)}
      title={options.length ? undefined : 'Cadastre os nomes nos quadros do topo do kickoff'}
      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-[11px] text-ber-carbon hover:border-ber-gray/20 focus:border-ber-teal focus:outline-none">
      <option value="">—</option>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function DateCell({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const initial = value ? value.slice(0, 10) : '';
  const [draft, setDraft] = useState(initial);
  useEffect(() => setDraft(initial), [initial]);
  return (
    <input type="date" value={draft} onChange={e => { setDraft(e.target.value); onSave(e.target.value || null); }}
      className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-[11px] hover:border-ber-gray/20 focus:border-ber-teal focus:outline-none" />
  );
}
