'use client';

/**
 * Confirmação própria do app (02/09/26) — substituto do window.confirm(),
 * que é BLOQUEADO em silêncio no PWA instalado/webview mobile (caso real:
 * lixeira do Close Out "não fazia nada" pro Bruno).
 *
 * Uso:
 *   import { confirmar } from '@/lib/confirmar';
 *   if (await confirmar('Excluir este item?')) { ... }
 *
 * O <ConfirmHost /> é montado uma vez no layout autenticado. Se por algum
 * motivo não estiver montado, cai no confirm() nativo como fallback.
 */

import { useEffect, useState } from 'react';

type Pedido = {
  mensagem: string;
  titulo?: string;
  confirmarLabel?: string;
  resolve: (ok: boolean) => void;
};

let enfileirar: ((p: Pedido) => void) | null = null;

export function confirmar(mensagem: string, opts?: { titulo?: string; confirmarLabel?: string }): Promise<boolean> {
  if (!enfileirar) {
    // Host não montado — fallback nativo (desktop funciona; mobile PWA é o caso raro aqui)
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(mensagem) : false);
  }
  return new Promise<boolean>((resolve) => {
    enfileirar!({ mensagem, resolve, ...opts });
  });
}

export function ConfirmHost() {
  const [fila, setFila] = useState<Pedido[]>([]);
  const atual = fila[0] ?? null;

  useEffect(() => {
    enfileirar = (p: Pedido) => setFila(prev => [...prev, p]);
    return () => { enfileirar = null; };
  }, []);

  if (!atual) return null;

  const responder = (ok: boolean) => {
    atual.resolve(ok);
    setFila(prev => prev.slice(1));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-t-2xl md:rounded-xl bg-white p-6 shadow-2xl">
        <h2 className="text-base font-bold text-ber-carbon">{atual.titulo ?? 'Confirmar'}</h2>
        <p className="mt-2 text-sm text-ber-gray">{atual.mensagem}</p>
        <div className="mt-5 flex gap-3">
          <button onClick={() => responder(false)}
            className="flex-1 rounded-md border border-ber-gray/30 px-4 py-2 text-sm font-medium text-ber-carbon hover:bg-ber-offwhite">
            Cancelar
          </button>
          <button onClick={() => responder(true)} autoFocus
            className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
            {atual.confirmarLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
