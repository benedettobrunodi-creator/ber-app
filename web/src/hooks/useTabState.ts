'use client';

import { useCallback, useState } from 'react';

/**
 * Sincroniza a aba ativa com ?tab=xxx na URL, pra manter a aba após refresh
 * ou navegação pra fora e volta pela history.
 *
 * Usa History API diretamente. Ficar longe do router do Next evita race
 * condition com useSearchParams que quebrava a troca de aba.
 *
 * Uso: `const [tab, setTab] = useTabState<'a' | 'b'>('a')`
 */
export function useTabState<T extends string>(defaultTab: T, param = 'tab'): [T, (t: T) => void] {
  const [tab, setTabState] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultTab;
    const p = new URLSearchParams(window.location.search);
    return (p.get(param) as T) || defaultTab;
  });

  const setTab = useCallback((next: T) => {
    setTabState(next);
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams(window.location.search);
    if (next === defaultTab) p.delete(param);
    else p.set(param, next);
    const qs = p.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [defaultTab, param]);

  return [tab, setTab];
}
