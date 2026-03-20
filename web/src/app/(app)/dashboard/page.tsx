'use client';

import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { useEffect, useState } from 'react';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

interface DashboardCounts {
  obrasAtivas: number | null;
  equipe: number | null;
  checklistsPendentes: number | null;
  naoConformidades: number | null;
}

export default function DashboardPage() {
  const { user, hydrate } = useAuthStore();
  const [counts, setCounts] = useState<DashboardCounts>({
    obrasAtivas: null,
    equipe: null,
    checklistsPendentes: null,
    naoConformidades: null,
  });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    async function fetchCounts() {
      const [obras, equipe] = await Promise.allSettled([
        api.get('/obras', { params: { limit: 1, status: 'em_andamento' } }),
        api.get('/users', { params: { limit: 1 } }),
      ]);

      // Fetch all checklists across all obras to count pending + non-conformities
      let checklistsPendentes = 0;
      let naoConformidades = 0;

      try {
        // Get active obras first to find their checklists
        const obrasRes = await api.get('/obras', { params: { limit: 100, status: 'em_andamento' } });
        const obrasData = obrasRes.data.data || [];

        const checklistPromises = obrasData.map((o: { id: string }) =>
          api.get(`/obras/${o.id}/checklists`).catch(() => ({ data: { data: [] } })),
        );
        const checklistResults = await Promise.all(checklistPromises);

        for (const res of checklistResults) {
          const checklists = res.data.data || [];
          for (const cl of checklists) {
            if (cl.status === 'em_andamento') {
              checklistsPendentes++;
            }
            const items = cl.items || [];
            naoConformidades += items.filter((i: { answer: string | null }) => i.answer === 'nao').length;
          }
        }
      } catch {
        // Silently ignore — counts will show 0
      }

      setCounts({
        obrasAtivas:
          obras.status === 'fulfilled'
            ? obras.value.data.pagination.total
            : null,
        equipe:
          equipe.status === 'fulfilled'
            ? equipe.value.data.pagination.total
            : null,
        checklistsPendentes,
        naoConformidades,
      });
    }

    fetchCounts();
  }, []);

  const firstName = user?.name?.split(' ')[0] ?? '';

  const cards = [
    { label: 'Obras Ativas', value: counts.obrasAtivas },
    { label: 'Equipe', value: counts.equipe },
    { label: 'Checklists Pendentes', value: counts.checklistsPendentes },
    { label: 'Não Conformidades', value: counts.naoConformidades, highlight: true },
  ];

  return (
    <div>
      <h1 className="text-2xl font-black text-ber-carbon">
        {getGreeting()}, {firstName}
      </h1>
      <p className="mt-1 text-sm text-ber-gray">
        Resumo geral do sistema
      </p>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-ber-offwhite bg-white p-6 shadow-sm"
          >
            <p className={`text-3xl font-black ${card.highlight && card.value ? 'text-red-500' : 'text-ber-olive'}`}>
              {card.value !== null ? card.value : '--'}
            </p>
            <p className="mt-2 text-sm font-medium text-ber-gray">
              {card.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
