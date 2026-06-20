'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Activity, Trash2, Save, X } from 'lucide-react';
import api from '@/lib/api';

interface Cell {
  id: string;
  funcao: string;
  ano: number;
  mes: number;
  hhPlan: number;
  hhReal: number;
}

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

export default function HistogramaPage() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;
  const [obraName, setObraName] = useState('');
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaFuncao, setNovaFuncao] = useState('');
  const [ano, setAno] = useState(new Date().getFullYear());
  const [view, setView] = useState<'plan' | 'real'>('plan');
  // edits buffered until Save
  const [edits, setEdits] = useState<Record<string, { hhPlan?: number; hhReal?: number }>>({});
  const [saving, setSaving] = useState(false);

  async function fetchAll() {
    setLoading(true);
    try {
      const [list, obraRes] = await Promise.all([
        api.get<{ data: Cell[] }>(`/obras/${obraId}/histograma`),
        api.get(`/obras/${obraId}`),
      ]);
      setCells(list.data.data);
      setObraName(obraRes.data.data.name);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchAll(); }, [obraId]);

  const funcoes = useMemo(() => {
    const set = new Set(cells.map(c => c.funcao));
    return Array.from(set).sort();
  }, [cells]);

  // Filter para o ano selecionado
  const cellsAno = useMemo(() => cells.filter(c => c.ano === ano), [cells, ano]);

  function getCellVal(funcao: string, mes: number) {
    const key = `${funcao}-${ano}-${mes}`;
    const edit = edits[key];
    const c = cellsAno.find(c => c.funcao === funcao && c.mes === mes);
    const fromEdit = view === 'plan' ? edit?.hhPlan : edit?.hhReal;
    if (fromEdit !== undefined) return fromEdit;
    if (!c) return 0;
    return view === 'plan' ? c.hhPlan : c.hhReal;
  }

  function setCellVal(funcao: string, mes: number, val: number) {
    const key = `${funcao}-${ano}-${mes}`;
    setEdits(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [view === 'plan' ? 'hhPlan' : 'hhReal']: val,
      },
    }));
  }

  async function handleSave() {
    if (Object.keys(edits).length === 0) return;
    setSaving(true);
    try {
      const payload = Object.entries(edits).map(([key, val]) => {
        const [funcao, anoStr, mesStr] = key.split('-');
        const _ano = Number(anoStr);
        const _mes = Number(mesStr);
        const existing = cells.find(c => c.funcao === funcao && c.ano === _ano && c.mes === _mes);
        return {
          funcao,
          ano: _ano,
          mes: _mes,
          hhPlan: val.hhPlan ?? existing?.hhPlan ?? 0,
          hhReal: val.hhReal ?? existing?.hhReal ?? 0,
        };
      });
      await api.put(`/obras/${obraId}/histograma`, { cells: payload });
      setEdits({});
      fetchAll();
    } catch (err) { alert(errMsg(err, 'Erro ao salvar')); }
    finally { setSaving(false); }
  }

  async function addFuncao() {
    if (!novaFuncao.trim()) return;
    if (funcoes.includes(novaFuncao.trim())) { setNovaFuncao(''); return; }
    // criar célula no mês corrente com 0 pra "garantir" a função na grade
    const now = new Date();
    try {
      await api.post(`/obras/${obraId}/histograma/cell`, {
        funcao: novaFuncao.trim(),
        ano,
        mes: now.getMonth() + 1,
        hhPlan: 0,
        hhReal: 0,
      });
      setNovaFuncao('');
      fetchAll();
    } catch (err) { alert(errMsg(err, 'Erro ao adicionar função')); }
  }

  async function deleteFuncao(funcao: string) {
    if (!confirm(`Remover a função "${funcao}" do histograma? Todas as células serão excluídas.`)) return;
    try {
      await api.request({ method: 'DELETE', url: `/obras/${obraId}/histograma/funcao`, data: { funcao } });
      fetchAll();
    } catch (err) { alert(errMsg(err, 'Erro ao excluir')); }
  }

  // Totais por mês e por função (no view selecionado)
  const totaisMes = MESES_ABREV.map((_, i) => {
    const mes = i + 1;
    return funcoes.reduce((s, f) => s + getCellVal(f, mes), 0);
  });
  const totaisFuncao = funcoes.map(f =>
    MESES_ABREV.reduce((s, _, i) => s + getCellVal(f, i + 1), 0),
  );

  const anosPresentes = useMemo(() => {
    const set = new Set(cells.map(c => c.ano));
    if (!set.has(ano)) set.add(ano);
    return Array.from(set).sort();
  }, [cells, ano]);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> {obraName || 'Obra'}
        </Link>
        <span>/</span><span className="text-ber-carbon font-medium">Histograma de MO</span>
      </div>

      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Activity size={20} className="text-ber-teal" />
          <h1 className="text-xl font-black text-ber-carbon">Histograma de Mão de Obra</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-ber-gray/30 p-0.5 bg-white">
            <button onClick={() => setView('plan')} className={`px-3 py-1 text-xs font-medium rounded ${view === 'plan' ? 'bg-ber-carbon text-white' : 'text-ber-gray'}`}>Plan</button>
            <button onClick={() => setView('real')} className={`px-3 py-1 text-xs font-medium rounded ${view === 'real' ? 'bg-ber-carbon text-white' : 'text-ber-gray'}`}>Real</button>
          </div>
          <select value={ano} onChange={e => setAno(Number(e.target.value))} className="rounded-md border border-ber-gray/30 px-2 py-1.5 text-sm focus:border-ber-teal focus:outline-none">
            {anosPresentes.map(a => <option key={a} value={a}>{a}</option>)}
            {!anosPresentes.includes(ano + 1) && <option value={ano + 1}>{ano + 1}</option>}
          </select>
          <button onClick={handleSave} disabled={saving || Object.keys(edits).length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-2 text-sm font-medium text-white hover:bg-ber-black disabled:opacity-40">
            <Save size={14} /> {saving ? 'Salvando…' : `Salvar (${Object.keys(edits).length})`}
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <input value={novaFuncao} onChange={e => setNovaFuncao(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFuncao()}
          placeholder="Nova função (ex: Pedreiro, Eletricista, Mestre…)" className="flex-1 rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:outline-none" />
        <button onClick={addFuncao} className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-2 text-sm font-medium text-white hover:bg-ber-black">
          <Plus size={14} /> Adicionar função
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center text-sm text-ber-gray">Carregando…</div>
      ) : funcoes.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center">
          <Activity size={28} className="mx-auto mb-2 text-ber-gray/40" />
          <p className="text-sm font-medium text-ber-gray">Nenhuma função cadastrada</p>
          <p className="mt-1 text-xs text-ber-gray/60">Adicione funções e edite o número de homens-hora por mês</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ber-gray/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-ber-carbon text-xs text-white">
              <tr>
                <th className="px-3 py-3 text-left min-w-[180px]">Função</th>
                {MESES_ABREV.map(m => (
                  <th key={m} className="px-2 py-3 text-center min-w-[64px]">{m}</th>
                ))}
                <th className="px-2 py-3 text-center w-20 bg-ber-bg/10">Total</th>
                <th className="px-2 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {funcoes.map((funcao, fi) => (
                <tr key={funcao} className="border-t border-ber-gray/10 hover:bg-ber-bg/30">
                  <td className="px-3 py-2 font-medium text-ber-carbon">{funcao}</td>
                  {MESES_ABREV.map((_, mi) => {
                    const mes = mi + 1;
                    const val = getCellVal(funcao, mes);
                    const isEdit = `${funcao}-${ano}-${mes}` in edits;
                    return (
                      <td key={mi} className="px-1 py-1 text-center">
                        <input type="number" min={0} step={1}
                          value={val || ''}
                          onChange={e => setCellVal(funcao, mes, Number(e.target.value) || 0)}
                          className={`w-full text-center text-xs tabular-nums rounded border px-1 py-1 focus:border-ber-teal focus:outline-none ${isEdit ? 'border-amber-400 bg-amber-50' : 'border-ber-gray/15'}`} />
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 text-center text-xs tabular-nums font-bold text-ber-carbon bg-ber-bg/10">{totaisFuncao[fi]}</td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => deleteFuncao(funcao)} className="rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600"><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-ber-carbon/30 bg-ber-bg/20">
                <td className="px-3 py-2 font-bold text-ber-carbon">Total</td>
                {totaisMes.map((t, i) => (
                  <td key={i} className="px-2 py-2 text-center text-xs tabular-nums font-bold text-ber-carbon">{t}</td>
                ))}
                <td className="px-2 py-2 text-center text-xs tabular-nums font-black text-ber-carbon bg-ber-bg/30">{totaisFuncao.reduce((a, b) => a + b, 0)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] text-ber-gray italic">
        Mostrando <strong>HH {view === 'plan' ? 'planejados' : 'realizados'}</strong> em {ano}.
        Alterne entre Plan/Real no topo. Edite valores e clique em Salvar pra persistir em lote.
      </p>
    </div>
  );
}
