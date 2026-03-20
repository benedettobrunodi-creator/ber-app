'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Tent, Calendar, User } from 'lucide-react';

interface Obra {
  id: string;
  name: string;
  client: string | null;
  status: string;
}

interface CanteiroChecklist {
  id: string;
  weekStart: string;
  status: string;
  createdAt: string;
  creator: { id: string; name: string } | null;
  approver: { id: string; name: string } | null;
  approvedAt: string | null;
  items: { answer: string | null; required: boolean }[];
  _count: { items: number };
}

interface ObraCanteiro {
  obra: Obra;
  checklist: CanteiroChecklist | null;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  em_andamento: { label: 'Em andamento', className: 'bg-amber-100 text-amber-700' },
  aprovado: { label: 'Aprovado', className: 'bg-green-100 text-green-700' },
  reprovado: { label: 'Reprovado', className: 'bg-red-100 text-red-700' },
  sem_checklist: { label: 'Sem checklist', className: 'bg-gray-100 text-gray-500' },
};

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatWeek(iso: string): string {
  const d = new Date(iso);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const fmt = (dt: Date) => dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return `${fmt(d)} — ${fmt(end)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function CanteiroPage() {
  const router = useRouter();
  const [data, setData] = useState<ObraCanteiro[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStart = getWeekStart();
  const weekISO = weekStart.toISOString().split('T')[0];

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
              const res = await api.get(`/obras/${obra.id}/canteiro`);
              const checklists: CanteiroChecklist[] = res.data.data;
              const current = checklists.find((c) => {
                const ws = new Date(c.weekStart).toISOString().split('T')[0];
                return ws === weekISO;
              }) ?? null;
              return { obra, checklist: current };
            } catch {
              return { obra, checklist: null };
            }
          }),
        );

        results.sort((a, b) => {
          if (a.checklist && !b.checklist) return -1;
          if (!a.checklist && b.checklist) return 1;
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
  }, [weekISO]);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-black text-ber-carbon">Canteiro</h1>
        <p className="mt-4 text-sm text-ber-gray">Carregando...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-ber-carbon">Canteiro</h1>
          <p className="mt-0.5 text-sm text-ber-gray">
            Semana atual: {formatWeek(weekStart.toISOString())}
          </p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="mt-12 flex flex-col items-center text-center">
          <Tent size={40} className="mb-3 text-ber-gray/30" />
          <p className="text-sm text-ber-gray">Nenhuma obra em andamento.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {data.map(({ obra, checklist }) => {
            const status = checklist?.status ?? 'sem_checklist';
            const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.sem_checklist;

            const totalItems = checklist?._count?.items ?? 0;
            const answeredItems = checklist?.items?.filter((i) => i.answer !== null).length ?? 0;
            const progress = totalItems > 0 ? Math.round((answeredItems / totalItems) * 100) : 0;

            return (
              <button
                key={obra.id}
                onClick={() => {
                  if (checklist) {
                    router.push(`/obras/${obra.id}/canteiro/${checklist.id}`);
                  } else {
                    router.push(`/obras/${obra.id}?tab=canteiro`);
                  }
                }}
                className="flex w-full items-center gap-4 rounded-lg border border-ber-gray/15 bg-white px-5 py-4 text-left transition-colors hover:border-ber-teal/30"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-ber-carbon">{obra.name}</p>
                  {obra.client && (
                    <p className="truncate text-xs text-ber-gray">{obra.client}</p>
                  )}
                  {checklist && (
                    <div className="mt-2 flex items-center gap-3 text-xs text-ber-gray">
                      <span>{answeredItems}/{totalItems} itens</span>
                      {checklist.creator && (
                        <span className="flex items-center gap-1">
                          <User size={10} />
                          {checklist.creator.name.split(' ')[0]}
                        </span>
                      )}
                      {checklist.approver && checklist.approvedAt && (
                        <span>
                          Aprovado por {checklist.approver.name.split(' ')[0]} em {formatDate(checklist.approvedAt)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {checklist && totalItems > 0 && (
                  <div className="w-24 shrink-0">
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
  );
}
