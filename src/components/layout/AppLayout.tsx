import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Building2,
  FileText,
  FolderKanban,
  House,
  LogOut,
  Plus,
  Settings,
  Truck,
  X,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { buttonClass } from '../ui/Button';

const NAV = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban, end: false },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, end: false },
  { to: '/reports', label: 'Reports', icon: BarChart3, end: false },
  { to: '/settings', label: 'Settings', icon: Settings, end: false },
];

export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`flex size-8 items-center justify-center rounded-lg ${onDark ? 'bg-white text-navy-900' : 'bg-navy-800 text-white'}`}>
        <Building2 className="size-5" aria-hidden />
      </span>
      <span className={`text-lg font-bold tracking-tight ${onDark ? 'text-white' : 'text-slate-900'}`}>BuildLedger</span>
    </span>
  );
}

// Quiet outlined buttons so they sit on the navy sidebar without competing with it.
const QUICK_ADD =
  'flex w-full items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition-colors hover:border-white/25 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-300';

function NavSection({ children }: { children: string }) {
  return <p className="px-3 pt-4 pb-2 text-xs font-semibold tracking-[0.18em] text-navy-300 uppercase">{children}</p>;
}

export function AppLayout() {
  const { session, logout } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  if (!session) return null;

  const initials = session.user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-navy-900 text-white lg:flex print:hidden">
        <div className="border-b border-white/10 px-5 py-5">
          <Logo onDark />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
          <NavSection>Main</NavSection>
          <div className="space-y-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/12 font-semibold text-white' : 'text-navy-100 hover:bg-white/6 hover:text-white'
                  }`
                }
              >
                <item.icon className="size-5" aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </div>

          <NavSection>Quick add</NavSection>
          <div className="space-y-2">
            <Link to="/payments/new" className={QUICK_ADD}>
              <span className="flex size-7 items-center justify-center rounded-lg bg-sky-400/20 text-sky-200">
                <ArrowDownLeft className="size-4" aria-hidden />
              </span>
              Money received
            </Link>
            <Link to="/expenses/new" className={QUICK_ADD}>
              <span className="flex size-7 items-center justify-center rounded-lg bg-white/10 text-navy-100">
                <ArrowUpRight className="size-4" aria-hidden />
              </span>
              Add expense
            </Link>
          </div>
        </nav>

        <div className="border-t border-white/10 px-5 py-3">
          <p className="text-xs text-navy-300">Your company</p>
          <p className="truncate text-sm font-semibold text-white">{session.company.name}</p>
        </div>

        <div className="flex items-center gap-2.5 border-t border-white/10 p-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{session.user.name}</p>
            <p className="text-xs text-navy-200 capitalize">{session.user.role}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-navy-100 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" aria-hidden /> Log out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-navy-900 px-4 py-3 text-white lg:hidden print:hidden">
        <Logo onDark />
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-navy-100">{session.company.name}</span>
          <NavLink to="/settings" aria-label="Settings" className="rounded-lg p-1.5 text-navy-100 hover:bg-white/10">
            <Settings className="size-5" aria-hidden />
          </NavLink>
        </span>
      </header>

      <main className="lg:pl-60 print:pl-0">
        <div className="mx-auto max-w-6xl px-4 pt-5 pb-28 lg:px-8 lg:pt-6 lg:pb-10">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
      >
        <div className="grid grid-cols-5">
          {NAV.slice(0, 2).map((item) => (
            <MobileNavLink key={item.to} {...item} />
          ))}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex flex-col items-center justify-center gap-1 py-2 text-xs font-semibold text-navy-900"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-navy-800 text-white shadow-md">
              <Plus className="size-6" aria-hidden />
            </span>
            Add
          </button>
          <MobileNavLink {...NAV[2]} />
          <MobileNavLink {...NAV[3]} />
        </div>
      </nav>

      {addOpen && <AddSheet onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function MobileNavLink({ to, label, icon: Icon, end }: (typeof NAV)[number]) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold ${
          isActive ? 'text-navy-900' : 'text-slate-600'
        }`
      }
    >
      <Icon className="size-6" aria-hidden />
      {label}
    </NavLink>
  );
}

/** Mobile bottom sheet: the things people add most, as giant buttons. */
function AddSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-slate-900/50 lg:hidden" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="What do you want to add?"
        className="w-full rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">What do you want to add?</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 hover:bg-slate-100">
            <X className="size-6" aria-hidden />
          </button>
        </div>
        <div className="space-y-3">
          <Link to="/payments/new" onClick={onClose} className={buttonClass('success', 'lg', 'w-full !justify-start')}>
            <ArrowDownLeft className="size-6" aria-hidden />
            <span className="text-left">
              Money received
              <span className="block text-sm font-normal opacity-90">Client paid you</span>
            </span>
          </Link>
          <Link to="/expenses/new" onClick={onClose} className={buttonClass('expense', 'lg', 'w-full !justify-start')}>
            <ArrowUpRight className="size-6" aria-hidden />
            <span className="text-left">
              Add expense
              <span className="block text-sm font-normal opacity-90">You paid for material, labour…</span>
            </span>
          </Link>
          <Link to="/bills/new" onClick={onClose} className={buttonClass('secondary', 'lg', 'w-full !justify-start')}>
            <FileText className="size-6 text-sky-700" aria-hidden />
            <span className="text-left">
              Supplier bill
              <span className="block text-sm font-normal text-slate-600">Bought on credit, pay later</span>
            </span>
          </Link>
          <Link to="/projects/new" onClick={onClose} className={buttonClass('secondary', 'lg', 'w-full !justify-start')}>
            <FolderKanban className="size-6" aria-hidden /> New project
          </Link>
        </div>
      </div>
    </div>
  );
}
