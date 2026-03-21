'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ClipboardCheck, HardHat, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface Obra {
  id: string;
  name: string;
  client: string | null;
  status: string;
}

interface Checklist {
  id: string;
  type: string;
  segment: string | null;
  status: string;
  createdAt: string;
  completedAt: string | null;
  creator: { id: string; name: string } | null;
  template: { id: string; name: string } | null;
  items: { answer: string | null; required: boolean }[];
  _count: { items: number };
}

interface ObraChecklists {
  obra: Obra;
  checklists: Checklist[];
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  concluido: { label: 'Concluido', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  em_andamento: { label: 'Em andamento', className: 'bg-amber-100 text-amber-700', icon: Clock },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ChecklistsPage() {
  const router = useRouter();
  const [data, setData] = useState<ObraChecklists[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const obrasRes = await api.get('/obras');
        const obras: Obra[] = obrasRes.data.data;
        const activeObras = obras.filter((o) => o.status === 'em_andamento');

        const results = await Promise.all(
          activeObras.map(async (obra) => {
            try {
              const res = await api.get(`/obras/${obra.id}/checklists`);
              return { obra, checklists: res.data.data as Checklist[] };
            } catch {
              return { obra, checklists: [] };
            }
          }),
        );

        results.sort((a, b) => {
          const aActive = a.checklists.filter((c) => c.status === 'em_andamento').length;
          const bActive = b.checklists.filter((c) => c.status === 'em_andamento').length;
          if (aActive !== bActive) return bActive - aActive;
          return a.obra.name.localeCompare(b.obra.name);
        });

        setData(results);
      } catch {
        /* handled by interceptor */
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-black text-ber-carbon">Checklists</h1>
        <p className="mt-4 text-sm text-ber-gray">Carregando...</p>
      </div>
    );
  }

  const totalChecklists = data.reduce((acc, d) => acc + d.checklists.length, 0);
  const activeChecklists = data.reduce(
    (acc, d) => acc + d.checklists.filter((c) => c.status === 'em_andamento').length,
    0,
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-ber-carbon">Checklists</h1>
          <p className="mt-0.5 text-sm text-ber-gray">
            {totalChecklists} checklist{totalChecklists !== 1 ? 's' : ''} em {data.length} obra{data.length !== 1 ? 's' : ''}
            {activeChecklists > 0 && (
              <span className="ml-2 text-amber-600 font-semibold">{activeChecklists} em andamento</span>
            )}
          </p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="mt-12 flex flex-col items-center text-center">
          <ClipboardCheck size={40} className="mb-3 text-ber-gray/30" />
          <p className="text-sm text-ber-gray">Nenhuma obra em andamento.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {data.map(({ obra, checklists }) => (
            <div key={obra.id}>
              <div className="mb-2 flex items-center gap-2">
                <HardHat size={16} className="text-ber-teal" />
                <h2 className="text-sm font-bold text-ber-carbon">{obra.name}</h2>
                {obra.client && <span className="text-xs text-ber-gray">— {obra.client}</span>}
              </div>

              {checklists.length === 0 ? (
                <div className="rounded-lg bg-white px-5 py-4 text-center text-sm text-ber-gray/60 shadow-sm">
                  Nenhum checklist criado
                </div>
              ) : (
                <div className="space-y-1">
                  {checklists.map((cl) => {
                    const cfg = STATUS_CONFIG[cl.status] ?? STATUS_CONFIG.em_andamento;
                    const StatusIcon = cfg.icon;
                    const totalItems = cl._count?.items ?? 0;
                    const answeredItems = cl.items?.filter((i) => i.answer !== null).length ?? 0;
                    const progress = totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0;

                    return (
                      <button
                        key={cl.id}
                        onClick={() => router.push(`/obras/${obra.id}/checklists/${cl.id}`)}
                        className="flex w-full items-center gap-4 rounded-lg border border-ber-gray/15 bg-white px-5 py-3 text-left transition-colors hover:border-ber-teal/30"
                      >
                        <StatusIcon size={16} className={cl.status === 'concluido' ? 'text-green-500' : 'text-amber-500'} />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-semibold text-ber-carbon">
                            {cl.template?.name ?? cl.type}
                          </p>
                          <div className="mt-0.5 flex items-center gap-3 text-xs text-ber-gray">
                            <span>{answeredItems}/{totalItems} itens</span>
                            {cl.segment && <span>{cl.segment}</span>}
                            <span>{formatDate(cl.createdAt)}</span>
                            {cl.creator && <span>{cl.creator.name.split(' ')[0]}</span>}
                          </div>
                        </div>

                        {totalItems > 0 && (
                          <div className="w-20 shrink-0">
                            <div className="mb-1 text-right text-xs text-ber-gray">{progress}%</div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ber-gray/10">
                              <div
                                className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-ber-olive'}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}>
                          {cfg.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
