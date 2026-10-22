'use client';

/**
 * Seletor de tema (pedido do Colman, aprovado pelo Bruno 22/10):
 * claro → escuro → automático (segue o sistema). Escolha fica no aparelho
 * (localStorage); impressão/PDF sempre saem claros (CSS cuida).
 */
import { useEffect, useState } from 'react';
import { Sun, Moon, MonitorSmartphone } from 'lucide-react';

type Tema = 'light' | 'dark' | 'auto';
const ORDEM: Tema[] = ['light', 'dark', 'auto'];
const ROTULO: Record<Tema, string> = { light: 'Tema claro', dark: 'Tema escuro', auto: 'Tema automático' };

function aplicar(t: Tema) {
  const efetivo = t === 'auto'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : t;
  document.documentElement.dataset.theme = efetivo;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [tema, setTema] = useState<Tema>('light');
  useEffect(() => {
    try {
      const salvo = (localStorage.getItem('ber-theme') as Tema) || 'light';
      setTema(salvo);
      aplicar(salvo);
    } catch { /* sem storage: fica no claro */ }
    // no automático, acompanha o sistema ao vivo
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = () => {
      try { if ((localStorage.getItem('ber-theme') as Tema) === 'auto') aplicar('auto'); } catch { /* ok */ }
    };
    mq.addEventListener?.('change', aoMudar);
    return () => mq.removeEventListener?.('change', aoMudar);
  }, []);
  const ciclar = () => {
    const prox = ORDEM[(ORDEM.indexOf(tema) + 1) % ORDEM.length];
    setTema(prox);
    try { localStorage.setItem('ber-theme', prox); } catch { /* ok */ }
    aplicar(prox);
  };
  const Icone = tema === 'dark' ? Moon : tema === 'auto' ? MonitorSmartphone : Sun;
  return (
    <button
      onClick={ciclar}
      title={`${ROTULO[tema]} — clique para trocar`}
      aria-label={`${ROTULO[tema]} — clique para trocar`}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-gray-300 hover:bg-ber-sidebar-hover"
    >
      <Icone size={16} />
      {!compact && <span>{ROTULO[tema].replace('Tema ', '')}</span>}
    </button>
  );
}
