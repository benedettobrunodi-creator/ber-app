'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard, HardHat, Clock, Settings, LogOut,
  ClipboardCheck, ShieldCheck, ListOrdered, BookOpen,
  FileText, Package, FolderOpen, ChevronDown, ChevronRight,
  Kanban, Menu, X,
  type LucideIcon,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Obras', href: '/obras', icon: HardHat },
  { label: 'Kanban', href: '/kanban', icon: Kanban },
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

const BOTTOM_NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Obras', href: '/obras', icon: HardHat },
  { label: 'Ponto', href: '/ponto', icon: Clock },
  { label: 'Kanban', href: '/kanban', icon: Kanban },
  { label: 'Config', href: '/configuracoes', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, hydrate, logout } = useAuthStore();
  const [pmoOpen, setPmoOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => { if (pathname.startsWith('/pmo') || pathname.startsWith('/canteiro')) setPmoOpen(true); }, [pathname]);
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  function handleLogout() {
    logout();
    document.cookie = 'accessToken=; path=/; max-age=0';
    router.push('/login');
  }

  if (!isAuthenticated) return null;

  const sidebarContent = (
    <>
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-wider">BÈR</h1>
            <p className="mt-0.5 text-[10px] font-semibold tracking-[0.2em] text-ber-gray uppercase">Excelência Operacional</p>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ber-gray hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
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
                  className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 min-h-[44px] text-sm font-medium transition-colors ${active || pmoOpen ? 'bg-ber-olive text-white' : 'text-ber-gray hover:bg-white/10 hover:text-white'}`}
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
                        className={`block rounded-lg px-3 py-2.5 min-h-[44px] flex items-center text-xs transition-colors ${pathname.startsWith(child.href) ? 'bg-white/20 text-white' : 'text-ber-gray hover:bg-white/10 hover:text-white'}`}>
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
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 min-h-[44px] text-sm font-medium transition-colors ${active ? 'bg-ber-olive text-white' : 'text-ber-gray hover:bg-white/10 hover:text-white'}`}>
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
          <button onClick={handleLogout} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-ber-gray hover:text-white transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-dvh flex-col">
      {/* Top header — always visible */}
      <header className="flex h-14 shrink-0 items-center justify-between bg-ber-carbon px-4">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-white"
        >
          <Menu size={22} />
        </button>
        <h1 className="text-xl font-black tracking-wider text-white">BÈR</h1>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ber-olive text-white text-xs font-bold">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
        </div>
      </header>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Sidebar — always drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-ber-carbon text-white transition-transform duration-300 ease-in-out ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {sidebarContent}
      </aside>

      {/* Main content — padded for bottom nav on mobile */}
      <main className="flex-1 overflow-auto bg-[var(--ber-offwhite)] pb-20 md:pb-0">
        {children}
      </main>

      {/* Bottom navigation — mobile only */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-ber-gray/20 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {BOTTOM_NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[10px] font-medium transition-colors ${active ? 'text-ber-olive' : 'text-ber-gray'}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
