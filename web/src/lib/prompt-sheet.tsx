'use client';

/**
 * Substituto do window.prompt (bloqueado em PWA — auditoria 11/09).
 * Uso: const valor = await pedirTexto('E-mail do cliente', { placeholder, valorInicial, tipo: 'email' });
 * Resolve com a string ou null (cancelou). Mesmo padrão do confirmar().
 */

import { useEffect, useState } from 'react';

interface Pedido {
  titulo: string;
  placeholder?: string;
  valorInicial?: string;
  tipo?: 'text' | 'email';
  resolve: (v: string | null) => void;
}

let abrir: ((p: Pedido) => void) | null = null;

export function pedirTexto(titulo: string, opts: { placeholder?: string; valorInicial?: string; tipo?: 'text' | 'email' } = {}): Promise<string | null> {
  return new Promise((resolve) => {
    if (!abrir) { resolve(window.prompt(titulo) ?? null); return; } // fallback fora do host
    abrir({ titulo, ...opts, resolve });
  });
}

export function PromptHost() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [valor, setValor] = useState('');
  useEffect(() => {
    abrir = (p) => { setPedido(p); setValor(p.valorInicial ?? ''); };
    return () => { abrir = null; };
  }, []);
  if (!pedido) return null;
  const fechar = (v: string | null) => { pedido.resolve(v); setPedido(null); };
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 md:items-center" onClick={() => fechar(null)}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 text-sm font-bold text-ber-carbon">{pedido.titulo}</p>
        <input autoFocus type={pedido.tipo ?? 'text'} value={valor} onChange={(e) => setValor(e.target.value)}
          placeholder={pedido.placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter' && valor.trim()) fechar(valor.trim()); }}
          className="w-full rounded-lg border border-ber-border px-3 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-ber-teal" />
        <div className="mt-4 flex gap-2">
          <button onClick={() => fechar(valor.trim() || null)} disabled={!valor.trim()}
            className="min-h-[44px] flex-1 rounded-lg bg-ber-olive text-sm font-semibold text-ber-carbon hover:brightness-95 disabled:opacity-50">Confirmar</button>
          <button onClick={() => fechar(null)}
            className="min-h-[44px] rounded-lg border border-ber-border px-4 text-sm text-ber-carbon hover:bg-ber-surface">Cancelar</button>
        </div>
      </div>
    </div>
  );
}
