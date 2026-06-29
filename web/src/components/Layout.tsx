import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NotificationsProvider, useNotifications } from '../notifications/NotificationsContext';
import { Badge, Button } from './ui';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-brand text-white' : 'text-gray-600 hover:bg-gray-100'
  }`;

function NotificationsNavLink() {
  const { unreadCount } = useNotifications();
  return (
    <NavLink to="/notifications" className={linkClass}>
      <span className="inline-flex items-center gap-1.5">
        Notifications
        {unreadCount > 0 && (
          <span className="inline-flex min-w-[1.25rem] justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </span>
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
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold">DMC Ops</span>
            <nav className="ml-4 flex gap-1">
              <NavLink to="/enquiries" className={linkClass}>
                Enquiries
              </NavLink>
              <NavLink to="/catalog" className={linkClass}>
                Catalog
              </NavLink>
              <NavLink to="/bookings" className={linkClass}>
                Bookings
              </NavLink>
              <NavLink to="/reports" className={linkClass}>
                Reports
              </NavLink>
              <NotificationsNavLink />
              <NavLink to="/users" className={linkClass}>
                Team
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span>{user?.name}</span>
            <Badge>{user?.role}</Badge>
            {isOwner && <Badge>margins visible</Badge>}
            <Button variant="ghost" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
