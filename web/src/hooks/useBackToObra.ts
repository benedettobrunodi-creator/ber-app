'use client';

import { useParams, useSearchParams } from 'next/navigation';

/**
 * Retorna o href do botão "← voltar pra obra" considerando de onde o user veio.
 * Se a URL tem `?from=gestao-360`, volta pro cockpit 360 em vez da home da obra.
 *
 * Uso:
 *   const backHref = useBackToObra();
 *   <Link href={backHref}>...</Link>
 */
export function useBackToObra(): string {
  const params = useParams<{ id: string }>();
  const sp = useSearchParams();
  const obraId = params.id;
  if (sp.get('from') === 'gestao-360') return `/obras/${obraId}/gestao-360`;
  return `/obras/${obraId}`;
}
