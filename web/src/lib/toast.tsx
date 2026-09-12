'use client';

/**
 * Toast minimalista do BER App (auditoria mobile 11/09): substitui os alert()
 * nativos, que em PWA instalado são suprimidos ou renderizam fora de contexto.
 * Uso: toast('Salvo ✓') · toast('Não salvou', 'erro') — de qualquer módulo.
 */

import { useEffect, useState } from 'react';

type Tipo = 'ok' | 'erro' | 'aviso';
interface Item { id: number; texto: string; tipo: Tipo }

export function toast(texto: string, tipo: Tipo = 'ok') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('ber-toast', { detail: { texto, tipo } }));
}

const COR: Record<Tipo, string> = {
  ok: 'bg-ber-carbon text-white',
  erro: 'bg-red-700 text-white',
  aviso: 'bg-amber-500 text-ber-carbon',
};

export function ToastHost() {
  const [itens, setItens] = useState<Item[]>([]);
  useEffect(() => {
    let seq = 1;
    const ouvir = (e: Event) => {
      const { texto, tipo } = (e as CustomEvent).detail as { texto: string; tipo: Tipo };
      const id = seq++;
      setItens((prev) => [...prev.slice(-2), { id, texto, tipo }]);
      setTimeout(() => setItens((prev) => prev.filter((i) => i.id !== id)), tipo === 'erro' ? 6000 : 3500);
    };
    window.addEventListener('ber-toast', ouvir);
    return () => window.removeEventListener('ber-toast', ouvir);
  }, []);
  if (itens.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {itens.map((i) => (
        <div key={i.id} className={`pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${COR[i.tipo]}`}
          onClick={() => setItens((prev) => prev.filter((x) => x.id !== i.id))}>
          {i.texto}
        </div>
      ))}
    </div>
  );
}
