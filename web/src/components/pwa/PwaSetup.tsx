'use client';

import { useEffect } from 'react';

/** Registra o service worker do PWA (11/09/26). Silencioso: falha não afeta o app. */
export function PwaSetup() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => { /* sem SW, app segue normal */ });
  }, []);
  return null;
}
