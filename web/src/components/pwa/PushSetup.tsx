'use client';

/**
 * Inscrição nos alertas push do PWA (11/09/26). Comportamento:
 * - permissão já concedida → garante a inscrição em silêncio
 * - permissão 'default' → banner discreto no mobile pedindo pra ativar
 * - negada/sem suporte → não incomoda
 */

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { toast } from '@/lib/toast';

function b64ParaUint8(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function inscrever(): Promise<boolean> {
  const reg = await navigator.serviceWorker.ready;
  const r = await api.get('/push/chave-publica');
  const chave: string | null = r.data?.data?.chave ?? null;
  if (!chave) return false;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ParaUint8(chave) });
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await api.post('/push/inscrever', { endpoint: json.endpoint, keys: json.keys });
  return true;
}

export function PushSetup() {
  const [mostrarBanner, setMostrarBanner] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (localStorage.getItem('push-banner-dispensado') === '1') { if (Notification.permission === 'granted') void inscrever().catch(() => {}); return; }
    if (Notification.permission === 'granted') { void inscrever().catch(() => {}); return; }
    if (Notification.permission === 'default') setMostrarBanner(true);
  }, []);

  if (!mostrarBanner) return null;
  return (
    <div className="fixed inset-x-4 bottom-20 z-[60] flex items-center justify-between gap-3 rounded-xl bg-ber-carbon px-4 py-3 text-white shadow-lg md:bottom-6 md:left-auto md:right-6 md:w-96">
      <p className="text-sm">Ativar alertas no celular? (pendências, vistorias críticas)</p>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={async () => {
            setMostrarBanner(false);
            try {
              const perm = await Notification.requestPermission();
              if (perm === 'granted') { await inscrever(); toast('Alertas ativados neste aparelho ✓'); }
            } catch { toast('Não consegui ativar os alertas', 'erro'); }
          }}
          className="min-h-[40px] rounded-lg bg-ber-olive px-3 text-sm font-semibold text-ber-carbon">Ativar</button>
        <button
          onClick={() => { localStorage.setItem('push-banner-dispensado', '1'); setMostrarBanner(false); }}
          className="min-h-[40px] rounded-lg px-2 text-sm text-white/70">Agora não</button>
      </div>
    </div>
  );
}
