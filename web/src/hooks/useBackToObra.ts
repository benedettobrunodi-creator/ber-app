'use client';

import { useParams } from 'next/navigation';

/**
 * Retorna o href do botão "← voltar pra obra".
 *
 * Antes desviava pro Gestão 360 quando a URL trazia `?from=gestao-360`.
 * O 360 saiu, então volta sempre pra home da obra — o `?from=` que ainda
 * apareça em link antigo é simplesmente ignorado.
 */
export function useBackToObra(): string {
  const params = useParams<{ id: string }>();
  return `/obras/${params.id}`;
}
