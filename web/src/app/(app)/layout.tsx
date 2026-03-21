'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard, HardHat, Clock, Settings, LogOut,
  ClipboardCheck, ShieldCheck, ListOrdered, BookOpen,
  FileText, Package, FolderOpen, ChevronDown, ChevronRight,
  type LucideIcon,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Obras', href: '/obras', icon: HardHat },
  { label: 'Recebimentos', href: '/recebimentos', icon: Package },
  { label: 'Sequenciamento', href: '/sequenciamento', icon: ListOrdered },
  { label: 'Checklists', href: '/checklists', icon: ClipboardCheck },
  { label: 'PMO', href: '/pmo', icon: FolderOpen, children: [
    { label: 'Canteiro', href: '/canteiro' },
    { label: 'Atas de Reunião', href: '/pmo/atas' },
    { label: 'Projetos', href: '/pmo/projetos' },
    { label: 'Documentos', href: '/pmo/documentos' },
    { label: 'Rel. de Vistoria', href: '/pmo/vistorias' },
    { label: 'Aprov. Amostras', href: '/pmo/amostras' },
    { label: 'Shopdrawings', href: '/pmo/shopdrawings' },
    { label: 'As Builts', href: '/pmo/as-builts' },
    { label: 'Manual Proprietário', href: '/pmo/manual' },
  ]},
  { label: 'Normas Técnicas', href: '/normas', icon: BookOpen },
  { label: 'Instruções Técnicas', href: '/instrucoes', icon: FileText },
  { label: 'Segurança do Trabalho', href: '/seguranca', icon: ShieldCheck },
  { label: 'Registro de Ponto', href: '/ponto', icon: Clock },
  { label: 'Configurações', href: '/configuracoes', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, hydrate, logout } = useAuthStore();
  const [pmoOpen, setPmoOpen] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => { if (pathname.startsWith('/pmo') || pathname.startsWith('/canteiro')) setPmoOpen(true); }, [pathname]);

  function handleLogout() {
    logout();
    document.cookie = 'accessToken=; path=/; max-age=0';
    router.push('/login');
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col bg-ber-carbon text-white">
        <div className="px-6 pt-8 pb-6">
          <h1 className="text-3xl font-black tracking-wider">BÈR</h1>
          <p className="mt-0.5 text-[10px] font-semibold tracking-[0.2em] text-ber-gray uppercase">Excelência Operacional</p>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto pb-4">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon as LucideIcon;
            const active = pathname.startsWith(item.href);

            if (item.children) {
              return (
                <div key={item.label}>
                  <button
                    onClick={() => setPmoOpen(o => !o)}
                    className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active || pmoOpen ? 'bg-ber-olive text-white' : 'text-ber-gray hover:bg-white/10 hover:text-white'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </div>
                    {pmoOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {pmoOpen && (
                    <div className="ml-6 mt-0.5 space-y-0.5">
                      {item.children.map(child => (
                        <Link key={child.href} href={child.href}
                          className={`block rounded-lg px-3 py-1.5 text-xs transition-colors ${pathname.startsWith(child.href) ? 'bg-white/20 text-white' : 'text-ber-gray hover:bg-white/10 hover:text-white'}`}>
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <Link key={item.label} href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? 'bg-ber-olive text-white' : 'text-ber-gray hover:bg-white/10 hover:text-white'}`}>
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ber-olive text-white text-sm font-bold">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-ber-gray truncate">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="text-ber-gray hover:text-white transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-[var(--ber-offwhite)]">
        {children}
      </main>
    </div>
  );
}
