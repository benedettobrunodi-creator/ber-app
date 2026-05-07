'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { NotebookPen, Calendar, ChevronRight, CloudSun, CloudRain, Sun, Cloud, Zap } from 'lucide-react';

interface ObraComDiario {
  id: string;
  name: string;
  client: string | null;
  status: string;
  ultimoDiario: {
    data: string;
    status: 'rascunho' | 'fechado';
    clima: string | null;
    _count: { efetivos: number };
  } | null;
}

const climaIcon: Record<string, React.ReactNode> = {
  sol: <Sun size={14} className="text-yellow-500" />,
  parcialmente_nublado: <CloudSun size={14} className="text-yellow-400" />,
  nublado: <Cloud size={14} className="text-gray-400" />,
  chuva: <CloudRain size={14} className="text-blue-400" />,
  tempestade: <Zap size={14} className="text-purple-400" />,
};

function fmtDate(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function DiarioListPage() {
  const router = useRouter();
  const [obras, setObras] = useState<ObraComDiario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/obras?status=em_andamento&limit=100');
        const lista: { id: string; name: string; client: string | null; status: string }[] = res.data?.data ?? [];

        const obrasComDiario = await Promise.all(
          lista.map(async (obra) => {
            try {
              const dr = await api.get(`/obras/${obra.id}/diario`);
              const diarios: any[] = dr.data?.data ?? [];
              const ultimo = diarios[0] ?? null;
              return { ...obra, ultimoDiario: ultimo };
            } catch {
              return { ...obra, ultimoDiario: null };
            }
          })
        );

        setObras(obrasComDiario);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ber-olive border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <NotebookPen size={24} className="text-ber-olive" />
        <div>
          <h1 className="text-xl font-bold text-white">Diário de Obra</h1>
          <p className="text-xs text-gray-500">{obras.length} obras ativas</p>
        </div>
      </div>

      {obras.length === 0 && (
        <p className="text-center text-gray-500 py-12">Nenhuma obra em andamento.</p>
      )}

      <div className="space-y-3">
        {obras.map((obra) => {
          const ul = obra.ultimoDiario;
          const semDiarioHoje = !ul || fmtDate(ul.data) !== fmtDate(new Date().toISOString().slice(0, 10));
          return (
            <button
              key={obra.id}
              onClick={() => router.push(`/diario/${obra.id}`)}
              className="w-full rounded-xl border border-ber-border bg-ber-card p-4 text-left transition-colors hover:border-ber-olive/50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{obra.name}</p>
                  {obra.client && (
                    <p className="text-xs text-gray-500 truncate">{obra.client}</p>
                  )}
                </div>
                <ChevronRight size={16} className="text-gray-500 shrink-0 mt-0.5 ml-2" />
              </div>

              <div className="mt-3 flex items-center gap-3">
                {ul ? (
                  <>
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar size={12} />
                      {fmtDate(ul.data)}
                    </span>
                    {ul.clima && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        {climaIcon[ul.clima] ?? null}
                        {ul.clima.replace('_', ' ')}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      {ul._count.efetivos} efetivo{ul._count.efetivos !== 1 ? 's' : ''}
                    </span>
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        ul.status === 'fechado'
                          ? 'bg-green-900/40 text-green-400'
                          : 'bg-yellow-900/40 text-yellow-400'
                      }`}
                    >
                      {ul.status}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-gray-600">Sem registros</span>
                )}
                {semDiarioHoje && ul && (
                  <span className="ml-auto rounded-full bg-ber-red/20 px-2 py-0.5 text-[10px] font-bold text-ber-red">
                    Hoje pendente
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
