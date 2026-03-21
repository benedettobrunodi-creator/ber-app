'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard,
  HardHat,
  Clock,
  Settings,
  LogOut,
  ClipboardCheck,
  Tent,
  ShieldCheck,
  ListOrdered,
  BookOpen,
  FileText,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  subtitle?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Obras', href: '/obras', icon: HardHat },
  { label: 'Ponto', href: '/ponto', icon: Clock },
  { label: 'Sequenciamento', href: '/sequenciamento', icon: ListOrdered },
  { label: 'Checklists', href: '/checklists', icon: ClipboardCheck },
  { label: 'Canteiro', href: '/canteiro', icon: Tent },
  { label: 'Normas Técnicas', href: '/normas', icon: BookOpen },
  { label: 'Instruções Técnicas', href: '/instrucoes', icon: FileText },
  { label: 'Segurança do Trabalho', href: '/seguranca', icon: ShieldCheck },
  { label: 'Configurações', href: '/configuracoes', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, hydrate, logout } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  function handleLogout() {
    logout();
    document.cookie = 'accessToken=; path=/; max-age=0';
    router.push('/login');
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col bg-ber-carbon text-white">
        {/* Logo */}
        <div className="px-6 pt-8 pb-6">
          <h1 className="text-3xl font-black tracking-wider">BÈR</h1>
          <p className="mt-0.5 text-[10px] font-semibold tracking-[0.2em] text-ber-gray uppercase">
            Excelência Operacional
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                title={item.subtitle}
                className={`flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-ber-olive text-ber-black'
                    : 'text-ber-offwhite hover:bg-ber-teal'
                }`}
              >
                <item.icon size={18} strokeWidth={active ? 2.5 : 1.5} />
                {item.label}
              </Link>
            );
          })}

        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ber-teal text-sm font-bold uppercase">
              {user?.name?.split(' ')[0]?.charAt(0) ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="truncate text-xs text-ber-gray">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="shrink-0 rounded p-1.5 text-ber-gray transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-ber-offwhite p-8">
        {children}
      </main>
    </div>
  );
}
