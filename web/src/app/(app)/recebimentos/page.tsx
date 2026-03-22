'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Package, ChevronRight } from 'lucide-react';

interface Obra {
  id: string;
  name: string;
  status: string;
}

export default function RecebimentosPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    api.get('/obras').then(r => {
      setObras(r.data.obras || r.data.data || (Array.isArray(r.data) ? r.data : []));
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="p-8 flex items-center gap-3 text-[var(--ber-carbon-light)]">
      <div className="w-5 h-5 border-2 border-[var(--ber-olive)] border-t-transparent rounded-full animate-spin" />
      Carregando...
    </div>
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--ber-carbon)]">Recebimento de Materiais</h1>
        <p className="text-sm text-[var(--ber-carbon-light)] mt-1">{obras.length} obras</p>
      </div>
      <div className="space-y-2">
        {obras.map(obra => (
          <button
            key={obra.id}
            onClick={() => router.push(`/recebimentos/${obra.id}`)}
            className="w-full bg-white rounded-xl border border-[var(--ber-border)] p-4 flex items-center justify-between hover:border-[var(--ber-olive)] hover:shadow-sm transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <Package size={18} className="text-[var(--ber-olive)]" />
              <span className="font-medium text-[var(--ber-carbon)]">{obra.name}</span>
            </div>
            <ChevronRight size={16} className="text-[var(--ber-carbon-light)]" />
          </button>
        ))}
      </div>
    </div>
  );
}
