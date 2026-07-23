'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import api from '@/lib/api';
import { Plus, Trash2, Copy, Save, Settings2, X, DollarSign, Sigma, Check } from 'lucide-react';

interface Ciclo { id: string; nome: string; ano: number; ordem: number }
interface CellRef { linhaId: string; mes: number }
interface Linha {
  id: string;
  ordem: number;
  rotulo: string;
  kpiPct: number | null;
  orcamentoAnual: number | null;
  isTotal: boolean;
  isHeader: boolean;
  grupoId: string | null;
  valores: Record<number, number | null>;
  formulas: Record<number, CellRef[] | undefined>;
}
interface Snapshot { id: string; nome: string; ano: number; linhas: Linha[] }
interface SelectionState {
  target: CellRef;
  refs: CellRef[];
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MES_NUMS = [1,2,3,4,5,6,7,8,9,10,11,12];

function fmtBR(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '';
  return `${(n * 100).toFixed(1)}%`;
}
function parseBR(s: string): number | null {
  const t = s.trim().replace(/\./g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
}

/** Soma valores das filhas do mesmo grupo por mês (só quando linha é total). */
function computeTotais(linhas: Linha[], byId: Map<string, Linha>): Record<string, Record<number, number>> {
  const out: Record<string, Record<number, number>> = {};
  for (const l of linhas) {
    if (!l.isTotal) continue;
    const filhas = linhas.filter(x => x.grupoId === l.id && !x.isTotal);
    const acc: Record<number, number> = {};
    for (const m of MES_NUMS) {
      acc[m] = filhas.reduce((s, f) => s + resolveValor(f, m, byId), 0);
    }
    out[l.id] = acc;
  }
  return out;
}

/** Resolve valor de uma célula: se tiver fórmula, soma as refs (recursivo).
 *  Se for isTotal, soma filhas. Senão retorna valor manual. Evita ciclo por visited. */
function resolveValor(l: Linha, m: number, byId: Map<string, Linha>, visited: Set<string> = new Set()): number {
  const key = `${l.id}:${m}`;
  if (visited.has(key)) return 0;
  visited.add(key);
  if (l.isTotal) {
    let s = 0;
    for (const [, x] of byId) {
      if (x.grupoId === l.id && !x.isTotal) s += resolveValor(x, m, byId, visited);
    }
    return s;
  }
  const f = l.formulas?.[m];
  if (Array.isArray(f) && f.length > 0) {
    return f.reduce((s, ref) => {
      const src = byId.get(ref.linhaId);
      if (!src) return s;
      return s + resolveValor(src, ref.mes, byId, visited);
    }, 0);
  }
  const v = l.valores?.[m];
  return typeof v === 'number' ? v : 0;
}

/** Total anual (soma dos 12 meses resolvidos). */
function totalAnual(l: Linha, byId: Map<string, Linha>): number {
  return MES_NUMS.reduce((s, m) => s + resolveValor(l, m, byId), 0);
}

export default function DrePage() {
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [cicloId, setCicloId] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLinhaCfg, setShowLinhaCfg] = useState<Linha | null>(null);
  const [showNovoCiclo, setShowNovoCiclo] = useState(false);
  const [novoCicloForm, setNovoCicloForm] = useState({ nome: '', ano: new Date().getFullYear() });
  const [showDuplicar, setShowDuplicar] = useState(false);
  const [dupForm, setDupForm] = useState({ nome: '', ano: new Date().getFullYear() });
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const [selection, setSelection] = useState<SelectionState | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  async function loadCiclos() {
    const r = await api.get('/financeiro/ciclos');
    const list: Ciclo[] = r.data.data ?? [];
    setCiclos(list);
    if (list.length > 0 && !cicloId) setCicloId(list[0].id);
    if (list.length === 0) setLoading(false);
  }

  async function loadSnap(id: string) {
    setLoading(true);
    try {
      const r = await api.get(`/financeiro/ciclos/${id}/snapshot`);
      setSnap(r.data.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCiclos(); }, []);
  useEffect(() => { if (cicloId) loadSnap(cicloId); }, [cicloId]);

  // ── Computados ────────────────────────────────────────────────────────────
  const linhas = snap?.linhas ?? [];
  const linhasById = useMemo(() => new Map(linhas.map(l => [l.id, l])), [linhas]);
  const totais = useMemo(() => computeTotais(linhas, linhasById), [linhas, linhasById]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  function updateCellLocal(linhaId: string, mes: number, valor: number | null) {
    if (!snap) return;
    const next: Snapshot = {
      ...snap,
      linhas: snap.linhas.map(l => l.id !== linhaId ? l : {
        ...l,
        // ao digitar manual: remove fórmula (célula vira input direto)
        formulas: (() => { const f = { ...l.formulas }; delete f[mes]; return f; })(),
        valores: valor == null
          ? Object.fromEntries(Object.entries(l.valores).filter(([k]) => Number(k) !== mes))
          : { ...l.valores, [mes]: valor },
      }),
    };
    setSnap(next);
    const key = `${linhaId}:${mes}`;
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(async () => {
      setSavingCell(key);
      try {
        await api.put(`/financeiro/linhas/${linhaId}/valor`, { mes, valor });
      } catch (e: any) {
        alert(e?.response?.data?.error?.message ?? 'Erro ao salvar');
      } finally {
        setSavingCell(null);
      }
    }, 400);
  }

  async function salvarFormula() {
    if (!snap || !selection || selection.refs.length === 0) return;
    const { target, refs } = selection;
    try {
      await api.put(`/financeiro/linhas/${target.linhaId}/valor`, { mes: target.mes, formula: refs });
      setSnap({
        ...snap,
        linhas: snap.linhas.map(l => l.id !== target.linhaId ? l : {
          ...l,
          valores: (() => { const v = { ...l.valores }; delete v[target.mes]; return v; })(),
          formulas: { ...l.formulas, [target.mes]: refs },
        }),
      });
      setSelection(null);
    } catch (e: any) {
      alert(e?.response?.data?.error?.message ?? 'Erro ao salvar fórmula');
    }
  }

  function toggleRefNaSelecao(ref: CellRef) {
    if (!selection) return;
    // não pode referenciar a si mesmo
    if (ref.linhaId === selection.target.linhaId && ref.mes === selection.target.mes) return;
    const has = selection.refs.some(r => r.linhaId === ref.linhaId && r.mes === ref.mes);
    setSelection({
      ...selection,
      refs: has ? selection.refs.filter(r => !(r.linhaId === ref.linhaId && r.mes === ref.mes)) : [...selection.refs, ref],
    });
  }

  async function limparFormula(linhaId: string, mes: number) {
    if (!snap) return;
    try {
      await api.put(`/financeiro/linhas/${linhaId}/valor`, { mes, valor: null });
      setSnap({
        ...snap,
        linhas: snap.linhas.map(l => l.id !== linhaId ? l : {
          ...l,
          valores: (() => { const v = { ...l.valores }; delete v[mes]; return v; })(),
          formulas: (() => { const f = { ...l.formulas }; delete f[mes]; return f; })(),
        }),
      });
    } catch (e: any) {
      alert(e?.response?.data?.error?.message ?? 'Erro ao limpar');
    }
  }

  async function criarCiclo() {
    const r = await api.post('/financeiro/ciclos', novoCicloForm);
    const c = r.data.data as Ciclo;
    setCiclos(prev => [c, ...prev]);
    setCicloId(c.id);
    setShowNovoCiclo(false);
    setNovoCicloForm({ nome: '', ano: new Date().getFullYear() });
  }

  async function duplicarCiclo() {
    if (!cicloId) return;
    const r = await api.post(`/financeiro/ciclos/${cicloId}/duplicar`, dupForm);
    const c = r.data.data as Ciclo;
    setCiclos(prev => [c, ...prev]);
    setCicloId(c.id);
    setShowDuplicar(false);
    setDupForm({ nome: '', ano: new Date().getFullYear() });
  }

  async function addLinha(payload: Partial<Linha>) {
    if (!cicloId) return;
    const ordem = Math.max(0, ...(snap?.linhas ?? []).map(l => l.ordem)) + 1;
    const r = await api.post(`/financeiro/ciclos/${cicloId}/linhas`, { rotulo: 'Nova linha', ordem, ...payload });
    await loadSnap(cicloId);
    setShowLinhaCfg(r.data.data);
  }

  async function updateLinha(linhaId: string, patch: Partial<Linha>) {
    const body: any = { ...patch };
    await api.patch(`/financeiro/linhas/${linhaId}`, body);
    if (cicloId) await loadSnap(cicloId);
  }

  async function removerLinha(linhaId: string) {
    if (!confirm('Remover esta linha? Os valores também serão apagados.')) return;
    await api.delete(`/financeiro/linhas/${linhaId}`);
    if (cicloId) await loadSnap(cicloId);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 pt-5 pb-3 border-b border-ber-border bg-white">
        <DollarSign size={20} className="text-ber-teal shrink-0" />
        <div>
          <h1 className="font-bold text-ber-carbon text-lg leading-tight">DRE</h1>
          <p className="text-xs text-ber-gray">Demonstrativo de Resultado — Financeiro BÈR</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={cicloId ?? ''}
            onChange={e => setCicloId(e.target.value || null)}
            className="text-sm border border-ber-border rounded-lg px-3 py-1.5 min-w-[220px]"
          >
            {ciclos.length === 0 && <option value="">Nenhum ciclo — crie o primeiro</option>}
            {ciclos.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.ano})</option>)}
          </select>
          <button onClick={() => setShowNovoCiclo(true)}
            className="text-xs font-semibold border border-ber-border text-ber-carbon hover:bg-ber-surface rounded-lg px-3 py-1.5 flex items-center gap-1">
            <Plus size={13} /> Novo ciclo
          </button>
          {cicloId && (
            <button onClick={() => { setDupForm({ nome: `${snap?.nome ?? 'DRE'} (cópia)`, ano: snap?.ano ?? new Date().getFullYear() }); setShowDuplicar(true); }}
              className="text-xs font-semibold border border-ber-border text-ber-carbon hover:bg-ber-surface rounded-lg px-3 py-1.5 flex items-center gap-1">
              <Copy size={13} /> Duplicar
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {loading && <div className="text-sm text-ber-gray py-16 text-center">Carregando...</div>}
        {!loading && !snap && ciclos.length === 0 && (
          <div className="text-sm text-ber-gray py-16 text-center">
            Nenhum ciclo criado ainda. Clique em "Novo ciclo" pra começar.
          </div>
        )}
        {!loading && snap && (
          <div className="rounded-lg border border-ber-border overflow-x-auto bg-white">
            <table className="w-full text-xs">
              <thead className="bg-[#F7F7F5] sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2 font-bold text-ber-gray uppercase tracking-wide sticky left-0 bg-[#F7F7F5] min-w-[280px]">Linha</th>
                  <th className="text-right px-2 py-2 font-bold text-ber-gray uppercase tracking-wide w-16">KPI</th>
                  <th className="text-right px-2 py-2 font-bold text-ber-gray uppercase tracking-wide w-28">Orçado ano</th>
                  {MESES.map((m, i) => (
                    <th key={m} className="text-right px-2 py-2 font-bold text-ber-gray uppercase tracking-wide w-24">
                      {m}<span className="text-[9px] font-normal ml-0.5 text-ber-gray/60">/{String(snap.ano).slice(2)}</span>
                    </th>
                  ))}
                  <th className="text-right px-2 py-2 font-bold text-ber-gray uppercase tracking-wide w-28 bg-ber-surface">Total ano</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ber-border">
                {linhas.map(l => {
                  const isTotal = l.isTotal;
                  const isHeader = l.isHeader;
                  const totalRow = totais[l.id] ?? {};
                  return (
                    <tr key={l.id} className={
                      isHeader ? 'bg-ber-carbon/5 font-bold text-ber-carbon' :
                      isTotal ? 'bg-[#F7F7F5] font-semibold' : 'bg-white'
                    }>
                      <td className={`px-3 py-1.5 sticky left-0 ${isHeader ? 'bg-ber-carbon/5' : isTotal ? 'bg-[#F7F7F5]' : 'bg-white'}`}>
                        <div className="flex items-center gap-1.5">
                          <span className={isHeader ? 'uppercase tracking-wide' : ''}>{l.rotulo}</span>
                          <button onClick={() => setShowLinhaCfg(l)} className="text-ber-gray/30 hover:text-ber-carbon">
                            <Settings2 size={11} />
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right text-ber-gray">{fmtPct(l.kpiPct)}</td>
                      <td className="px-2 py-1.5 text-right">{fmtBR(l.orcamentoAnual)}</td>
                      {MES_NUMS.map(m => {
                        const key = `${l.id}:${m}`;
                        const saving = savingCell === key;
                        if (isTotal) {
                          return (
                            <td key={m} className="px-2 py-1.5 text-right text-ber-carbon">
                              {fmtBR(totalRow[m])}
                            </td>
                          );
                        }
                        const hasFormula = Array.isArray(l.formulas?.[m]) && (l.formulas[m] as CellRef[]).length > 0;
                        const inSelectionMode = !!selection;
                        const isTargetCell = selection && selection.target.linhaId === l.id && selection.target.mes === m;
                        const isSelected = selection?.refs.some(r => r.linhaId === l.id && r.mes === m);
                        const cellValue = hasFormula ? resolveValor(l, m, linhasById) : (l.valores[m] ?? null);

                        // Modo seleção: cada célula (exceto o próprio alvo) é clicável pra virar ref
                        if (inSelectionMode && !isTargetCell) {
                          return (
                            <td key={m} className={`px-1 py-1 text-right ${isHeader ? 'bg-ber-carbon/5' : ''}`}>
                              <button
                                onClick={() => toggleRefNaSelecao({ linhaId: l.id, mes: m })}
                                className={`w-24 py-1 px-1.5 text-right text-xs border rounded ${isHeader ? 'font-bold' : ''} ${isSelected ? 'bg-ber-teal/20 border-ber-teal' : 'border-transparent hover:border-ber-teal/60 hover:bg-ber-teal/5'}`}
                              >
                                {isSelected && '✓ '}{fmtBR(cellValue) || '—'}
                              </button>
                            </td>
                          );
                        }

                        // Célula normal com botão fx
                        return (
                          <td key={m} className={`group px-1 py-1 text-right relative ${isHeader ? 'bg-ber-carbon/5' : ''} ${isTargetCell ? 'bg-amber-100 ring-2 ring-amber-400 rounded' : ''}`}>
                            {hasFormula ? (
                              <div className={`w-24 py-1 px-1.5 text-right text-xs border rounded flex items-center justify-end gap-1 ${isHeader ? 'font-bold' : ''} bg-blue-50 border-blue-200 text-blue-900`}>
                                <Sigma size={9} />
                                <span>{fmtBR(cellValue)}</span>
                              </div>
                            ) : (
                              <input
                                type="text"
                                defaultValue={l.valores[m] != null ? fmtBR(l.valores[m]) : ''}
                                onBlur={e => {
                                  const v = parseBR(e.target.value);
                                  const cur = l.valores[m] ?? null;
                                  if (v !== cur) updateCellLocal(l.id, m, v);
                                }}
                                className={`w-24 py-1 px-1.5 text-right text-xs border rounded ${isHeader ? 'font-bold' : ''} ${saving ? 'border-ber-teal' : 'border-transparent hover:border-ber-border focus:border-ber-teal focus:outline-none'}`}
                                placeholder="—"
                              />
                            )}
                            {/* Botão fx / limpar */}
                            <button
                              onClick={() => {
                                if (hasFormula) {
                                  if (confirm('Remover fórmula desta célula?')) limparFormula(l.id, m);
                                } else {
                                  setSelection({ target: { linhaId: l.id, mes: m }, refs: [] });
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 absolute -top-1 -right-1 h-4 w-4 rounded-full bg-ber-carbon text-white text-[9px] flex items-center justify-center hover:bg-ber-teal transition-opacity"
                              title={hasFormula ? 'Remover fórmula' : 'Somar outras células (fórmula)'}
                            >
                              {hasFormula ? <X size={8} /> : <Sigma size={8} />}
                            </button>
                          </td>
                        );
                      })}
                      <td className={`px-2 py-1.5 text-right font-semibold bg-ber-surface`}>
                        {fmtBR(totalAnual(l, linhasById))}
                      </td>
                      <td className="px-1 py-1">
                        <button onClick={() => removerLinha(l.id)} className="text-ber-gray/20 hover:text-red-500">
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Add linha */}
            <div className="border-t border-ber-border bg-[#F7F7F5] px-3 py-2 flex gap-2">
              <button onClick={() => addLinha({ rotulo: 'Nova linha' })}
                className="text-xs font-semibold text-ber-gray hover:text-ber-carbon border border-ber-border hover:border-ber-carbon/40 rounded-lg px-3 py-1.5 flex items-center gap-1">
                <Plus size={12} /> Adicionar linha
              </button>
              <button onClick={() => addLinha({ rotulo: 'NOVA SEÇÃO', isHeader: true })}
                className="text-xs font-semibold text-ber-gray hover:text-ber-carbon border border-ber-border hover:border-ber-carbon/40 rounded-lg px-3 py-1.5 flex items-center gap-1">
                <Plus size={12} /> Adicionar cabeçalho
              </button>
              <button onClick={() => addLinha({ rotulo: 'Total', isTotal: true })}
                className="text-xs font-semibold text-ber-gray hover:text-ber-carbon border border-ber-border hover:border-ber-carbon/40 rounded-lg px-3 py-1.5 flex items-center gap-1">
                <Plus size={12} /> Adicionar total
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Barra flutuante do modo seleção */}
      {selection && (() => {
        const targetLinha = linhasById.get(selection.target.linhaId);
        const preview = selection.refs.reduce((s, r) => {
          const src = linhasById.get(r.linhaId);
          return s + (src ? resolveValor(src, r.mes, linhasById) : 0);
        }, 0);
        return (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full bg-ber-carbon text-white shadow-xl px-4 py-2 text-sm">
            <Sigma size={14} className="text-ber-teal" />
            <span className="text-xs">
              Selecionando células que somam em <b>{targetLinha?.rotulo}</b> · {MESES[selection.target.mes - 1]}
              {selection.refs.length > 0 && <> · {selection.refs.length} refs · total {fmtBR(preview)}</>}
            </span>
            <button
              onClick={salvarFormula}
              disabled={selection.refs.length === 0}
              className="text-xs font-semibold bg-ber-teal hover:bg-ber-teal/80 disabled:opacity-30 disabled:cursor-not-allowed rounded-full px-3 py-1 flex items-center gap-1"
            >
              <Check size={12} /> Salvar
            </button>
            <button
              onClick={() => setSelection(null)}
              className="text-xs text-white/60 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        );
      })()}

      {/* Modais */}
      {showNovoCiclo && (
        <Modal title="Novo ciclo" onClose={() => setShowNovoCiclo(false)}>
          <div className="space-y-3">
            <Field label="Nome"><input value={novoCicloForm.nome} onChange={e => setNovoCicloForm(f => ({ ...f, nome: e.target.value }))} className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm focus:border-ber-teal focus:outline-none" placeholder="DRE 2027" /></Field>
            <Field label="Ano"><input type="number" value={novoCicloForm.ano} onChange={e => setNovoCicloForm(f => ({ ...f, ano: +e.target.value }))} className="w-32 rounded-lg border border-ber-border bg-white px-3 py-2 text-sm focus:border-ber-teal focus:outline-none" /></Field>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowNovoCiclo(false)} className="text-xs text-ber-gray hover:text-ber-carbon px-3 py-1.5">Cancelar</button>
              <button onClick={criarCiclo} disabled={!novoCicloForm.nome} className="text-xs font-semibold bg-ber-carbon text-white rounded-lg px-4 py-1.5 disabled:opacity-40">Criar</button>
            </div>
          </div>
        </Modal>
      )}

      {showDuplicar && (
        <Modal title="Duplicar ciclo" onClose={() => setShowDuplicar(false)}>
          <div className="space-y-3">
            <Field label="Nome do novo ciclo"><input value={dupForm.nome} onChange={e => setDupForm(f => ({ ...f, nome: e.target.value }))} className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm focus:border-ber-teal focus:outline-none" /></Field>
            <Field label="Ano"><input type="number" value={dupForm.ano} onChange={e => setDupForm(f => ({ ...f, ano: +e.target.value }))} className="w-32 rounded-lg border border-ber-border bg-white px-3 py-2 text-sm focus:border-ber-teal focus:outline-none" /></Field>
            <p className="text-[11px] text-ber-gray/70">Vai copiar todas as linhas e valores do ciclo atual pra um novo.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowDuplicar(false)} className="text-xs text-ber-gray hover:text-ber-carbon px-3 py-1.5">Cancelar</button>
              <button onClick={duplicarCiclo} disabled={!dupForm.nome} className="text-xs font-semibold bg-ber-carbon text-white rounded-lg px-4 py-1.5 disabled:opacity-40">Duplicar</button>
            </div>
          </div>
        </Modal>
      )}

      {showLinhaCfg && (
        <LinhaConfigModal
          linha={showLinhaCfg}
          linhas={linhas}
          onClose={() => setShowLinhaCfg(null)}
          onSave={async patch => { await updateLinha(showLinhaCfg.id, patch); setShowLinhaCfg(null); }}
        />
      )}
    </div>
  );
}

// ─── Sub-componentes ────────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-ber-carbon">{title}</h2>
          <button onClick={onClose} className="text-ber-gray hover:text-ber-carbon"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-widest text-ber-gray">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function LinhaConfigModal({
  linha, linhas, onClose, onSave,
}: {
  linha: Linha;
  linhas: Linha[];
  onClose: () => void;
  onSave: (patch: Partial<Linha>) => Promise<void>;
}) {
  const [f, setF] = useState<Partial<Linha>>({
    rotulo: linha.rotulo,
    kpiPct: linha.kpiPct,
    orcamentoAnual: linha.orcamentoAnual,
    isTotal: linha.isTotal,
    isHeader: linha.isHeader,
    grupoId: linha.grupoId,
    ordem: linha.ordem,
  });
  const gruposPossiveis = linhas.filter(l => l.isTotal && l.id !== linha.id);

  return (
    <Modal title="Configurar linha" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Rótulo"><input value={f.rotulo ?? ''} onChange={e => setF(x => ({ ...x, rotulo: e.target.value }))} className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm focus:border-ber-teal focus:outline-none" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="KPI (%)">
            <input type="number" step={0.01} value={f.kpiPct ?? ''} onChange={e => setF(x => ({ ...x, kpiPct: e.target.value === '' ? null : +e.target.value }))} className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm focus:border-ber-teal focus:outline-none" placeholder="ex: 0.70" />
            <p className="text-[10px] text-ber-gray/60 mt-0.5">Formato decimal: 0.70 = 70%</p>
          </Field>
          <Field label="Orçamento anual (R$)">
            <input type="number" step={0.01} value={f.orcamentoAnual ?? ''} onChange={e => setF(x => ({ ...x, orcamentoAnual: e.target.value === '' ? null : +e.target.value }))} className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm focus:border-ber-teal focus:outline-none" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <select
              value={f.isHeader ? 'header' : f.isTotal ? 'total' : 'valor'}
              onChange={e => {
                const v = e.target.value;
                setF(x => ({ ...x, isHeader: v === 'header', isTotal: v === 'total' }));
              }}
              className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm focus:border-ber-teal focus:outline-none"
            >
              <option value="valor">Valor (input)</option>
              <option value="total">Total (soma automática)</option>
              <option value="header">Cabeçalho (só título)</option>
            </select>
          </Field>
          <Field label="Ordem">
            <input type="number" value={f.ordem ?? 0} onChange={e => setF(x => ({ ...x, ordem: +e.target.value }))} className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm focus:border-ber-teal focus:outline-none" />
          </Field>
        </div>
        {!f.isTotal && !f.isHeader && gruposPossiveis.length > 0 && (
          <Field label="Somar no grupo (total)">
            <select value={f.grupoId ?? ''} onChange={e => setF(x => ({ ...x, grupoId: e.target.value || null }))} className="w-full rounded-lg border border-ber-border bg-white px-3 py-2 text-sm focus:border-ber-teal focus:outline-none">
              <option value="">— Sem grupo —</option>
              {gruposPossiveis.map(g => <option key={g.id} value={g.id}>{g.rotulo}</option>)}
            </select>
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-3">
          <button onClick={onClose} className="text-xs text-ber-gray hover:text-ber-carbon px-3 py-1.5">Cancelar</button>
          <button onClick={() => onSave(f)} className="text-xs font-semibold bg-ber-carbon text-white rounded-lg px-4 py-1.5 flex items-center gap-1"><Save size={12} /> Salvar</button>
        </div>
      </div>
    </Modal>
  );
}
