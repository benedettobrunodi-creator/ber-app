'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Upload, Trash2, X, AlertTriangle, TrendingDown, TrendingUp, ShoppingCart } from 'lucide-react';
import api from '@/lib/api';

interface CompraItem {
  id: string;
  n: string | null;
  categoria: string;
  descritivo: string | null;
  venda: number;
  pctMeta: number;
  comprado: number;
  fornecedor: string | null;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

function semaforo(comprado: number, meta: number): '🟢' | '🟡' | '🔴' {
  if (comprado === 0) return '🟢';
  if (comprado > meta) return '🔴';
  if (comprado >= meta * 0.85) return '🟡';
  return '🟢';
}

export default function ComprasPage() {
  const { id: obraId } = useParams<{ id: string }>();
  const [items, setItems] = useState<CompraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/obras/${obraId}/compras`)
      .then(({ data }) => setItems(data.data || []))
      .finally(() => setLoading(false));
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

  // Import
  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    const form = new FormData();
    form.append('file', importFile);
    try {
      await api.post(`/obras/${obraId}/compras/import`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
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

  // Totais
  const totalVenda = items.reduce((s, i) => s + i.venda, 0);
  const totalMeta = items.reduce((s, i) => s + i.venda * (1 - i.pctMeta), 0);
  const totalComprado = items.reduce((s, i) => s + i.comprado, 0);
  const savingTotal = totalVenda - totalComprado;
  const savingPct = totalVenda > 0 ? (savingTotal / totalVenda) * 100 : 0;

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ShoppingCart size={20} className="text-ber-teal" />
          <h1 className="text-xl font-black text-ber-carbon">Metas de Compra</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 rounded-lg bg-ber-teal px-3 py-2 text-sm font-medium text-white hover:bg-ber-teal/90"
          >
            <Upload size={14} /> Importar Orçamento
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

      {/* Cards de resumo */}
      {items.length > 0 && (
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-ber-gray">Total Venda</p>
            <p className="mt-1 text-lg font-bold text-ber-carbon">{fmtBRL(totalVenda)}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-ber-gray">Total Meta</p>
            <p className="mt-1 text-lg font-bold text-ber-carbon">{fmtBRL(totalMeta)}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-xs text-ber-gray">Total Comprado</p>
            <p className="mt-1 text-lg font-bold text-ber-carbon">{fmtBRL(totalComprado)}</p>
          </div>
          <div className={`rounded-xl p-4 shadow-sm ${savingTotal >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="text-xs text-ber-gray">Saving Total</p>
            <p className={`mt-1 text-lg font-bold ${savingTotal >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {fmtBRL(savingTotal)}
            </p>
            <p className="text-xs text-ber-gray">{savingPct.toFixed(1)}% do orçamento</p>
          </div>
        </div>
      )}

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
                <th className="px-3 py-3 text-left w-8">N</th>
                <th className="px-3 py-3 text-left min-w-[140px]">Categoria</th>
                <th className="px-3 py-3 text-left min-w-[160px]">Descritivo</th>
                <th className="px-3 py-3 text-right">Venda</th>
                <th className="px-3 py-3 text-center w-20">% Meta</th>
                <th className="px-3 py-3 text-right">Meta</th>
                <th className="px-3 py-3 text-right min-w-[100px]">Comprado</th>
                <th className="px-3 py-3 text-left min-w-[130px]">Fornecedor</th>
                <th className="px-3 py-3 text-right">Sav. Orç</th>
                <th className="px-3 py-3 text-right">Sav. Meta</th>
                <th className="px-3 py-3 text-center w-10">🚦</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const meta = item.venda * (1 - item.pctMeta);
                const savOrç = item.venda - item.comprado;
                const savMeta = meta - item.comprado;
                const status = semaforo(item.comprado, meta);
                const progPct = meta > 0 ? Math.min((item.comprado / meta) * 100, 100) : 0;
                return (
                  <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-ber-gray text-xs">{item.n}</td>
                    <td className="px-3 py-2 font-medium text-ber-carbon text-xs">{item.categoria}</td>
                    <td className="px-3 py-2 text-ber-gray text-xs">{item.descritivo || '—'}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{fmtBRL(item.venda)}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min={0} max={100} step={1}
                        value={Math.round(item.pctMeta * 100)}
                        onChange={e => saveItem(item.id, { pctMeta: Number(e.target.value) / 100 })}
                        className="w-16 rounded border border-ber-gray/30 px-1 py-0.5 text-center text-xs focus:border-ber-teal focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-ber-teal font-medium">{fmtBRL(meta)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        <input
                          type="number"
                          min={0} step={100}
                          value={item.comprado}
                          onChange={e => saveItem(item.id, { comprado: Number(e.target.value) })}
                          className="w-full rounded border border-ber-gray/30 px-1 py-0.5 text-right text-xs tabular-nums focus:border-ber-teal focus:outline-none"
                        />
                        <div className="h-1 rounded-full bg-gray-200">
                          <div
                            className={`h-1 rounded-full transition-all ${item.comprado > meta ? 'bg-red-500' : item.comprado >= meta * 0.85 ? 'bg-amber-400' : 'bg-green-500'}`}
                            style={{ width: `${progPct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.fornecedor || ''}
                        onChange={e => saveItem(item.id, { fornecedor: e.target.value })}
                        placeholder="Fornecedor..."
                        className="w-full rounded border border-ber-gray/30 px-1 py-0.5 text-xs focus:border-ber-teal focus:outline-none"
                      />
                    </td>
                    <td className={`px-3 py-2 text-right text-xs tabular-nums font-medium ${savOrç >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {savOrç >= 0 ? <TrendingDown size={10} className="inline mr-0.5" /> : <TrendingUp size={10} className="inline mr-0.5" />}
                      {fmtBRL(Math.abs(savOrç))}
                    </td>
                    <td className={`px-3 py-2 text-right text-xs tabular-nums font-medium ${savMeta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {fmtBRL(savMeta)}
                    </td>
                    <td className="px-3 py-2 text-center text-base">{status}</td>
                  </tr>
                );
              })}
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
