'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Package, ChevronDown, ChevronRight } from 'lucide-react';

interface Recebimento {
  id: string;
  materialName: string;
  supplier: string;
  condition: string;
  createdAt: string;
  notes?: string;
}

interface Obra {
  id: string;
  name: string;
  status: string;
}

const conditionLabel: Record<string, { label: string; color: string }> = {
  aprovado: { label: 'Aprovado', color: 'bg-green-100 text-green-700' },
  ressalva: { label: 'Com Ressalva', color: 'bg-yellow-100 text-yellow-700' },
  reprovado: { label: 'Reprovado', color: 'bg-red-100 text-red-700' },
};

export default function RecebimentosPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [recebimentos, setRecebimentos] = useState<Record<string, Recebimento[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/obras').then(r => {
      setObras(r.data.obras || r.data);
      setLoading(false);
    });
  }, []);

  const toggleObra = async (obraId: string) => {
    setExpanded(prev => ({ ...prev, [obraId]: !prev[obraId] }));
    if (!recebimentos[obraId]) {
      try {
        const r = await api.get(`/obras/${obraId}/recebimentos`);
        setRecebimentos(prev => ({ ...prev, [obraId]: r.data }));
      } catch {
        setRecebimentos(prev => ({ ...prev, [obraId]: [] }));
      }
    }
  };

  if (loading) return <div className="p-8 text-[var(--ber-carbon-light)]">Carregando...</div>;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--ber-carbon)]">Recebimento de Materiais</h1>
        <p className="text-sm text-[var(--ber-carbon-light)] mt-1">{obras.length} obras</p>
      </div>
      <div className="space-y-2">
        {obras.map(obra => {
          const isOpen = expanded[obra.id];
          const items = recebimentos[obra.id] || [];
          return (
            <div key={obra.id} className="bg-white rounded-xl border border-[var(--ber-border)] overflow-hidden">
              <button onClick={() => toggleObra(obra.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-[var(--ber-offwhite)] transition-colors">
                <div className="flex items-center gap-3">
                  <Package size={18} className="text-[var(--ber-olive)]" />
                  <span className="font-medium text-[var(--ber-carbon)]">{obra.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {isOpen && <span className="text-xs text-[var(--ber-carbon-light)]">{items.length} recebimentos</span>}
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-[var(--ber-border)]">
                  {items.length === 0 ? (
                    <p className="text-center text-sm text-[var(--ber-carbon-light)] py-6">Nenhum recebimento registrado.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--ber-offwhite)]">
                        <tr>
                          <th className="text-left p-3 text-[var(--ber-carbon-light)] font-medium">Material</th>
                          <th className="text-left p-3 text-[var(--ber-carbon-light)] font-medium">Fornecedor</th>
                          <th className="text-left p-3 text-[var(--ber-carbon-light)] font-medium">Condição</th>
                          <th className="text-left p-3 text-[var(--ber-carbon-light)] font-medium">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => (
                          <tr key={item.id} className="border-t border-[var(--ber-border)]">
                            <td className="p-3 text-[var(--ber-carbon)]">{item.materialName}</td>
                            <td className="p-3 text-[var(--ber-carbon-light)]">{item.supplier}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${conditionLabel[item.condition]?.color || 'bg-gray-100 text-gray-600'}`}>
                                {conditionLabel[item.condition]?.label || item.condition}
                              </span>
                            </td>
                            <td className="p-3 text-[var(--ber-carbon-light)]">
                              {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
