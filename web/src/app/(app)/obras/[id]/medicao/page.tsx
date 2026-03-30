'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ChevronDown, ChevronRight, Plus, Send, ArrowLeft, Upload, Pencil, Check, X } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Medicao {
  id: string;
  numero: string;
  periodoInicio: string;
  periodoFim: string;
  status: string;
  totalQuinzena: number;
}

interface MedicaoItem {
  id: string;
  numero: string;
  descricao: string;
  valorOrcado: number;
  tipo: 'grupo' | 'subitem';
  ordem: number;
  percentualAcumulado: number;
  valorMedidoTotal: number;
  saldo: number;
  lancamentoAtual: { percentual: number; valor: number };
}

interface MedicaoDetalhe {
  id: string;
  numero: string;
  periodoInicio: string;
  periodoFim: string;
  status: string;
  totalQuinzena: number;
  medicoes: { id: string; numero: string }[];
  itens: MedicaoItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  aprovada: 'Aprovada',
  faturada: 'Faturada',
  paga: 'Paga',
};
const STATUS_COLORS: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-600',
  enviada: 'bg-blue-100 text-blue-700',
  aprovada: 'bg-green-100 text-green-700',
  faturada: 'bg-purple-100 text-purple-700',
  paga: 'bg-emerald-100 text-emerald-700',
};

// ── Import Modal ──────────────────────────────────────────────────────────────

function ImportModal({ obraId, onClose, onSuccess }: { obraId: string; onClose: () => void; onSuccess: () => void }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleImport() {
    setErr('');
    try {
      const lines = text.trim().split('\n').filter(Boolean);
      const itens = lines.map((line, i) => {
        const parts = line.split('\t');
        if (parts.length < 3) throw new Error(`Linha ${i + 1} inválida`);
        return {
          numero: parts[0].trim(),
          descricao: parts[1].trim(),
          valor_orcado: parseFloat(parts[2].replace(/[R$\s.]/g, '').replace(',', '.')),
          tipo: parts[0].trim().includes('.') ? 'subitem' : 'grupo',
        };
      });
      setSaving(true);
      await api.post(`/obras/${obraId}/medicao-itens/bulk`, { itens });
      onSuccess();
    } catch (e: any) {
      setErr(e.message || 'Erro ao importar');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-xl bg-white p-6 shadow-xl">
        <h3 className="mb-1 text-lg font-bold text-gray-900">Importar Orçamento</h3>
        <p className="mb-4 text-sm text-gray-500">Cole os itens em formato TSV: <code>Nº TAB Descrição TAB Valor</code></p>
        <textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"1\tSERVIÇOS PRELIMINARES\t4384.00\n1.1\tART\t2200.00"}
          className="w-full rounded-lg border border-gray-200 p-3 text-sm font-mono focus:border-green-500 focus:outline-none"
        />
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <div className="mt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 min-h-[44px] rounded-lg border border-gray-200 text-sm font-medium text-gray-600">
            Cancelar
          </button>
          <button onClick={handleImport} disabled={saving || !text.trim()} className="flex-1 min-h-[44px] rounded-lg bg-green-700 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MedicaoPage() {
  const { id: obraId } = useParams<{ id: string }>();
  const router = useRouter();

  const [obra, setObra] = useState<{ name: string } | null>(null);
  const [medicoes, setMedicoes] = useState<Medicao[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<MedicaoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editPct, setEditPct] = useState<Record<string, string>>({});
  const [showImport, setShowImport] = useState(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  // Edição de período
  const [editPeriodo, setEditPeriodo] = useState(false);
  const [periodoInicio, setPeriodoInicio] = useState('');
  const [periodoFim, setPeriodoFim] = useState('');
  const [savingPeriodo, setSavingPeriodo] = useState(false);

  const canEdit = true; // TODO: check role from authStore

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadMedicoes = useCallback(async () => {
    try {
      const [obraRes, medRes] = await Promise.all([
        api.get(`/obras/${obraId}`),
        api.get(`/obras/${obraId}/medicoes`),
      ]);
      setObra(obraRes.data.data);
      const meds: Medicao[] = medRes.data.data;
      setMedicoes(meds);
      if (meds.length > 0 && !selectedId) setSelectedId(meds[meds.length - 1].id);
    } finally {
      setLoading(false);
    }
  }, [obraId, selectedId]);

  const loadDetalhe = useCallback(async (id: string) => {
    const res = await api.get(`/medicoes/${id}`);
    const d: MedicaoDetalhe = res.data.data;
    setDetalhe(d);
    // Init período inputs
    setPeriodoInicio(d.periodoInicio.split('T')[0]);
    setPeriodoFim(d.periodoFim.split('T')[0]);
    // Init editPct from lançamento atual
    const init: Record<string, string> = {};
    for (const item of d.itens) {
      init[item.id] = item.lancamentoAtual.percentual > 0
        ? String(item.lancamentoAtual.percentual)
        : '';
    }
    setEditPct(init);
  }, []);

  useEffect(() => { loadMedicoes(); }, [obraId]);
  useEffect(() => { if (selectedId) loadDetalhe(selectedId); }, [selectedId]);

  // ── Auto-save ─────────────────────────────────────────────────────────────

  async function flushSave(pctMap: Record<string, string>) {
    if (!selectedId || !detalhe) return;
    setSaving(true);
    const lancamentos = Object.entries(pctMap)
      .filter(([, v]) => v !== '')
      .map(([item_id, pct]) => ({ item_id, percentual_executado: parseFloat(pct) || 0 }));
    try {
      await api.patch(`/medicoes/${selectedId}/lancamentos`, { lancamentos });
      await loadDetalhe(selectedId);
    } finally {
      setSaving(false);
    }
  }

  function handlePctChange(itemId: string, val: string) {
    const next = { ...editPct, [itemId]: val };
    setEditPct(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushSave(next), 1500);
  }

  function handleBlur(itemId: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    flushSave(editPct);
  }

  // ── Create medição ─────────────────────────────────────────────────────────

  async function handleCreateMedicao() {
    const res = await api.post(`/obras/${obraId}/medicoes`, {});
    const nova = res.data.data;
    await loadMedicoes();
    setSelectedId(nova.id);
  }

  // ── Status ────────────────────────────────────────────────────────────────

  async function handleEnviar() {
    if (!selectedId) return;
    await api.patch(`/medicoes/${selectedId}/status`, { status: 'enviada' });
    await loadDetalhe(selectedId);
    await loadMedicoes();
  }

  // ── Salvar período ────────────────────────────────────────────────────────

  async function savePeriodo() {
    if (!selectedId) return;
    setSavingPeriodo(true);
    try {
      await api.patch(`/medicoes/${selectedId}`, {
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
      });
      setEditPeriodo(false);
      await loadDetalhe(selectedId);
      await loadMedicoes();
    } finally {
      setSavingPeriodo(false);
    }
  }

  // ── Collapse groups ───────────────────────────────────────────────────────

  function toggleCollapse(num: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });
  }

  // ── Computed ─────────────────────────────────────────────────────────────

  const totalOrcado = detalhe?.itens
    .filter((i) => i.tipo === 'grupo')
    .reduce((s, i) => s + i.valorOrcado, 0) ?? 0;

  const totalMedido = detalhe?.itens
    .filter((i) => i.tipo === 'grupo')
    .reduce((s, i) => s + i.valorMedidoTotal, 0) ?? 0;

  const pctGeral = totalOrcado > 0 ? (totalMedido / totalOrcado) * 100 : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-gray-400">Carregando medição...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">

      {/* ── Header ── */}
      <div className="border-b border-gray-200 bg-white px-4 md:px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.back()} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-700">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-gray-900 truncate">{obra?.name}</h1>
            <p className="text-xs text-gray-400">Medição de Contrato</p>
          </div>
          {/* BER brand */}
          <span className="hidden md:block text-xs font-black tracking-widest text-gray-300 uppercase">BÈR</span>
        </div>

        {/* Progress bar geral */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Progresso Geral</span>
            <span className="font-bold">{pctGeral.toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-600 transition-all"
              style={{ width: `${Math.min(pctGeral, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>Orçado: {fmt(totalOrcado)}</span>
            <span>Medido: {fmt(totalMedido)}</span>
          </div>
        </div>

        {/* Quinzena tabs + actions */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <div className="flex gap-1.5 flex-1">
            {medicoes.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold min-h-[36px] transition-colors ${
                  selectedId === m.id
                    ? 'bg-green-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {m.numero}
              </button>
            ))}
          </div>
          <button
            onClick={handleCreateMedicao}
            className="shrink-0 flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white min-h-[36px] hover:bg-gray-700"
          >
            <Plus size={14} /> Nova
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="shrink-0 flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 min-h-[36px] hover:bg-gray-50"
          >
            <Upload size={14} /> Orçamento
          </button>
        </div>
      </div>

      {/* ── Medição detalhe ── */}
      {detalhe && (
        <>
          {/* Sub-header: quinzena info */}
          <div className="border-b border-gray-100 bg-white px-4 md:px-6 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-bold text-gray-900">{detalhe.numero}</span>

              {/* Data editável */}
              {editPeriodo ? (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={periodoInicio}
                    onChange={(e) => setPeriodoInicio(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-green-500 focus:outline-none"
                  />
                  <span className="text-xs text-gray-400">–</span>
                  <input
                    type="date"
                    value={periodoFim}
                    onChange={(e) => setPeriodoFim(e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-green-500 focus:outline-none"
                  />
                  <button
                    onClick={savePeriodo}
                    disabled={savingPeriodo}
                    className="flex items-center justify-center h-7 w-7 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    title="Confirmar"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    onClick={() => { setEditPeriodo(false); }}
                    className="flex items-center justify-center h-7 w-7 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
                    title="Cancelar"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditPeriodo(true)}
                  className="group flex items-center gap-1.5 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                  title="Editar período"
                >
                  <span>
                    {new Date(detalhe.periodoInicio).toLocaleDateString('pt-BR')} – {new Date(detalhe.periodoFim).toLocaleDateString('pt-BR')}
                  </span>
                  <Pencil size={11} className="text-gray-400 group-hover:text-green-600 transition-colors" />
                </button>
              )}

              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_COLORS[detalhe.status]}`}>
                {STATUS_LABELS[detalhe.status]}
              </span>
              {saving && <span className="text-[11px] text-gray-400 animate-pulse">Salvando...</span>}
            </div>
            {detalhe.status === 'rascunho' && (
              <button
                onClick={handleEnviar}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white min-h-[36px] hover:bg-blue-700"
              >
                <Send size={13} /> Enviar
              </button>
            )}
          </div>

          {/* ── Empty state: sem itens de orçamento ── */}
          {detalhe.itens.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6 py-16">
              <div className="rounded-full bg-gray-100 p-4">
                <Upload size={28} className="text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Nenhum item de orçamento cadastrado</p>
                <p className="mt-1 text-xs text-gray-400">Importe a planilha de orçamento para começar a medir.</p>
              </div>
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 rounded-lg bg-green-700 px-5 py-3 text-sm font-semibold text-white min-h-[44px] hover:bg-green-800"
              >
                <Upload size={16} /> Importar Orçamento
              </button>
              <p className="text-[11px] text-gray-400 max-w-xs">
                Cole os itens em formato TSV:<br />
                <code className="font-mono">Nº{'\t'}Descrição{'\t'}Valor</code>
              </p>
            </div>
          )}

          {/* ── Tabela ── */}
          {detalhe.itens.length > 0 && <div className="flex-1 overflow-auto">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-gray-800 text-white">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold text-xs w-12">Nº</th>
                  <th className="px-3 py-3 text-left font-semibold text-xs">Item / Etapa</th>
                  <th className="px-3 py-3 text-right font-semibold text-xs w-32">Valor Orçado</th>
                  <th className="px-3 py-3 text-center font-semibold text-xs w-28 bg-green-800">% Quinzena</th>
                  <th className="px-3 py-3 text-right font-semibold text-xs w-32 bg-green-800">Valor Quinzena</th>
                  <th className="px-3 py-3 text-right font-semibold text-xs w-24">% Acum.</th>
                  <th className="px-3 py-3 text-right font-semibold text-xs w-32">Valor Medido</th>
                  <th className="px-3 py-3 text-right font-semibold text-xs w-32">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {detalhe.itens.map((item) => {
                  if (item.tipo === 'grupo') {
                    const isOpen = !collapsed.has(item.numero);
                    const groupTotal = detalhe.itens
                      .filter((i) => i.numero.startsWith(item.numero + '.') && i.tipo === 'subitem')
                      .reduce((s, i) => s + i.valorOrcado, 0);
                    return (
                      <tr
                        key={item.id}
                        onClick={() => toggleCollapse(item.numero)}
                        className="cursor-pointer border-b border-gray-200 bg-gray-100 hover:bg-gray-150"
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            {isOpen ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                            <span className="text-xs font-bold text-gray-700">{item.numero}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-bold text-gray-800 text-xs uppercase tracking-wide">{item.descricao}</span>
                        </td>
                        <td className="px-3 py-3 text-right text-xs font-bold text-gray-800">
                          {fmt(item.valorOrcado || groupTotal)}
                        </td>
                        <td className="px-3 py-3 bg-green-50" />
                        <td className="px-3 py-3 text-right text-xs font-bold text-green-800 bg-green-50">
                          {fmt(item.lancamentoAtual.valor)}
                        </td>
                        <td className="px-3 py-3 text-right text-xs font-bold text-gray-700">
                          {item.percentualAcumulado.toFixed(0)}%
                        </td>
                        <td className="px-3 py-3 text-right text-xs font-bold text-gray-700">
                          {fmt(item.valorMedidoTotal)}
                        </td>
                        <td className="px-3 py-3 text-right text-xs font-bold text-gray-700">
                          {fmt(item.saldo)}
                        </td>
                      </tr>
                    );
                  }

                  // Subitem
                  const groupNum = item.numero.split('.').slice(0, -1).join('.');
                  if (collapsed.has(groupNum)) return null;

                  const pctVal = editPct[item.id] ?? '';
                  const isEditable = canEdit && detalhe.status === 'rascunho';

                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-green-50/40">
                      <td className="px-3 py-3 text-xs text-gray-400 pl-6">{item.numero}</td>
                      <td className="px-3 py-3">
                        <span className="text-sm text-gray-700 pl-4">{item.descricao}</span>
                      </td>
                      <td className="px-3 py-3 text-right text-xs text-gray-600">
                        {fmt(item.valorOrcado)}
                      </td>
                      {/* % input */}
                      <td className="px-2 py-2 text-center bg-green-50">
                        {isEditable ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={100 - item.percentualAcumulado + item.lancamentoAtual.percentual}
                              step={0.5}
                              value={pctVal}
                              onChange={(e) => handlePctChange(item.id, e.target.value)}
                              onBlur={() => handleBlur(item.id)}
                              className={`w-16 rounded border px-2 py-1.5 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[36px] ${
                                pctVal && parseFloat(pctVal) > 0
                                  ? 'border-green-300 bg-green-50 text-green-800'
                                  : 'border-gray-200 bg-white text-gray-700'
                              }`}
                              placeholder="0"
                            />
                            <span className="text-xs text-gray-400">%</span>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-green-700">
                            {item.lancamentoAtual.percentual > 0 ? `${item.lancamentoAtual.percentual}%` : '–'}
                          </span>
                        )}
                      </td>
                      {/* Valor quinzena */}
                      <td className="px-3 py-2 text-right bg-green-50">
                        {item.lancamentoAtual.valor > 0 ? (
                          <div>
                            <div className="text-xs font-semibold text-green-700">{fmt(item.lancamentoAtual.valor)}</div>
                          </div>
                        ) : <span className="text-xs text-gray-300">–</span>}
                      </td>
                      {/* % acumulado */}
                      <td className="px-3 py-3 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`text-xs font-semibold ${item.percentualAcumulado >= 100 ? 'text-green-700' : 'text-gray-700'}`}>
                            {item.percentualAcumulado.toFixed(0)}%
                          </span>
                          <div className="w-16 h-1 rounded-full bg-gray-200 overflow-hidden">
                            <div className="h-full rounded-full bg-green-600" style={{ width: `${Math.min(item.percentualAcumulado, 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      {/* Valor medido */}
                      <td className="px-3 py-3 text-right text-xs text-gray-600">{fmt(item.valorMedidoTotal)}</td>
                      {/* Saldo */}
                      <td className={`px-3 py-3 text-right text-xs font-medium ${item.saldo <= 0 ? 'text-green-700' : 'text-gray-600'}`}>
                        {fmt(item.saldo)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}

          {/* ── Footer sticky ── */}
          <div className="border-t-2 border-gray-200 bg-gray-900 px-4 md:px-6 py-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total Orçado</p>
                  <p className="text-sm font-black text-white">{fmt(totalOrcado)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total {detalhe.numero}</p>
                  <p className="text-sm font-black text-green-400">{fmt(detalhe.totalQuinzena)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total Medido</p>
                  <p className="text-sm font-black text-white">{fmt(totalMedido)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Saldo</p>
                  <p className="text-sm font-black text-yellow-400">{fmt(totalOrcado - totalMedido)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400">Progresso</p>
                <p className="text-lg font-black text-green-400">{pctGeral.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && medicoes.length === 0 && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-4">
          <p className="text-gray-500">Nenhuma medição ainda.</p>
          <button onClick={handleCreateMedicao} className="flex items-center gap-2 rounded-lg bg-green-700 px-5 py-3 text-sm font-semibold text-white min-h-[44px]">
            <Plus size={16} /> Criar primeira medição
          </button>
        </div>
      )}

      {showImport && (
        <ImportModal
          obraId={obraId}
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); loadMedicoes(); }}
        />
      )}
    </div>
  );
}
