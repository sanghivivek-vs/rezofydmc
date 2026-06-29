import { NavLink, Outlet } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CalendarCheck,
  Inbox,
  LayoutGrid,
  LogOut,
  Package,
  Settings as SettingsIcon,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useAuth } from '../auth/AuthContext';
import { NotificationsProvider, useNotifications } from '../notifications/NotificationsContext';
import { Badge } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { to: '/enquiries', label: 'Enquiries', icon: Inbox },
  { to: '/catalog', label: 'Catalog', icon: Package },
  { to: '/bookings', label: 'Bookings', icon: CalendarCheck },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/users', label: 'Team', icon: Users },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

function NavRow({ item }: { item: NavItem }) {
  const { unreadCount } = useNotifications();
  const Icon = item.icon;
  const showBadge = item.to === '/notifications' && unreadCount > 0;
  return (
    <NavLink to={item.to} className={navClass}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {showBadge && (
        <span className="inline-flex min-w-[1.25rem] justify-center rounded-full bg-rose-500 px-1.5 text-xs font-semibold text-white">
          {unreadCount}
        </span>
      )}
    </NavLink>
  );
}

export function Layout() {
  return (
    <NotificationsProvider>
      <LayoutShell />
    </NotificationsProvider>
  );
}

function LayoutShell() {
  const { user, logout, isOwner } = useAuth();
  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white/70 px-3 py-4 backdrop-blur-sm sm:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-pop">
            <LayoutGrid className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">DMC Ops</div>
            <div className="text-[11px] text-slate-400">Operations Console</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <NavRow key={item.to} item={item} />
          ))}
        </nav>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-500">
          Signed in as <span className="font-medium text-slate-700">{user?.name}</span>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200 glass">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2 sm:hidden">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <LayoutGrid className="h-4 w-4" />
              </span>
              <span className="font-semibold">DMC Ops</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {isOwner && <Badge tone="brand">margins visible</Badge>}
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                  {initials}
                </span>
                <div className="hidden text-right leading-tight sm:block">
                  <div className="text-sm font-medium text-slate-800">{user?.name}</div>
                  <div className="text-[11px] text-slate-400">{user?.role}</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
