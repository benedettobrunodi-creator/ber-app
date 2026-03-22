'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ListOrdered, ChevronRight } from 'lucide-react';

interface ObraWithSeq {
  id: string;
  name: string;
  client: string | null;
  status: string;
  sequenciamento: {
    id: string;
    template: { name: string; segment: string } | null;
    etapas: { status: string }[];
  } | null;
}

const STATUS_LABELS: Record<string, string> = {
  em_andamento: 'Em andamento',
  planejamento: 'Planejamento',
  pausada: 'Pausada',
  concluida: 'Concluída',
};

export default function SequenciamentoPage() {
  const router = useRouter();
  const [obras, setObras] = useState<ObraWithSeq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchObras() {
      try {
        const obrasRes = await api.get('/obras', { params: { limit: 100 } });
        const obrasData = obrasRes.data.data || [];

        const withSeq = await Promise.all(
          obrasData.map(async (obra: { id: string; name: string; client: string | null; status: string }) => {
            try {
              const seqRes = await api.get(`/obras/${obra.id}/sequenciamento`);
              return { ...obra, sequenciamento: seqRes.data.data };
            } catch {
              return { ...obra, sequenciamento: null };
            }
          }),
        );

        setObras(withSeq);
      } catch {
        /* handled by interceptor */
      } finally {
        setLoading(false);
      }
    }
    fetchObras();
  }, []);

  if (loading) {
    return <div className="text-sm text-ber-gray">Carregando...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-black text-ber-carbon">Sequenciamento</h1>
      <p className="mt-1 text-sm text-ber-gray">
        Acompanhe o progresso das etapas de cada obra
      </p>

      <div className="mt-8 space-y-3">
        {obras.length === 0 ? (
          <p className="py-12 text-center text-sm text-ber-gray">Nenhuma obra encontrada.</p>
        ) : (
          obras.map((obra) => {
            const seq = obra.sequenciamento;
            const totalEtapas = seq?.etapas?.length ?? 0;
            const approved = seq?.etapas?.filter((e) => e.status === 'aprovada').length ?? 0;
            const progress = totalEtapas > 0 ? Math.round((approved / totalEtapas) * 100) : 0;
            const hasSeq = !!seq;

            return (
              <button
                key={obra.id}
                onClick={() => router.push(`/sequenciamento/${obra.id}`)}
                className="flex w-full items-center gap-4 rounded-lg bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ber-carbon/5">
                  <ListOrdered size={20} className="text-ber-carbon" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ber-carbon">{obra.name}</p>
                    <span className="rounded-full bg-ber-gray/10 px-2 py-0.5 text-[10px] font-medium text-ber-gray">
                      {STATUS_LABELS[obra.status] || obra.status}
                    </span>
                  </div>
                  {obra.client && (
                    <p className="mt-0.5 truncate text-xs text-ber-gray">{obra.client}</p>
                  )}

                  {hasSeq ? (
                    <div className="mt-2">
                      <div className="mb-1 flex items-center justify-between text-xs text-ber-gray">
                        <span>{seq!.template?.name ?? 'Sequenciamento'} — {approved}/{totalEtapas} etapas aprovadas</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ber-gray/10">
                        <div
                          className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-green-500' : 'bg-ber-olive'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-ber-gray/60">Sem sequenciamento — clique para iniciar</p>
                  )}
                </div>

                <ChevronRight size={16} className="shrink-0 text-ber-gray" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
