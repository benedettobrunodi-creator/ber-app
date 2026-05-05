'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStore, getUserPermissions } from '@/stores/authStore';
import { usePeriodStore } from '@/stores/periodStore';
import api from '@/lib/api';
import {
  LayoutDashboard, HardHat, Clock, Settings, LogOut,
  ClipboardCheck, ShieldCheck, ListOrdered, BookOpen,
  FileText, Package, FolderOpen, ChevronDown, ChevronRight,
  Kanban, Menu, X, TrendingUp, CalendarRange, BarChart2,
  type LucideIcon,
} from 'lucide-react';

/* ─── Sidebar navigation — grouped by section ─── */

interface NavChild { label: string; href: string }
interface NavItem {
  label: string; href: string; icon: LucideIcon;
  perm?: string;            // permission key from customRole.permissions
  children?: NavChild[];
  badge?: boolean;          // will show dynamic count
}
interface NavGroup { section: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    section: 'OBRAS',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, perm: 'dashboard' },
      { label: 'Obras', href: '/obras', icon: HardHat, badge: true, perm: 'obras' },
      { label: 'Painel de Gestão', href: '/kanban', icon: Kanban, perm: 'kanban' },
      { label: 'Sequenciamento', href: '/sequenciamento', icon: ListOrdered, perm: 'sequenciamento' },
    ],
  },
  {
    section: 'GESTÃO',
    items: [
      { label: 'Checklists', href: '/checklists', icon: ClipboardCheck, badge: true, perm: 'checklists' },
      { label: 'Alocação', href: '/alocacao', icon: CalendarRange, perm: 'configuracoes' },
      { label: 'Recebimentos', href: '/recebimentos', icon: Package, badge: true, perm: 'recebimentos' },
      { label: 'PMO', href: '/pmo', icon: FolderOpen, perm: 'pmo', children: [
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
      { label: 'Segurança', href: '/seguranca', icon: ShieldCheck, perm: 'seguranca' },
    ],
  },
  {
    section: 'REFERÊNCIA',
    items: [
      { label: 'Normas Técnicas', href: '/normas', icon: BookOpen, perm: 'normas' },
      { label: 'Instruções Técnicas', href: '/instrucoes', icon: FileText, perm: 'instrucoes' },
    ],
  },
  {
    section: 'COMERCIAL',
    items: [
      { label: 'Esteira de Orçamentos', href: '/comercial/orcamentos', icon: BarChart2, perm: 'orcamentos' },
    ],
  },
  {
    section: 'FINANCEIRO',
    items: [
      { label: 'Apontamento de Horas', href: '/ponto', icon: Clock, perm: 'ponto' },
      { label: 'DRE', href: '/dre', icon: TrendingUp, perm: 'dre' },
    ],
  },
  {
    section: 'ADMIN',
    items: [
      { label: 'Usuarios', href: '/configuracoes/usuarios', icon: Settings, perm: 'configuracoes' },
      { label: 'Configuracoes', href: '/configuracoes', icon: Settings, perm: 'configuracoes' },
    ],
  },
];

/* ─── Top bar views (horizontal nav) ─── */

const TOP_VIEWS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Obras', href: '/obras' },
  { label: 'Painel', href: '/kanban' },
  { label: 'Checklists', href: '/checklists' },
  { label: 'DRE', href: '/dre' },
];

/* ─── Route → permission map for access guard ─── */

const ROUTE_PERMS: Array<{ prefix: string; perm: string }> = [
  { prefix: '/dashboard', perm: 'dashboard' },
  { prefix: '/obras', perm: 'obras' },
  { prefix: '/kanban', perm: 'kanban' },
  { prefix: '/sequenciamento', perm: 'sequenciamento' },
  { prefix: '/checklists', perm: 'checklists' },
  { prefix: '/alocacao', perm: 'configuracoes' },
  { prefix: '/recebimentos', perm: 'recebimentos' },
  { prefix: '/pmo', perm: 'pmo' },
  { prefix: '/canteiro', perm: 'pmo' },
  { prefix: '/seguranca', perm: 'seguranca' },
  { prefix: '/normas', perm: 'normas' },
  { prefix: '/instrucoes', perm: 'instrucoes' },
  { prefix: '/ponto', perm: 'ponto' },
  { prefix: '/dre', perm: 'dre' },
  { prefix: '/configuracoes', perm: 'configuracoes' },
  { prefix: '/comercial/orcamentos', perm: 'orcamentos' },
];

/* ─── Bottom mobile nav ─── */

const BOTTOM_NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Obras', href: '/obras', icon: HardHat },
  { label: 'Apontamento', href: '/ponto', icon: Clock },
  { label: 'Painel', href: '/kanban', icon: Kanban },
  { label: 'Config', href: '/configuracoes', icon: Settings },
];

/* ─── Badge dot helper ─── */

function StatusDot({ count }: { count: number | null }) {
  if (count === null) return null;
  const color = count === 0 ? 'bg-ber-green' : count <= 3 ? 'bg-ber-amber' : 'bg-ber-red';
  return (
    <span className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${color}`}>
      {count}
    </span>
  );
}

/* ─── Component ─── */

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, hydrate, logout } = useAuthStore();
  const perms = getUserPermissions(user);
  const { period, setPeriod, label: periodLabel } = usePeriodStore();
  const [pmoOpen, setPmoOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [kpi, setKpi] = useState<{ ativas: number; total: number; atrasadas: number } | null>(null);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => { if (pathname.startsWith('/pmo') || pathname.startsWith('/canteiro')) setPmoOpen(true); }, [pathname]);
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Route-level access guard — redirect if user lacks permission for current path
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const match = ROUTE_PERMS.find(r => pathname.startsWith(r.prefix));
    if (match && !perms[match.perm]) {
      const fallback = ROUTE_PERMS.find(r => perms[r.perm]);
      router.replace(fallback?.prefix ?? '/ponto');
    }
  }, [pathname, isAuthenticated, user]);

  // Fetch badge counts + KPI global
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchCounts = async () => {
      try {
        const r = await api.get('/obras/counts');
        const { total = 0, ativas = 0, atrasadas = 0 } = r.data?.data ?? {};
        setCounts({ '/obras': ativas });
        setKpi({ ativas, total, atrasadas });
      } catch { /* silent */ }
    };
    fetchCounts();
  }, [isAuthenticated]);

  function handleLogout() {
    logout();
    document.cookie = 'accessToken=; path=/; max-age=0';
    router.push('/login');
  }

  if (!isAuthenticated) return null;

  /* ─── Sidebar content ─── */
  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-wider text-white">BÈR</h1>
            <p className="mt-0.5 text-[10px] font-semibold tracking-[0.2em] text-gray-500 uppercase">Excelência Operacional</p>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Nav groups — filtered by user permissions */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map(g => ({
          ...g,
          items: g.items.filter(item => !item.perm || perms[item.perm]),
        })).filter(g => g.items.length > 0).map((group) => (
          <div key={group.section} className="mb-4">
            <p className="mb-1 px-3 text-[10px] font-bold tracking-[0.15em] text-gray-500 uppercase">
              {group.section}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname.startsWith(item.href);

                /* Collapsible group (PMO) */
                if (item.children) {
                  return (
                    <div key={item.label}>
                      <button
                        onClick={() => setPmoOpen(o => !o)}
                        className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 min-h-[44px] text-sm font-medium transition-colors ${
                          active || pmoOpen
                            ? 'bg-ber-olive/20 text-ber-olive'
                            : 'text-gray-400 hover:bg-ber-sidebar-hover hover:text-white'
                        }`}
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
                              className={`block rounded-lg px-3 py-2.5 min-h-[44px] flex items-center text-xs transition-colors ${
                                pathname.startsWith(child.href)
                                  ? 'bg-ber-olive/20 text-ber-olive'
                                  : 'text-gray-500 hover:bg-ber-sidebar-hover hover:text-white'
                              }`}>
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                /* Regular nav item */
                return (
                  <Link key={item.label} href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 min-h-[44px] text-sm font-medium transition-colors ${
                      active
                        ? 'bg-ber-olive/20 text-ber-olive'
                        : 'text-gray-400 hover:bg-ber-sidebar-hover hover:text-white'
                    }`}>
                    <Icon size={16} />
                    <span>{item.label}</span>
                    {item.badge && <StatusDot count={counts[item.href] ?? null} />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ber-olive text-white text-sm font-bold">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.role}</p>
          </div>
          <button onClick={handleLogout} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-white transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-dvh flex-col bg-ber-bg">
      {/* ─── Top header ─── */}
      <header className="flex h-14 shrink-0 items-center justify-between bg-ber-sidebar px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-white"
          >
            <Menu size={22} />
          </button>
          <h1 className="text-xl font-black tracking-wider text-white hidden sm:block">BÈR</h1>
        </div>

        {/* ─── Top bar views (desktop) — filtered by permissions ─── */}
        <nav className="hidden md:flex items-center gap-1">
          {TOP_VIEWS.filter(v => {
            const permKey = v.href.replace('/', '');
            return perms[permKey];
          }).map((view) => {
            const active = pathname.startsWith(view.href);
            return (
              <Link
                key={view.href}
                href={view.href}
                className={`rounded-md px-3 py-1.5 text-xs font-bold tracking-wide uppercase transition-colors ${
                  active
                    ? 'bg-ber-olive text-white'
                    : 'text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {view.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="rounded-md bg-white/10 px-2 py-1 text-xs font-bold text-white border border-white/20 focus:outline-none focus:border-ber-olive cursor-pointer"
          >
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - 6 + i);
              const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
              const lbl = `${MONTHS[d.getMonth()]}/${d.getFullYear().toString().slice(2)}`;
              return <option key={val} value={val} className="bg-ber-sidebar text-white">{lbl}</option>;
            })}
          </select>

          {/* KPI Global */}
          {kpi && (
            <div className="hidden sm:flex items-center gap-2 rounded-lg px-3 py-1.5 bg-white/10">
              <span className={`text-lg font-black ${
                kpi.atrasadas > 0 ? 'text-ber-red' : kpi.ativas > 0 ? 'text-ber-green' : 'text-gray-400'
              }`}>
                {kpi.ativas - kpi.atrasadas}/{kpi.ativas}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Obras em dia
              </span>
            </div>
          )}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ber-olive text-white text-xs font-bold">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
        </div>
      </header>

      {/* ─── Drawer overlay ─── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ─── Sidebar drawer ─── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-ber-sidebar text-white transition-transform duration-300 ease-in-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* ─── Main content ─── */}
      <main className="flex-1 overflow-auto bg-ber-bg pb-20 md:pb-0">
        {children}
      </main>

      {/* ─── Bottom navigation — mobile only ─── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-ber-border bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {BOTTOM_NAV.filter(item => {
          const permKey = item.href === '/configuracoes' ? 'configuracoes' : item.href.replace('/', '');
          return perms[permKey] !== false;
        }).map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[10px] font-medium transition-colors ${
                active ? 'text-ber-olive' : 'text-ber-gray'
              }`}
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
