'use client';

import { useCallback, useState, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

/**
 * Sincroniza a aba ativa com ?tab=xxx na URL, pra manter a aba após refresh
 * ou navegação pra fora e volta pela history.
 *
 * Uso: `const [tab, setTab] = useTabState<'a' | 'b'>('a')`
 */
export function useTabState<T extends string>(defaultTab: T, param = 'tab'): [T, (t: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const initial = (sp.get(param) as T) || defaultTab;
  const [tab, setTabInternal] = useState<T>(initial);

  useEffect(() => {
    const current = sp.get(param) as T | null;
    if (current && current !== tab) setTabInternal(current);
  }, [sp, param, tab]);

  const setTab = useCallback((next: T) => {
    setTabInternal(next);
    const params = new URLSearchParams(sp.toString());
    if (next === defaultTab) params.delete(param);
    else params.set(param, next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, sp, param, defaultTab]);

  return [tab, setTab];
}
