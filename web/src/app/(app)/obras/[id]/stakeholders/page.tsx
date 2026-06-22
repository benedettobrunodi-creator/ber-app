'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useBackToObra } from '@/hooks/useBackToObra';
import Link from 'next/link';
import { ArrowLeft, Plus, Users, Trash2, Pencil, Mail, Phone } from 'lucide-react';
import api from '@/lib/api';
import StakeholderFormModal, { type Stakeholder } from '@/components/obras/StakeholderFormModal';

const errMsg = (err: unknown, fallback: string) => {
  const msg = (err as { response?: { data?: { error?: { message?: string } | string } } })?.response?.data?.error;
  return typeof msg === 'string' ? msg : msg?.message || fallback;
};

export default function StakeholdersPage() {
  const params = useParams<{ id: string }>();
  const obraId = params.id;
  const backHref = useBackToObra();
  const [obraName, setObraName] = useState('');
  const [items, setItems] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<Stakeholder | true | null>(null);

  async function fetchAll() {
    setLoading(true);
    try {
      const [list, obraRes] = await Promise.all([
        api.get<{ data: Stakeholder[] }>(`/obras/${obraId}/stakeholders`),
        api.get(`/obras/${obraId}`),
      ]);
      setItems(list.data.data);
      setObraName(obraRes.data.data.name);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchAll(); }, [obraId]);

  async function handleDelete(id: string) {
    if (!confirm('Remover este stakeholder?')) return;
    try { await api.delete(`/stakeholders/${id}`); fetchAll(); }
    catch (err) { alert(errMsg(err, 'Erro ao excluir')); }
  }

  // group by empresa for visualization
  const groups = items.reduce((acc, s) => {
    (acc[s.empresa] ||= []).push(s);
    return acc;
  }, {} as Record<string, Stakeholder[]>);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-ber-gray">
        <Link href={backHref} className="inline-flex items-center gap-1 hover:text-ber-carbon">
          <ArrowLeft size={14} /> {obraName || 'Obra'}
        </Link>
        <span>/</span><span className="text-ber-carbon font-medium">Stakeholders</span>
      </div>

      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-ber-teal" />
          <h1 className="text-xl font-black text-ber-carbon">Stakeholders</h1>
          <span className="text-sm text-ber-gray">· {items.length} contatos</span>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg bg-ber-carbon px-3 py-2 text-sm font-medium text-white hover:bg-ber-black">
          <Plus size={14} /> Novo contato
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center text-sm text-ber-gray">Carregando…</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-ber-gray/20 py-12 text-center">
          <Users size={28} className="mx-auto mb-2 text-ber-gray/40" />
          <p className="text-sm font-medium text-ber-gray">Nenhum stakeholder cadastrado</p>
          <p className="mt-1 text-xs text-ber-gray/60">Adicione cliente, arquiteto, gerenciadora, fornecedores-chave…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(groups).map(([empresa, list]) => (
            <div key={empresa} className="rounded-xl border border-ber-gray/15 bg-white shadow-sm overflow-hidden">
              <div className="bg-ber-carbon px-4 py-2 text-xs font-bold text-white uppercase tracking-wide">{empresa}</div>
              <ul className="divide-y divide-ber-gray/10">
                {list.map(s => (
                  <li key={s.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ber-carbon">{s.nome}</p>
                      {(s.cargo || s.funcao) && (
                        <p className="text-xs text-ber-gray">{[s.cargo, s.funcao].filter(Boolean).join(' · ')}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-ber-gray">
                        {s.email && <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 text-ber-teal hover:underline"><Mail size={10} /> {s.email}</a>}
                        {s.telefone && <a href={`tel:${s.telefone}`} className="inline-flex items-center gap-1 text-ber-teal hover:underline"><Phone size={10} /> {s.telefone}</a>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setShowForm(s)} title="Editar" className="rounded p-1 text-ber-gray hover:bg-ber-bg hover:text-ber-carbon"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(s.id)} title="Excluir" className="rounded p-1 text-ber-gray hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {showForm !== null && (
        <StakeholderFormModal
          obraId={obraId}
          edit={showForm === true ? null : showForm}
          onClose={() => setShowForm(null)}
          onSaved={() => { setShowForm(null); fetchAll(); }}
        />
      )}
    </div>
  );
}
