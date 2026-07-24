'use client';

/**
 * Capa da Obra — página dedicada (imprime em A4 paisagem).
 *
 * O conteúdo vive em `@/components/obras/CapaObra`, compartilhado com a aba
 * inicial da obra em `/obras/[id]`. Aqui só a casca de rota.
 */

import { useParams } from 'next/navigation';
import CapaObra from '@/components/obras/CapaObra';

export default function CapaObraPage() {
  const params = useParams<{ id: string }>();
  return <CapaObra obraId={params.id} />;
}
