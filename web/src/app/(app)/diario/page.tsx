'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { NotebookPen, Calendar, ChevronRight, Sun, CloudSun, Cloud, CloudRain, Zap } from 'lucide-react';

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
  parcialmente_nublado: <CloudSun size={14} className="text-yellow-500" />,
  nublado: <Cloud size={14} className="text-ber-gray" />,
  chuva: <CloudRain size={14} className="text-blue-500" />,
  tempestade: <Zap size={14} className="text-purple-600" />,
};

function fmtDate(iso: string) {
  const dateOnly = iso.slice(0, 10);
  const d = new Date(dateOnly + 'T12:00:00');
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
              return { ...obra, ultimoDiario: diarios[0] ?? null };
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

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <NotebookPen size={24} className="text-ber-olive" />
        <div>
          <h1 className="text-xl font-bold text-ber-carbon">Diário de Obra</h1>
          <p className="text-xs text-ber-gray">{obras.length} obras ativas</p>
        </div>
      </div>

      {obras.length === 0 && (
        <p className="text-center text-ber-gray py-12 text-sm">Nenhuma obra em andamento.</p>
      )}

      <div className="space-y-3">
        {obras.map((obra) => {
          const ul = obra.ultimoDiario;
          const semDiarioHoje = !ul || ul.data.slice(0, 10) !== todayStr;
          return (
            <button
              key={obra.id}
              onClick={() => router.push(`/diario/${obra.id}`)}
              className="w-full rounded-xl border border-ber-border bg-white p-4 text-left transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ber-carbon truncate">{obra.name}</p>
                  {obra.client && (
                    <p className="text-xs text-ber-gray truncate">{obra.client}</p>
                  )}
                </div>
                <ChevronRight size={16} className="text-ber-gray shrink-0 mt-0.5 ml-2" />
              </div>

              <div className="mt-3 flex items-center gap-3 flex-wrap">
                {ul ? (
                  <>
                    <span className="flex items-center gap-1 text-xs text-ber-gray">
                      <Calendar size={12} />
                      {fmtDate(ul.data)}
                    </span>
                    {ul.clima && (
                      <span className="flex items-center gap-1 text-xs text-ber-gray">
                        {climaIcon[ul.clima] ?? null}
                        {ul.clima.replace(/_/g, ' ')}
                      </span>
                    )}
                    <span className="text-xs text-ber-gray">
                      {ul._count.efetivos} efetivo{ul._count.efetivos !== 1 ? 's' : ''}
                    </span>
                    <span
                      className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        ul.status === 'fechado'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {ul.status}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-ber-gray">Sem registros</span>
                )}
                {semDiarioHoje && ul && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-ber-red">
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
