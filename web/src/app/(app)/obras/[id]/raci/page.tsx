'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Network, Trash2, X } from 'lucide-react';
import api from '@/lib/api';

type Papel = 'R' | 'A' | 'C' | 'I';

interface RaciItem {
  id: string;
  atividade: string;
  ordem: number;
  papeis: Record<string, Papel>;
}

interface Stakeholder {
  id: string;
  empresa: string;
  nome: string;
  cargo: string | null;
}

const PAPEL_COLORS: Record<Papel | '', string> = {
  R: 'bg-blue-500 text-white',
  A: 'bg-green-600 text-white',
  C: 'bg-amber-500 text-white',
  I: 'bg-gray-400 text-white',
  '': 'bg-transparent text-ber-gray',
};

const PAPEL_LABELS: Record<Papel, string> = {
  R: 'Responsável (faz)',
  A: 'Approver (decide)',
  C: 'Consultado',
  I: 'Informado',
};

const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

export default function RaciPage() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;
  const [obraName, setObraName] = useState('');
  const [items, setItems] = useState<RaciItem[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaAtividade, setNovaAtividade] = useState('');

  async function fetchAll() {
    setLoading(true);
    try {
      const [r, s, obraRes] = await Promise.all([
        api.get<{ data: RaciItem[] }>(`/obras/${obraId}/raci`),
        api.get<{ data: Stakeholder[] }>(`/obras/${obraId}/stakeholders`),
        api.get(`/obras/${obraId}`),
      ]);
      setItems(r.data.data);
      setStakeholders(s.data.data);
      setObraName(obraRes.data.data.name);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchAll(); }, [obraId]);

  async function addItem() {
    if (!novaAtividade.trim()) return;
    try {
      await api.post(`/obras/${obraId}/raci`, { atividade: novaAtividade.trim(), ordem: items.length });
      setNovaAtividade('');
      fetchAll();
    } catch (err) { alert(errMsg(err, 'Erro ao adicionar')); }
  }

  async function deleteItem(id: string) {
    if (!confirm('Remover esta atividade da matriz?')) return;
    try { await api.delete(`/raci/${id}`); fetchAll(); }
    catch (err) { alert(errMsg(err, 'Erro ao excluir')); }
  }

  function nextPapel(p: Papel | undefined): Papel | undefined {
    const seq: (Papel | undefined)[] = [undefined, 'R', 'A', 'C', 'I'];
    const idx = seq.indexOf(p);
    return seq[(idx + 1) % seq.length];
  }

  async function togglePapel(itemId: string, stakeholderId: string) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const current = item.papeis[stakeholderId];
    const next = nextPapel(current);
    const papeis = { ...item.papeis };
    if (next === undefined) delete papeis[stakeholderId];
    else papeis[stakeholderId] = next;
    // Optimistic
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, papeis } : i));
    try { await api.patch(`/raci/${itemId}`, { papeis }); }
    catch (err) { alert(errMsg(err, 'Erro ao atualizar')); fetchAll(); }
  }

  const cols = useMemo(
    () => stakeholders.map(s => ({ id: s.id, label: `${s.nome.split(' ')[0]} (${s.empresa})` })),
    [stakeholders],
  );

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={`/obras/${obraId}`} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> {obraName || 'Obra'}
        </Link>
        <span>/</span><span className="text-ber-carbon font-medium">Matriz RACI</span>
      </div>

      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Network size={20} className="text-ber-teal" />
          <h1 className="text-xl font-black text-ber-carbon">Matriz RACI</h1>
        </div>
        <div className="text-xs text-ber-gray flex items-center gap-3">
          {(['R', 'A', 'C', 'I'] as Papel[]).map(p => (
            <span key={p} className="flex items-center gap-1.5">
              <span className={`inline-block w-5 h-5 rounded text-center text-[10px] font-bold leading-5 ${PAPEL_COLORS[p]}`}>{p}</span>
              {PAPEL_LABELS[p]}
            </span>
          ))}
        </div>
      </div>

      {cols.length === 0 && !loading && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Cadastre stakeholders primeiro pra montar a matriz. <Link href={`/obras/${obraId}/stakeholders`} className="underline font-medium">Ir pra Stakeholders →</Link>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <input value={novaAtividade} onChange={e => setNovaAtividade(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()}
          placeholder="Nova atividade (ex: Aprovação de projetos elétricos)" className="flex-1 rounded-md border border-ber-gray/30 px-3 py-2 text-sm focus:border-ber-teal focus:outline-none" />
        <button onClick={addItem} className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-2 text-sm font-medium text-white hover:bg-ber-black">
          <Plus size={14} /> Adicionar
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center text-sm text-ber-gray">Carregando…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center">
          <Network size={28} className="mx-auto mb-2 text-ber-gray/40" />
          <p className="text-sm font-medium text-ber-gray">Nenhuma atividade cadastrada</p>
          <p className="mt-1 text-xs text-ber-gray/60">Adicione atividades-chave do projeto pra atribuir responsabilidades</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ber-gray/10 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-ber-carbon text-xs text-white">
              <tr>
                <th className="px-3 py-3 text-left min-w-[260px]">Atividade</th>
                {cols.map(c => (
                  <th key={c.id} className="px-2 py-3 text-center min-w-[90px]">{c.label}</th>
                ))}
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-t border-ber-gray/10 hover:bg-ber-bg/30">
                  <td className="px-3 py-2 text-ber-carbon">{it.atividade}</td>
                  {cols.map(c => {
                    const papel = it.papeis[c.id];
                    return (
                      <td key={c.id} className="px-2 py-2 text-center">
                        <button onClick={() => togglePapel(it.id, c.id)}
                          title="Clique pra ciclar: – → R → A → C → I → –"
                          className={`inline-block w-7 h-7 rounded text-xs font-bold leading-7 transition-colors ${papel ? PAPEL_COLORS[papel] : 'border border-dashed border-ber-gray/30 text-ber-gray/40 hover:border-ber-teal'}`}>
                          {papel || '–'}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => deleteItem(it.id)} className="rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
