'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Upload, Trash2, X, AlertTriangle, TrendingDown, TrendingUp, ShoppingCart, ChevronRight, ChevronDown, Plus, FilePlus } from 'lucide-react';
import api from '@/lib/api';

interface ComprasSplit {
  id: string;
  descricao: string | null;
  fornecedor: string | null;
  faturamento: string | null;
  valor: number;
  coTipo: 'credito' | 'debito' | null;
  pctMeta: number;
  comprado: number;
  compradoOk: boolean;
}

interface CompraItem {
  id: string;
  n: string | null;
  tipo: 'etapa' | 'item' | 'co';
  categoria: string;
  descritivo: string | null;
  venda: number;
  pctMeta: number;
  comprado: number;
  fornecedor: string | null;
  faturamento: string | null;
  pacote: number | null;
  compradoOk: boolean;
  splits: ComprasSplit[];
}


const PACOTE_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  0: { bg: 'bg-red-600',    text: 'text-white', label: 'P0' },
  1: { bg: 'bg-orange-500', text: 'text-white', label: 'P1' },
  2: { bg: 'bg-amber-400',  text: 'text-black', label: 'P2' },
  3: { bg: 'bg-yellow-300', text: 'text-black', label: 'P3' },
  4: { bg: 'bg-green-400',  text: 'text-black', label: 'P4' },
  5: { bg: 'bg-blue-400',   text: 'text-white', label: 'P5' },
  6: { bg: 'bg-gray-400',   text: 'text-white', label: 'P6' },
};

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);

function parseComprado(raw: string): number {
  // Aceita formato BR (1.500,50) ou US (1500.50)
  let s = raw.replace(/[^0-9.,]/g, '');
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function sortByN(a: CompraItem, b: CompraItem): number {
  const parse = (n: string | null) => (n ?? '999999').split('.').map(Number);
  const aN = parse(a.n);
  const bN = parse(b.n);
  for (let i = 0; i < Math.max(aN.length, bN.length); i++) {
    const d = (aN[i] ?? 0) - (bN[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function semaforo(comprado: number, meta: number): '🟢' | '🟡' | '🔴' {
  if (comprado === 0) return '🟢';
  if (comprado > meta) return '🔴';
  if (comprado >= meta * 0.85) return '🟡';
  return '🟢';
}

function isElegivelComissao(item: CompraItem): boolean {
  const cat = item.categoria.toLowerCase();
  return item.tipo === 'item' && !cat.includes('taxa') && !cat.includes('imposto');
}

export default function ComprasPage() {
  const { id: obraId } = useParams<{ id: string }>();
  const [items, setItems] = useState<CompraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem(`compras-collapsed-${obraId}`);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  });
  const [localText, setLocalText] = useState<Record<string, string>>({});
  const [comissao, setComissao] = useState(0);
  const [comissaoText, setComissaoText] = useState('');
  const [comissaoMode, setComissaoMode] = useState<'R$' | '%'>('R$');
  const [obraName, setObraName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const comissaoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!obraId) return;
    try { localStorage.setItem(`compras-collapsed-${obraId}`, JSON.stringify(collapsed)); } catch { /* silent */ }
  }, [collapsed, obraId]);

  const toggleCollapse = (etapaN: string) =>
    setCollapsed(prev => ({ ...prev, [etapaN]: !prev[etapaN] }));

  const etapaKeys = items.filter(i => i.tipo === 'etapa').map(i => i.n || '');
  const allCollapsed = etapaKeys.length > 0 && etapaKeys.every(k => collapsed[k]);
  const toggleAll = () => {
    const next = !allCollapsed;
    setCollapsed(Object.fromEntries(etapaKeys.map(k => [k, next])));
  };

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get(`/obras/${obraId}/compras`),
      api.get(`/obras/${obraId}/compras/config`),
      api.get(`/obras/${obraId}`),
    ]).then(([itemsRes, configRes, obraRes]) => {
      setItems([...(itemsRes.data.data || [])].sort(sortByN));
      const c = configRes.data.data.comissao ?? 0;
      setComissao(c);
      setComissaoText(c === 0 ? '' : String(c));
      setObraName(obraRes.data.data?.name ?? obraRes.data.data?.nome ?? '');
    }).finally(() => setLoading(false));
  }, [obraId]);

  useEffect(() => { load(); }, [load]);

  // Auto-save debounced
  const saveItem = useCallback((id: string, patch: Partial<CompraItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
    if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
    saveTimers.current[id] = setTimeout(() => {
      api.patch(`/obras/${obraId}/compras/${id}`, patch).catch(console.error);
    }, 800);
  }, [obraId]);

  const addChangeOrder = useCallback(async () => {
    const { data } = await api.post(`/obras/${obraId}/compras`, {});
    setItems(prev => [...prev, { ...data.data, splits: [] }]);
  }, [obraId]);

  const deleteItem = useCallback(async (itemId: string) => {
    setItems(prev => prev.filter(it => it.id !== itemId));
    await api.delete(`/obras/${obraId}/compras/${itemId}`).catch(console.error);
  }, [obraId]);

  const addSplit = useCallback(async (itemId: string, coTipo?: 'credito' | 'debito') => {
    const { data } = await api.post(`/obras/${obraId}/compras/${itemId}/splits`, coTipo ? { coTipo } : {});
    setItems(prev => prev.map(it => it.id === itemId
      ? { ...it, splits: [...it.splits, data.data] }
      : it
    ));
  }, [obraId]);

  const saveSplit = useCallback((itemId: string, splitId: string, patch: Partial<ComprasSplit>) => {
    setItems(prev => prev.map(it => it.id === itemId
      ? { ...it, splits: it.splits.map(s => s.id === splitId ? { ...s, ...patch } : s) }
      : it
    ));
    const key = `split_${splitId}`;
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => {
      api.patch(`/obras/${obraId}/compras/${itemId}/splits/${splitId}`, patch).catch(console.error);
    }, 800);
  }, [obraId]);

  const valorInputProps = (key: string, storedValue: number, onSave: (v: number) => void) => {
    const commit = (raw: string | undefined, el?: HTMLInputElement) => {
      if (raw !== undefined) {
        onSave(parseComprado(raw));
        setLocalText(prev => { const n = { ...prev }; delete n[key]; return n; });
        el?.blur();
      }
    };
    return {
      type: 'text' as const,
      inputMode: 'decimal' as const,
      value: localText[key] ?? (storedValue === 0 ? '' : String(storedValue)),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setLocalText(prev => ({ ...prev, [key]: e.target.value })),
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') commit(localText[key], e.currentTarget);
      },
      onBlur: (e: React.FocusEvent<HTMLInputElement>) => commit(localText[key], e.currentTarget),
    };
  };

  const deleteSplit = useCallback(async (itemId: string, splitId: string) => {
    setItems(prev => prev.map(it => it.id === itemId
      ? { ...it, splits: it.splits.filter(s => s.id !== splitId) }
      : it
    ));
    await api.delete(`/obras/${obraId}/compras/${itemId}/splits/${splitId}`).catch(console.error);
  }, [obraId]);

  // Import
  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    const form = new FormData();
    form.append('file', importFile);
    try {
      await api.post(`/obras/${obraId}/compras/import`, form);
      setShowImport(false);
      setImportFile(null);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message || 'Erro ao importar';
      alert(msg);
    } finally {
      setImporting(false);
    }
  };

  // Clear
  const handleClear = async () => {
    await api.delete(`/obras/${obraId}/compras`);
    setItems([]);
    setConfirmClear(false);
  };

  // Change Order: venda efetiva = net(créditos − débitos) dos splits; comprado = soma dos splits.comprado
  const effectiveVendaItem = (item: CompraItem): number => {
    if (item.tipo === 'co') {
      const coSplits = item.splits.filter(sp => sp.coTipo !== null);
      if (coSplits.length > 0) {
        return coSplits.reduce((s, sp) => s + (sp.coTipo === 'credito' ? sp.valor : -sp.valor), 0);
      }
    }
    return item.venda;
  };
  const effectiveCompradoItem = (item: CompraItem): number => {
    if (item.tipo === 'co') {
      const coSplits = item.splits.filter(sp => sp.coTipo !== null);
      if (coSplits.length > 0) {
        const sum = coSplits.reduce((s, sp) => s + (sp.comprado || 0), 0);
        return sum > 0 ? sum : item.comprado;
      }
    }
    if (item.splits.length > 0) {
      // split legado (coTipo=null) — soma valor dos splits
      return item.splits.reduce((s, sp) => s + sp.valor, 0);
    }
    return item.comprado;
  };

  // Comissão — desconto proporcional sobre itens elegíveis (exceto taxa/imposto)
  const totalVendaElegivel = items.filter(isElegivelComissao).reduce((s, i) => s + effectiveVendaItem(i), 0);
  const pctComissao = totalVendaElegivel > 0 ? comissao / totalVendaElegivel : 0;
  const baseItem = (item: CompraItem) =>
    isElegivelComissao(item) ? effectiveVendaItem(item) * (1 - pctComissao) : effectiveVendaItem(item);
  const metaItem = (item: CompraItem) => baseItem(item) * (1 - item.pctMeta);

  const saveComissao = (val: number) => {
    setComissao(val);
    if (comissaoTimer.current) clearTimeout(comissaoTimer.current);
    comissaoTimer.current = setTimeout(() => {
      api.put(`/obras/${obraId}/compras/config`, { comissao: val }).catch(console.error);
    }, 800);
  };

  // Totais (só itens, não etapas)
  const onlyItems = items.filter(i => i.tipo !== 'etapa');
  const itemsOk = onlyItems.filter(i => i.compradoOk);
  const itemsPend = onlyItems.filter(i => !i.compradoOk);

  const totalVendaBruta = onlyItems.reduce((s, i) => s + effectiveVendaItem(i), 0);
  const totalVenda = onlyItems.reduce((s, i) => s + baseItem(i), 0);
  const totalMeta = onlyItems.reduce((s, i) => s + metaItem(i), 0);
  const totalComprado = onlyItems.reduce((s, i) => s + effectiveCompradoItem(i), 0);

  // Contrato principal (só itens normais) vs Change Orders (líquido: créditos − débitos)
  const contratoPrincipal = onlyItems.filter(i => i.tipo !== 'co').reduce((s, i) => s + i.venda, 0);
  const netCO = onlyItems.filter(i => i.tipo === 'co').reduce((s, co) => {
    const coSplits = co.splits.filter(sp => sp.coTipo !== null);
    const net = coSplits.length > 0
      ? coSplits.reduce((sum, sp) => sum + (sp.coTipo === 'credito' ? sp.valor : -sp.valor), 0)
      : co.venda;
    return s + net;
  }, 0);
  const contratoTotal = contratoPrincipal + netCO;
  const savingTotal = totalVenda - totalComprado;
  const savingPct = totalVenda > 0 ? (savingTotal / totalVenda) * 100 : 0;

  // Itens com valor lançado (comprado > 0) — base para saving realizado
  const itemsComComprado = onlyItems.filter(i => effectiveCompradoItem(i) > 0);
  const okVenda = itemsComComprado.reduce((s, i) => s + baseItem(i), 0);
  const okMeta = itemsComComprado.reduce((s, i) => s + metaItem(i), 0);
  const okComprado = itemsComComprado.reduce((s, i) => s + effectiveCompradoItem(i), 0);
  const okSaving = okVenda - okComprado;
  const okSavingPct = okVenda > 0 ? (okSaving / okVenda) * 100 : 0;
  const okSavingMeta = okMeta - okComprado;
  const okSavingMetaPct = okMeta > 0 ? (okSavingMeta / okMeta) * 100 : 0;

  const pendVenda = itemsPend.reduce((s, i) => s + baseItem(i), 0);
  const pendMeta = itemsPend.reduce((s, i) => s + metaItem(i), 0);

  // Saving "limpo" — média ponderada removendo outliers via IQR.
  // Usado pra projeção: itens fora-da-curva (ex: R$30k saving num único item)
  // não devem extrapolar pra obra inteira.
  const { cleanSavingPct, cleanCount, outlierCount } = (() => {
    const pcts = itemsComComprado
      .map(i => ({ item: i, pct: baseItem(i) > 0 ? (baseItem(i) - effectiveCompradoItem(i)) / baseItem(i) : 0 }))
      .sort((a, b) => a.pct - b.pct);
    if (pcts.length < 4) {
      return { cleanSavingPct: okSavingPct, cleanCount: pcts.length, outlierCount: 0 };
    }
    const q = (p: number) => {
      const idx = (pcts.length - 1) * p;
      const lo = Math.floor(idx), hi = Math.ceil(idx);
      return pcts[lo].pct + (pcts[hi].pct - pcts[lo].pct) * (idx - lo);
    };
    const q1 = q(0.25), q3 = q(0.75), iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr, upper = q3 + 1.5 * iqr;
    const clean = pcts.filter(p => p.pct >= lower && p.pct <= upper);
    const cleanVenda = clean.reduce((s, { item }) => s + baseItem(item), 0);
    const cleanSaving = clean.reduce((s, { item }) => s + (baseItem(item) - effectiveCompradoItem(item)), 0);
    return {
      cleanSavingPct: cleanVenda > 0 ? (cleanSaving / cleanVenda) * 100 : 0,
      cleanCount: clean.length,
      outlierCount: pcts.length - clean.length,
    };
  })();

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-ber-teal" />
            <h1 className="text-xl font-black text-ber-carbon">Metas de Compra</h1>
          </div>
          {obraName && (
            <p className="mt-0.5 ml-7 text-sm text-ber-gray font-medium">{obraName}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 rounded-lg bg-ber-teal px-3 py-2 text-sm font-medium text-white hover:bg-ber-teal/90"
          >
            <Upload size={14} /> Importar Orçamento
          </button>
          <button
            onClick={addChangeOrder}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600"
          >
            <FilePlus size={14} /> Change Order
          </button>
          {items.length > 0 && (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50"
            >
              <Trash2 size={14} /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* Comissão */}
      {items.length > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm border border-ber-gray/10 flex-wrap">
          <span className="text-xs font-medium text-ber-gray whitespace-nowrap">Comissão do orçamento</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (comissaoMode === '%') {
                  // converter % → R$ no campo de texto
                  const pct = parseComprado(comissaoText) / 100;
                  const valR = pct * totalVendaElegivel;
                  setComissaoText(valR === 0 ? '' : valR.toFixed(2));
                }
                setComissaoMode('R$');
              }}
              className={`px-2 py-0.5 text-xs rounded-l border ${comissaoMode === 'R$' ? 'bg-ber-carbon text-white border-ber-carbon' : 'bg-white text-ber-gray border-ber-gray/30 hover:bg-gray-50'}`}
            >R$</button>
            <button
              onClick={() => {
                if (comissaoMode === 'R$') {
                  // converter R$ → % no campo de texto
                  const pct = totalVendaElegivel > 0 ? (comissao / totalVendaElegivel) * 100 : 0;
                  setComissaoText(pct === 0 ? '' : pct.toFixed(2));
                }
                setComissaoMode('%');
              }}
              className={`px-2 py-0.5 text-xs rounded-r border-t border-b border-r ${comissaoMode === '%' ? 'bg-ber-carbon text-white border-ber-carbon' : 'bg-white text-ber-gray border-ber-gray/30 hover:bg-gray-50'}`}
            >%</button>
          </div>
          <input
            type="text"
            inputMode="decimal"
            value={comissaoText}
            placeholder="0"
            onChange={e => setComissaoText(e.target.value)}
            onBlur={() => {
              const parsed = parseComprado(comissaoText);
              const valR = comissaoMode === '%'
                ? (parsed / 100) * totalVendaElegivel
                : parsed;
              setComissaoText(parsed === 0 ? '' : String(parsed));
              saveComissao(valR);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const parsed = parseComprado(comissaoText);
                const valR = comissaoMode === '%'
                  ? (parsed / 100) * totalVendaElegivel
                  : parsed;
                setComissaoText(parsed === 0 ? '' : String(parsed));
                saveComissao(valR);
                e.currentTarget.blur();
              }
            }}
            className="w-36 rounded border border-ber-gray/30 px-2 py-1 text-right text-sm tabular-nums focus:border-ber-teal focus:outline-none"
          />
          {comissao > 0 && totalVendaElegivel > 0 && (
            <span className="text-xs text-ber-gray">
              {comissaoMode === 'R$'
                ? `→ ${(pctComissao * 100).toFixed(2)}% sobre orçamento`
                : `→ ${fmtBRL(comissao)}`
              } · diluído em {items.filter(isElegivelComissao).length} itens (excl. taxa/imposto)
            </span>
          )}
        </div>
      )}

      {/* Cards de resumo */}
      {items.length > 0 && (() => {
        const compradosRatio = onlyItems.length > 0 ? itemsComComprado.length / onlyItems.length : 0;
        const showProjection = compradosRatio >= 0.10;
        const savingProjected = totalVenda * (cleanSavingPct / 100);
        // Taxa de Administração: linha(s) do orçamento com "taxa" + "administra"
        // em categoria ou descritivo. Usa o valor de VENDA (entrada do orçamento).
        const isTaxaAdmin = (i: CompraItem) => {
          const blob = `${i.categoria} ${i.descritivo ?? ''}`.toLowerCase();
          return blob.includes('taxa') && (blob.includes('administra') || blob.includes(' adm'));
        };
        // Filtra onlyItems (exclui etapa/co) pra não duplicar quando a etapa
        // tem o mesmo nome do item
        const taxaAdminTotal = onlyItems.filter(isTaxaAdmin).reduce((s, i) => s + i.venda, 0);
        // Bruno: Saving Final = só o que foi realmente comprado até agora (okSaving) + taxa adm.
        // Antes usava savingProjected (projeção estatística sobre TODA a venda), o que inflava o
        // número — assumia que os itens não comprados teriam o mesmo % de saving. Removido.
        const savingMaisTaxa = okSaving + taxaAdminTotal;
        return (
        <div className="mb-4 space-y-3">
          {/* Cards principais */}
          <div className={`grid grid-cols-1 gap-3 ${showProjection ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            {/* Comprado */}
            <div className="rounded-xl bg-white border border-ber-gray/15 p-5 shadow-sm">
              <p className="text-xs font-medium text-ber-gray uppercase tracking-wide">Comprado</p>
              <p className="mt-2 text-2xl font-black text-ber-carbon">
                {itemsOk.length}<span className="text-base font-semibold text-ber-gray"> de {onlyItems.length} itens</span>
              </p>
              <p className="mt-2 text-lg font-bold text-ber-carbon">{fmtBRL(totalComprado)}</p>
              <p className="text-xs text-ber-gray">de {fmtBRL(totalVenda)} vendido</p>
            </div>

            {/* Saving s/ Vendido — só itens com comprado > 0 */}
            <div className={`rounded-xl p-5 shadow-sm border ${okSaving >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
              <p className={`text-xs font-medium uppercase tracking-wide ${okSaving >= 0 ? 'text-green-700' : 'text-red-600'}`}>Saving / Vendido</p>
              <p className={`mt-2 text-2xl font-black ${okSaving >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtBRL(okSaving)}</p>
              <p className={`mt-1 text-3xl font-black ${okSaving >= 0 ? 'text-green-700' : 'text-red-600'}`}>{okSavingPct.toFixed(1)}%</p>
              <p className="mt-1 text-xs text-ber-gray">venda − comprado dos {itemsComComprado.length} itens com compra lançada</p>
            </div>

            {/* Saving s/ Meta — só itens com comprado > 0 */}
            <div className={`rounded-xl p-5 shadow-sm border ${okSavingMeta >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
              <p className={`text-xs font-medium uppercase tracking-wide ${okSavingMeta >= 0 ? 'text-green-700' : 'text-red-600'}`}>Saving / Meta</p>
              <p className={`mt-2 text-2xl font-black ${okSavingMeta >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtBRL(okSavingMeta)}</p>
              <p className={`mt-1 text-3xl font-black ${okSavingMeta >= 0 ? 'text-green-700' : 'text-red-600'}`}>{okSavingMetaPct.toFixed(1)}%</p>
              <p className="mt-1 text-xs text-ber-gray">
                {okSavingMeta >= 0 ? 'dentro da meta' : '⚠ acima da meta'}
              </p>
            </div>

            {/* Projeção — só com >= 10% dos itens já comprados */}
            {showProjection && (
              <div className="rounded-xl p-5 shadow-sm border bg-ber-teal/5 border-ber-teal/30">
                <p className="text-xs font-medium uppercase tracking-wide text-ber-teal">📈 Projeção</p>
                <p className="mt-2 text-2xl font-black text-ber-teal">{fmtBRL(savingProjected)}</p>
                <p className="mt-1 text-xs text-ber-gray">{cleanSavingPct.toFixed(1)}% × {fmtBRL(totalVenda)} venda total</p>
                <p className="mt-2 text-xs text-ber-gray">
                  saving final estimado · base limpa de {cleanCount} itens
                  {outlierCount > 0 && <> · <span className="text-amber-700">{outlierCount} outlier{outlierCount > 1 ? 's' : ''} excluído{outlierCount > 1 ? 's' : ''}</span></>}
                </p>
              </div>
            )}
          </div>

          {/* Indicador combinado: Saving Final + Taxa de Administração */}
          {taxaAdminTotal > 0 && (
            <div className="rounded-xl p-5 shadow-sm border bg-ber-olive/5 border-ber-olive/30">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ber-olive">💼 Saving Final + Taxa de Administração</p>
                  <p className="mt-2 text-2xl font-black text-ber-olive">{fmtBRL(savingMaisTaxa)}</p>
                </div>
                <div className="text-right text-xs text-ber-gray">
                  <p>Saving realizado: <strong>{fmtBRL(okSaving)}</strong></p>
                  <p>Taxa de Administração: <strong>{fmtBRL(taxaAdminTotal)}</strong></p>
                </div>
              </div>
            </div>
          )}

          {/* Card Contrato Total (principal + Change Orders) */}
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 mb-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">💼 Contrato Total (Principal + Change Orders)</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-emerald-900">{fmtBRL(contratoTotal)}</p>
              </div>
              <div className="flex flex-col items-end gap-0.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-700">Contrato principal:</span>
                  <span className="font-bold text-emerald-900 tabular-nums">{fmtBRL(contratoPrincipal)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-700">+ Change Orders:</span>
                  <span className={`font-bold tabular-nums ${netCO >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {netCO >= 0 ? '+' : ''}{fmtBRL(netCO)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Linha de referência */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-white border border-ber-gray/10 p-3">
              <p className="text-[10px] font-medium text-ber-gray uppercase tracking-wide">Total Venda</p>
              <p className="mt-0.5 text-sm font-bold text-ber-carbon">{fmtBRL(totalVendaBruta)}</p>
              {comissao > 0 && (
                <p className="text-[10px] text-ber-teal font-semibold">Líq. {fmtBRL(totalVenda)}</p>
              )}
            </div>
            <div className="rounded-lg bg-white border border-ber-gray/10 p-3">
              <p className="text-[10px] font-medium text-ber-gray uppercase tracking-wide">Total Meta</p>
              <p className="mt-0.5 text-sm font-bold text-ber-carbon">{fmtBRL(totalMeta)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
              <p className="text-[10px] font-medium text-amber-700 uppercase tracking-wide">🛒 A Comprar</p>
              <p className="mt-0.5 text-sm font-bold text-amber-700">{itemsPend.length} itens · {fmtBRL(pendVenda)}</p>
              <p className="text-[10px] text-amber-700/80">meta {fmtBRL(pendMeta)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
              <p className="text-[10px] font-medium text-amber-700 uppercase tracking-wide">Potencial Saving</p>
              <p className="mt-0.5 text-sm font-bold text-amber-700">{fmtBRL(pendVenda - pendMeta)}</p>
              <p className="text-[10px] text-amber-700/80">se bater a meta no restante</p>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Tabela */}
      {loading ? (
        <div className="py-12 text-center text-sm text-ber-gray">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-16 text-center">
          <ShoppingCart size={32} className="mx-auto mb-3 text-ber-gray/40" />
          <p className="text-sm font-medium text-ber-gray">Nenhum item cadastrado</p>
          <p className="mt-1 text-xs text-ber-gray/60">Importe o orçamento (.xlsx) para começar</p>
          <button
            onClick={() => setShowImport(true)}
            className="mt-4 rounded-lg bg-ber-teal px-4 py-2 text-sm font-medium text-white hover:bg-ber-teal/90"
          >
            Importar Orçamento
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ber-gray/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-ber-carbon text-xs text-white">
              <tr>
                <th className="px-3 py-3 text-center w-8">
                  <button
                    onClick={toggleAll}
                    title={allCollapsed ? 'Expandir tudo' : 'Recolher tudo'}
                    className="inline-flex items-center justify-center rounded hover:bg-white/20 p-0.5 transition-colors"
                  >
                    {allCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                </th>
                <th className="px-3 py-3 text-center w-12">Pacote</th>
                <th className="px-3 py-3 text-left w-8">N</th>
                <th className="px-3 py-3 text-left min-w-[140px]">Categoria</th>
                <th className="px-3 py-3 text-left min-w-[160px]">Descritivo</th>
                <th className="px-3 py-3 text-right">Venda</th>
                {comissao > 0 && <th className="px-3 py-3 text-right whitespace-nowrap">Venda Líq.</th>}
                <th className="px-3 py-3 text-center w-20">% Meta</th>
                <th className="px-3 py-3 text-right">Meta</th>
                <th className="px-3 py-3 text-right min-w-[100px]">Comprado</th>
                <th className="px-3 py-3 text-left min-w-[130px]">Fornecedor</th>
                <th className="px-3 py-3 text-center min-w-[120px]">Faturamento</th>
                <th className="px-3 py-3 text-right">Sav. Orç</th>
                <th className="px-3 py-3 text-right">Sav. Meta</th>
                <th className="px-3 py-3 text-center w-10">🚦</th>
              </tr>
              <tr className="bg-ber-carbon/80 text-[11px]">
                <th
                  colSpan={comissao > 0 ? 12 : 11}
                  className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-white/60"
                >
                  Total
                </th>
                <th className={`px-3 py-2 text-right tabular-nums font-bold ${okSaving >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  <div className="leading-tight">
                    {fmtBRL(okSaving)}
                    <div className="text-[10px] font-medium opacity-80">{okSavingPct.toFixed(1)}%</div>
                  </div>
                </th>
                <th className={`px-3 py-2 text-right tabular-nums font-bold ${okSavingMeta >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  <div className="leading-tight">
                    {fmtBRL(okSavingMeta)}
                    <div className="text-[10px] font-medium opacity-80">{okSavingMetaPct.toFixed(1)}%</div>
                  </div>
                </th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(() => {
                let currentEtapa: string | null = null;
                let rowIdx = 0;
                return items.map((item) => {
                  if (item.tipo === 'etapa') {
                    currentEtapa = item.n;
                    const isCollapsed = collapsed[item.n || ''] ?? false;
                    // Subtotais da etapa
                    const children = items.filter(
                      c => c.tipo === 'item' && c.n && item.n && c.n.startsWith(item.n + '.')
                    );
                    const etapaVendaBruta = children.reduce((s, c) => s + c.venda, 0);
                    const etapaVendaLiq = children.reduce((s, c) => s + baseItem(c), 0);
                    const etapaMeta = children.reduce((s, c) => s + metaItem(c), 0);
                    const etapaPctMeta = etapaVendaLiq > 0 ? (1 - etapaMeta / etapaVendaLiq) * 100 : 0;
                    const childCompradoVal = (c: typeof items[number]) => (c.splits.length > 0
                      ? c.splits.reduce((ss, sp) => ss + sp.valor, 0)
                      : c.comprado);
                    const etapaComprado = children.reduce((s, c) => s + childCompradoVal(c), 0);
                    // Subtotais Sav.Orç / Sav.Meta consideram só filhos com compra lançada
                    const childrenComComprado = children.filter(c => childCompradoVal(c) > 0);
                    const etapaSavOrc = childrenComComprado.reduce(
                      (s, c) => s + (baseItem(c) - childCompradoVal(c)), 0
                    );
                    const etapaSavMeta = childrenComComprado.reduce(
                      (s, c) => s + (metaItem(c) - childCompradoVal(c)), 0
                    );
                    const etapaHasComprado = childrenComComprado.length > 0;
                    return (
                      <tr key={item.id} className="bg-ber-carbon/5 border-t-2 border-ber-carbon/10">
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2" />
                        <td className="px-3 py-2">
                          <button
                            onClick={() => toggleCollapse(item.n || '')}
                            className="flex items-center gap-1 text-ber-carbon hover:text-ber-teal"
                          >
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                            <span className="text-xs font-bold">{item.n}</span>
                          </button>
                        </td>
                        <td className="px-3 py-2" colSpan={2}>
                          <input
                            type="text"
                            value={item.categoria}
                            onChange={e => saveItem(item.id, { categoria: e.target.value })}
                            className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-bold text-ber-carbon hover:border-ber-gray/30 focus:border-ber-teal focus:bg-white focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums font-bold text-ber-carbon">
                          {fmtBRL(etapaVendaBruta)}
                        </td>
                        {comissao > 0 && (
                          <td className="px-3 py-2 text-right text-xs tabular-nums font-bold text-ber-teal/80">
                            {fmtBRL(etapaVendaLiq)}
                          </td>
                        )}
                        <td className="px-3 py-2 text-center text-xs tabular-nums font-bold text-ber-carbon">
                          {etapaPctMeta >= 0 ? `${etapaPctMeta.toFixed(0)}%` : '–'}
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums font-bold text-ber-teal">
                          {fmtBRL(etapaMeta)}
                        </td>
                        <td className="px-3 py-2">
                          {etapaComprado > 0 ? (
                            <span className="block w-full px-1 py-0.5 text-right text-xs tabular-nums font-bold text-ber-carbon">
                              {fmtBRL(etapaComprado)}
                            </span>
                          ) : (
                            <input
                              {...valorInputProps(item.id, item.comprado, v => saveItem(item.id, { comprado: v }))}
                              placeholder="0"
                              className="w-full rounded border border-ber-gray/30 bg-white px-1 py-0.5 text-right text-xs tabular-nums font-bold focus:border-ber-teal focus:outline-none"
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.fornecedor || ''}
                            onChange={e => saveItem(item.id, { fornecedor: e.target.value })}
                            placeholder="Fornecedor..."
                            className="w-full rounded border border-ber-gray/30 bg-white px-1 py-0.5 text-xs font-bold focus:border-ber-teal focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <select
                            value={item.faturamento || ''}
                            onChange={e => saveItem(item.id, { faturamento: e.target.value || null })}
                            className="w-full rounded border border-ber-gray/30 bg-white px-1 py-0.5 text-xs font-bold focus:border-ber-teal focus:outline-none"
                          >
                            <option value="">—</option>
                            <option value="BER">BER</option>
                            <option value="Fornecedor">Fornecedor</option>
                          </select>
                        </td>
                        <td className={`px-3 py-2 text-right text-xs tabular-nums font-bold ${!etapaHasComprado ? 'text-gray-300' : etapaSavOrc >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {etapaHasComprado ? fmtBRL(etapaSavOrc) : '–'}
                        </td>
                        <td className={`px-3 py-2 text-right text-xs tabular-nums font-bold ${!etapaHasComprado ? 'text-gray-300' : etapaSavMeta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {etapaHasComprado ? fmtBRL(etapaSavMeta) : '–'}
                        </td>
                        <td className="px-3 py-2" />
                      </tr>
                    );
                  }

                  // Change Order row — always visible, never child of an etapa
                  if (item.tipo === 'co') {
                    const coSplits = item.splits.filter(s => s.coTipo !== null);
                    const coNet = coSplits.length > 0
                      ? coSplits.reduce((sum, s) => sum + (s.coTipo === 'credito' ? s.valor : -s.valor), 0)
                      : null;
                    const effectiveVenda = coNet !== null ? coNet : item.venda;
                    const meta = effectiveVenda * (1 - item.pctMeta);
                    const effectiveComprado = item.comprado;
                    const savOrç = effectiveVenda - effectiveComprado;
                    const savMeta = meta - effectiveComprado;
                    return (
                      <>
                      <tr key={item.id} className="bg-amber-50 border-t border-amber-200">
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={item.compradoOk}
                            onChange={e => saveItem(item.id, { compradoOk: e.target.checked })}
                            className="w-4 h-4 accent-amber-500 cursor-pointer" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white">CO</span>
                        </td>
                        <td className="px-3 py-2 text-ber-gray text-xs" />
                        <td className="px-3 py-2">
                          <input type="text" value={item.categoria}
                            onChange={e => saveItem(item.id, { categoria: e.target.value })}
                            placeholder="Descrição..."
                            className="w-full rounded border border-amber-300 bg-white px-1 py-0.5 text-xs font-medium text-ber-carbon focus:border-amber-500 focus:outline-none" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={item.descritivo || ''}
                            onChange={e => saveItem(item.id, { descritivo: e.target.value })}
                            placeholder="Detalhe..."
                            className="w-full rounded border border-amber-300 bg-white px-1 py-0.5 text-xs text-ber-gray focus:border-amber-500 focus:outline-none" />
                        </td>
                        <td className="px-3 py-2">
                          {coNet !== null ? (
                            <span className={`block text-right text-xs tabular-nums font-bold pr-1 ${coNet >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {coNet >= 0 ? '+' : ''}{fmtBRL(coNet)}
                            </span>
                          ) : (
                            <input type="text" inputMode="decimal"
                              value={localText[`venda_${item.id}`] ?? (item.venda === 0 ? '' : String(item.venda))}
                              onChange={e => setLocalText(prev => ({ ...prev, [`venda_${item.id}`]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const raw = localText[`venda_${item.id}`];
                                  if (raw !== undefined) {
                                    saveItem(item.id, { venda: parseComprado(raw) });
                                    setLocalText(prev => { const n = { ...prev }; delete n[`venda_${item.id}`]; return n; });
                                    e.currentTarget.blur();
                                  }
                                }
                              }}
                              onBlur={() => {
                                const raw = localText[`venda_${item.id}`];
                                if (raw !== undefined) {
                                  saveItem(item.id, { venda: parseComprado(raw) });
                                  setLocalText(prev => { const n = { ...prev }; delete n[`venda_${item.id}`]; return n; });
                                }
                              }}
                              placeholder="0"
                              className="w-full rounded border border-amber-300 bg-white px-1 py-0.5 text-right text-xs tabular-nums focus:border-amber-500 focus:outline-none" />
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="number" min={0} max={100} step={1}
                            value={Math.round(item.pctMeta * 100)}
                            onChange={e => saveItem(item.id, { pctMeta: Math.max(0, Math.min(100, Number(e.target.value))) / 100 })}
                            className="w-16 rounded border border-amber-300 px-1 py-0.5 text-center text-xs focus:border-amber-500 focus:outline-none" />
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-ber-teal font-medium">{fmtBRL(meta)}</td>
                        <td className="px-3 py-2">
                          <input {...valorInputProps(item.id, item.comprado, v => saveItem(item.id, { comprado: v }))}
                            placeholder="0"
                            className="w-full rounded border border-amber-300 bg-white px-1 py-0.5 text-right text-xs tabular-nums focus:border-amber-500 focus:outline-none" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={item.fornecedor || ''}
                            onChange={e => saveItem(item.id, { fornecedor: e.target.value })}
                            placeholder="Fornecedor..."
                            className="w-full rounded border border-amber-300 bg-white px-1 py-0.5 text-xs focus:border-amber-500 focus:outline-none" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <select value={item.faturamento || ''}
                            onChange={e => saveItem(item.id, { faturamento: e.target.value || null })}
                            className="w-full rounded border border-amber-300 bg-white px-1 py-0.5 text-xs focus:border-amber-500 focus:outline-none">
                            <option value="">—</option>
                            <option value="BER">BER</option>
                            <option value="Fornecedor">Fornecedor</option>
                          </select>
                          <div className="mt-1 flex gap-1">
                            <button onClick={() => addSplit(item.id, 'credito')}
                              className="flex items-center gap-0.5 text-[10px] font-medium text-green-600 hover:text-green-700">
                              <Plus size={9} /> C
                            </button>
                            <span className="text-[10px] text-ber-gray/40">/</span>
                            <button onClick={() => addSplit(item.id, 'debito')}
                              className="flex items-center gap-0.5 text-[10px] font-medium text-red-500 hover:text-red-600">
                              <Plus size={9} /> D
                            </button>
                          </div>
                        </td>
                        <td className={`px-3 py-2 text-right text-xs tabular-nums font-medium ${savOrç >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {fmtBRL(Math.abs(savOrç))}
                        </td>
                        <td className={`px-3 py-2 text-right text-xs tabular-nums font-medium ${savMeta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {fmtBRL(savMeta)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => deleteItem(item.id)} title="Remover change order"
                            className="text-red-400 hover:text-red-600">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                      {item.splits.map(sp => sp.coTipo !== null ? (
                        // Crédito / Débito sub-line — item de compra completo
                        (() => {
                          // Defensivos: se o backend não devolver os novos campos (deploy desalinhado),
                          // usa defaults locais pra UI não quebrar com NaN/undefined.
                          const spPctMeta = typeof sp.pctMeta === 'number' && !isNaN(sp.pctMeta) ? sp.pctMeta : 0.2;
                          const spComprado = typeof sp.comprado === 'number' && !isNaN(sp.comprado) ? sp.comprado : 0;
                          const spCompradoOk = !!sp.compradoOk;
                          // descricao pode vir null pra dados legado — usa fornecedor como fallback (era onde a descrição ficava)
                          const spDescricao = sp.descricao ?? '';
                          const spMeta = sp.valor * (1 - spPctMeta);
                          const spSavOrç = sp.valor - spComprado;
                          const spSavMeta = spMeta - spComprado;
                          const borderCol = sp.coTipo === 'credito' ? 'border-green-300 focus:border-green-500' : 'border-red-300 focus:border-red-500';
                          const bgCol = sp.coTipo === 'credito' ? 'bg-green-50' : 'bg-red-50';
                          return (
                        <tr key={sp.id} className={`border-l-2 ${sp.coTipo === 'credito' ? 'bg-green-50/60 border-green-400' : 'bg-red-50/60 border-red-400'} ${spCompradoOk ? 'opacity-60' : ''}`}>
                          <td className="px-3 py-1.5 text-center">
                            <input type="checkbox" checked={spCompradoOk}
                              onChange={e => saveSplit(item.id, sp.id, { compradoOk: e.target.checked })}
                              className={`w-4 h-4 cursor-pointer ${sp.coTipo === 'credito' ? 'accent-green-500' : 'accent-red-500'}`} />
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${sp.coTipo === 'credito' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                              {sp.coTipo === 'credito' ? 'C' : 'D'}
                            </span>
                          </td>
                          <td />
                          <td colSpan={2} className="px-3 py-1.5">
                            <input type="text" value={spDescricao}
                              placeholder="Descrição do item..."
                              onChange={e => saveSplit(item.id, sp.id, { descricao: e.target.value })}
                              className={`w-full rounded border px-1 py-0.5 text-xs focus:outline-none ${borderCol} ${bgCol}`} />
                          </td>
                          <td className="px-3 py-1.5">
                            <input {...valorInputProps(`splitv_${sp.id}`, sp.valor, v => saveSplit(item.id, sp.id, { valor: v }))}
                              placeholder="Valor"
                              className={`w-full rounded border px-1 py-0.5 text-right text-xs tabular-nums focus:outline-none ${borderCol} ${bgCol}`} />
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <input type="number" min={0} max={100} step={1}
                              value={Math.round(spPctMeta * 100)}
                              onChange={e => saveSplit(item.id, sp.id, { pctMeta: Math.max(0, Math.min(100, Number(e.target.value))) / 100 })}
                              className={`w-16 rounded border px-1 py-0.5 text-center text-xs focus:outline-none ${borderCol}`} />
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs tabular-nums text-ber-teal font-medium">{fmtBRL(spMeta)}</td>
                          <td className="px-3 py-1.5">
                            <input {...valorInputProps(`splitc_${sp.id}`, spComprado, v => saveSplit(item.id, sp.id, { comprado: v }))}
                              placeholder="0"
                              className={`w-full rounded border px-1 py-0.5 text-right text-xs tabular-nums focus:outline-none ${borderCol} ${bgCol}`} />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="text" value={sp.fornecedor || ''}
                              placeholder="Fornecedor..."
                              onChange={e => saveSplit(item.id, sp.id, { fornecedor: e.target.value })}
                              className={`w-full rounded border px-1 py-0.5 text-xs focus:outline-none ${borderCol} ${bgCol}`} />
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <select value={sp.faturamento || ''}
                              onChange={e => saveSplit(item.id, sp.id, { faturamento: e.target.value || null })}
                              className={`w-full rounded border px-1 py-0.5 text-xs focus:outline-none ${borderCol} ${bgCol}`}>
                              <option value="">—</option>
                              <option value="BER">BER</option>
                              <option value="Fornecedor">Fornecedor</option>
                            </select>
                          </td>
                          <td className={`px-3 py-1.5 text-right text-xs tabular-nums font-medium ${spSavOrç >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {fmtBRL(Math.abs(spSavOrç))}
                          </td>
                          <td className={`px-3 py-1.5 text-right text-xs tabular-nums font-medium ${spSavMeta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {fmtBRL(spSavMeta)}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <button onClick={() => deleteSplit(item.id, sp.id)} className="text-red-400 hover:text-red-600">
                              <X size={12} />
                            </button>
                          </td>
                        </tr>
                          );
                        })()
                      ) : (
                        // Split legado (comprado)
                        <tr key={sp.id} className="bg-amber-50 border-l-2 border-amber-400/40">
                          <td colSpan={8} />
                          <td className="px-3 py-1.5">
                            <input {...valorInputProps(`split_${sp.id}`, sp.valor, v => saveSplit(item.id, sp.id, { valor: v }))}
                              placeholder="Valor"
                              className="w-full rounded border border-amber-300 bg-white px-1 py-0.5 text-right text-xs tabular-nums focus:border-amber-500 focus:outline-none" />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="text" value={sp.fornecedor || ''} placeholder="Fornecedor..."
                              onChange={e => saveSplit(item.id, sp.id, { fornecedor: e.target.value })}
                              className="w-full rounded border border-amber-300 bg-white px-1 py-0.5 text-xs focus:border-amber-500 focus:outline-none" />
                          </td>
                          <td className="px-3 py-1.5">
                            <select value={sp.faturamento || ''} onChange={e => saveSplit(item.id, sp.id, { faturamento: e.target.value || null })}
                              className="w-full rounded border border-amber-300 bg-white px-1 py-0.5 text-xs focus:border-amber-500 focus:outline-none">
                              <option value="">—</option>
                              <option value="BER">BER</option>
                              <option value="Fornecedor">Fornecedor</option>
                            </select>
                          </td>
                          <td colSpan={2} className="px-3 py-1.5">
                            <button onClick={() => deleteSplit(item.id, sp.id)} className="text-red-400 hover:text-red-600">
                              <X size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      </>
                    );
                  }

                  // Item row — hide if parent etapa is collapsed
                  if (currentEtapa && (collapsed[currentEtapa] ?? false)) return null;

                  const idx = rowIdx++;
                  const hasSplits = item.splits.length > 0;
                  const effectiveComprado = hasSplits
                    ? item.splits.reduce((s, sp) => s + sp.valor, 0)
                    : item.comprado;
                  const meta = metaItem(item);
                  const savOrç = baseItem(item) - effectiveComprado;
                  const savMeta = meta - effectiveComprado;
                  const status = semaforo(effectiveComprado, meta);
                  const progPct = meta > 0 ? Math.min((effectiveComprado / meta) * 100, 100) : 0;
                  const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                  return (
                    <>
                    <tr key={item.id} className={`${rowBg} ${item.compradoOk ? 'opacity-60' : ''}`}>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={item.compradoOk}
                          onChange={e => saveItem(item.id, { compradoOk: e.target.checked })}
                          className="w-4 h-4 accent-ber-teal cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <select
                          value={item.pacote ?? ''}
                          onChange={e => saveItem(item.id, { pacote: e.target.value === '' ? null : Number(e.target.value) })}
                          className={`w-14 rounded px-1 py-0.5 text-xs font-bold text-center focus:outline-none border-0 ${item.pacote !== null && item.pacote !== undefined ? PACOTE_COLORS[item.pacote]?.bg + ' ' + PACOTE_COLORS[item.pacote]?.text : 'bg-gray-100 text-gray-400'}`}
                        >
                          <option value="">—</option>
                          {[0,1,2,3,4,5,6].map(p => (
                            <option key={p} value={p}>P{p}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-ber-gray text-xs pl-7">{item.n}</td>
                      <td className="px-3 py-2 font-medium text-ber-carbon text-xs">{item.categoria}</td>
                      <td className="px-3 py-2 text-ber-gray text-xs">{item.descritivo || '—'}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums">{fmtBRL(item.venda)}</td>
                      {comissao > 0 && (
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-ber-teal/80 font-medium">
                          {isElegivelComissao(item) ? fmtBRL(baseItem(item)) : '—'}
                        </td>
                      )}
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={0} max={100} step={1}
                          value={Math.round(item.pctMeta * 100)}
                          onChange={e => saveItem(item.id, { pctMeta: Math.max(0, Math.min(100, Number(e.target.value))) / 100 })}
                          className="w-16 rounded border border-ber-gray/30 px-1 py-0.5 text-center text-xs focus:border-ber-teal focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-ber-teal font-medium">{fmtBRL(meta)}</td>
                      <td className="px-3 py-2">
                        {hasSplits ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-right text-xs tabular-nums font-medium text-ber-carbon pr-1">{fmtBRL(effectiveComprado)}</span>
                            <div className="h-1 rounded-full bg-gray-200">
                              <div className={`h-1 rounded-full transition-all ${effectiveComprado > meta ? 'bg-red-500' : effectiveComprado >= meta * 0.85 ? 'bg-amber-400' : 'bg-green-500'}`} style={{ width: `${progPct}%` }} />
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <input
                              {...valorInputProps(item.id, item.comprado, v => saveItem(item.id, { comprado: v }))}
                              placeholder="0"
                              className="w-full rounded border border-ber-gray/30 px-1 py-0.5 text-right text-xs tabular-nums focus:border-ber-teal focus:outline-none"
                            />
                            <div className="h-1 rounded-full bg-gray-200">
                              <div className={`h-1 rounded-full transition-all ${item.comprado > meta ? 'bg-red-500' : item.comprado >= meta * 0.85 ? 'bg-amber-400' : 'bg-green-500'}`} style={{ width: `${progPct}%` }} />
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {!hasSplits && (
                          <input
                            type="text"
                            value={item.fornecedor || ''}
                            onChange={e => saveItem(item.id, { fornecedor: e.target.value })}
                            placeholder="Fornecedor..."
                            className="w-full rounded border border-ber-gray/30 px-1 py-0.5 text-xs focus:border-ber-teal focus:outline-none"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {!hasSplits && (
                          <select
                            value={item.faturamento || ''}
                            onChange={e => saveItem(item.id, { faturamento: e.target.value || null })}
                            className="w-full rounded border border-ber-gray/30 px-1 py-0.5 text-xs focus:border-ber-teal focus:outline-none"
                          >
                            <option value="">—</option>
                            <option value="BER">BER</option>
                            <option value="Fornecedor">Fornecedor</option>
                          </select>
                        )}
                        <button
                          onClick={() => addSplit(item.id)}
                          title="Adicionar fornecedor"
                          className="mt-0.5 flex items-center gap-0.5 text-[10px] text-ber-teal hover:text-ber-teal/70"
                        >
                          <Plus size={10} /> split
                        </button>
                      </td>
                      <td className={`px-3 py-2 text-right text-xs tabular-nums font-medium ${effectiveComprado === 0 ? 'text-gray-300' : savOrç >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {effectiveComprado === 0 ? '–' : (
                          <><TrendingDown size={10} className="inline mr-0.5" />{fmtBRL(savOrç)}</>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right text-xs tabular-nums font-medium ${effectiveComprado === 0 ? 'text-gray-300' : savMeta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {effectiveComprado === 0 ? '–' : fmtBRL(savMeta)}
                      </td>
                      <td className="px-3 py-2 text-center text-base">{status}</td>
                    </tr>
                    {item.splits.map(sp => (
                      <tr key={sp.id} className={`${rowBg} border-l-2 border-ber-teal/30`}>
                        <td colSpan={8} />
                        <td className="px-3 py-1.5">
                          <input
                            {...valorInputProps(`split_${sp.id}`, sp.valor, v => saveSplit(item.id, sp.id, { valor: v }))}
                            placeholder="Valor"
                            className="w-full rounded border border-ber-teal/40 bg-ber-teal/5 px-1 py-0.5 text-right text-xs tabular-nums focus:border-ber-teal focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={sp.fornecedor || ''}
                            placeholder="Fornecedor..."
                            onChange={e => saveSplit(item.id, sp.id, { fornecedor: e.target.value })}
                            className="w-full rounded border border-ber-teal/40 bg-ber-teal/5 px-1 py-0.5 text-xs focus:border-ber-teal focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            value={sp.faturamento || ''}
                            onChange={e => saveSplit(item.id, sp.id, { faturamento: e.target.value || null })}
                            className="w-full rounded border border-ber-teal/40 bg-ber-teal/5 px-1 py-0.5 text-xs focus:border-ber-teal focus:outline-none"
                          >
                            <option value="">—</option>
                            <option value="BER">BER</option>
                            <option value="Fornecedor">Fornecedor</option>
                          </select>
                        </td>
                        <td colSpan={2} className="px-3 py-1.5">
                          <button
                            onClick={() => deleteSplit(item.id, sp.id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <X size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    </>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Import */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ber-carbon">Importar Orçamento</h2>
              <button onClick={() => { setShowImport(false); setImportFile(null); }}>
                <X size={20} className="text-ber-gray" />
              </button>
            </div>

            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 flex gap-2 text-xs text-amber-800">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              Importar substituirá todos os dados de compras desta obra.
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="mb-4 cursor-pointer rounded-xl border-2 border-dashed border-ber-gray/30 p-8 text-center hover:border-ber-teal hover:bg-ber-teal/5 transition-colors"
            >
              <Upload size={24} className="mx-auto mb-2 text-ber-gray/50" />
              {importFile ? (
                <p className="text-sm font-medium text-ber-carbon">{importFile.name}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-ber-gray">Clique para selecionar</p>
                  <p className="text-xs text-ber-gray/60 mt-1">Arquivos .xlsx aceitos</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => setImportFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowImport(false); setImportFile(null); }}
                className="flex-1 rounded-lg border border-ber-gray/20 py-2 text-sm text-ber-gray hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={!importFile || importing}
                className="flex-1 rounded-lg bg-ber-teal py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-ber-teal/90"
              >
                {importing ? 'Importando...' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm Clear */}
      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-bold text-ber-carbon">Limpar tudo?</h2>
            <p className="mb-4 text-sm text-ber-gray">
              Todos os {items.length} itens serão excluídos permanentemente.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmClear(false)}
                className="flex-1 rounded-lg border border-ber-gray/20 py-2 text-sm text-ber-gray hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleClear}
                className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-medium text-white hover:bg-red-600"
              >
                Limpar tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
