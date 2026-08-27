'use client';

/**
 * Módulo unificado de Horas (27/08/26): Ponto · Banco de Horas · Fechamento
 * numa navegação única por abas. Cada aba mantém sua rota e permissão.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, PiggyBank, CalendarDays, Receipt, ArrowLeft } from 'lucide-react';

const TABS = [
  { href: '/ponto', label: 'Apontamento', icon: Clock },
  { href: '/banco-horas', label: 'Banco de Horas', icon: PiggyBank },
  { href: '/folha', label: 'Fechamento', icon: CalendarDays },
  { href: '/nfs', label: 'Minhas NFs', icon: Receipt },
];

export default function HorasTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-5 border-b border-ber-border">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/" className="inline-flex items-center gap-1 text-xs text-ber-gray hover:text-ber-carbon">
          <ArrowLeft size={13} /> Início
        </Link>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ber-gray">Gestão de Folha</p>
      </div>
      <nav className="flex gap-1 -mb-px overflow-x-auto">
        {TABS.map((t) => {
          const active = pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-semibold whitespace-nowrap border-b-2 transition-colors ${
                active ? 'text-ber-carbon border-ber-olive' : 'text-ber-gray border-transparent hover:text-ber-carbon'
              }`}
            >
              <Icon size={14} /> {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
