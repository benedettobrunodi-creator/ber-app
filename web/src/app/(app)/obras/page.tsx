'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Plus, MapPin, Calendar, User, HardHat } from 'lucide-react';
import NovaObraModal from '@/components/obras/NovaObraModal';

type ObraStatus = 'planejamento' | 'em_andamento' | 'pausada' | 'concluida';

interface Obra {
  id: string;
  name: string;
  client: string | null;
  address: string | null;
  status: ObraStatus;
  progressPercent: number;
  startDate: string | null;
  expectedEndDate: string | null;
  coordinator: { id: string; name: string; avatarUrl: string | null } | null;
  _count: { members: number; tasks: number };
}

const STATUS_CONFIG: Record<ObraStatus, { label: string; className: string }> = {
  planejamento: { label: 'Planejamento', className: 'bg-ber-gray/15 text-ber-gray' },
  em_andamento: { label: 'Em andamento', className: 'bg-ber-teal/15 text-ber-teal' },
  pausada: { label: 'Pausada', className: 'bg-amber-100 text-amber-700' },
  concluida: { label: 'Concluída', className: 'bg-ber-olive/15 text-ber-olive' },
};

const FILTERS: { label: string; value: string }[] = [
  { label: 'Todas', value: '' },
  { label: 'Em andamento', value: 'em_andamento' },
  { label: 'Concluídas', value: 'concluida' },
  { label: 'Pausadas', value: 'pausada' },
];

function formatDate(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ObrasPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  async function fetchObras() {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 100 };
      if (filter) params.status = filter;
      const res = await api.get('/obras', { params });
      setObras(res.data.data);
    } catch {
      /* handled by interceptor */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchObras();
  }, [filter]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-ber-carbon">Obras</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-md bg-ber-carbon px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ber-black"
        >
          <Plus size={16} />
          Nova Obra
        </button>
      </div>

      {/* Filters */}
      <div className="mt-5 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-ber-carbon text-white'
                : 'bg-white text-ber-carbon hover:bg-ber-gray/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="mt-12 text-center text-sm text-ber-gray">Carregando...</div>
      ) : obras.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <HardHat size={48} className="text-ber-gray/40" />
          <p className="mt-4 text-sm font-medium text-ber-gray">
            Nenhuma obra encontrada
          </p>
          <p className="mt-1 text-xs text-ber-gray/70">
            Clique em "Nova Obra" para cadastrar a primeira.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {obras.map((obra) => {
            const statusCfg = STATUS_CONFIG[obra.status] ?? STATUS_CONFIG.planejamento;
            return (
              <Link
                key={obra.id}
                href={`/obras/${obra.id}`}
                className="group rounded-lg border border-ber-offwhite bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-sm font-bold text-ber-carbon group-hover:text-ber-teal">
                    {obra.name}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusCfg.className}`}
                  >
                    {statusCfg.label}
                  </span>
                </div>

                {obra.client && (
                  <p className="mt-2 text-xs text-ber-gray">{obra.client}</p>
                )}

                {obra.address && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-ber-gray">
                    <MapPin size={12} />
                    <span className="truncate">{obra.address}</span>
                  </div>
                )}

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-ber-carbon">Progresso</span>
                    <span className="font-bold text-ber-olive">{obra.progressPercent}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-ber-offwhite">
                    <div
                      className="h-full rounded-full bg-ber-olive transition-all"
                      style={{ width: `${obra.progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Footer info */}
                <div className="mt-4 flex items-center gap-4 border-t border-ber-offwhite pt-3 text-xs text-ber-gray">
                  {obra.coordinator && (
                    <div className="flex items-center gap-1.5">
                      <User size={12} />
                      <span>{obra.coordinator.name}</span>
                    </div>
                  )}
                  {obra.expectedEndDate && (
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} />
                      <span>{formatDate(obra.expectedEndDate)}</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <NovaObraModal
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false);
            fetchObras();
          }}
        />
      )}
    </div>
  );
}
