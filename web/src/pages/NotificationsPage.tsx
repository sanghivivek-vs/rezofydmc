import { useState } from 'react';
import { ApiError } from '../api/client';
import { useNotifications } from '../notifications/NotificationsContext';
import { Badge, Button, Card, ErrorText } from '../components/ui';

export function NotificationsPage() {
  const { items, unreadCount, error, markRead } = useNotifications();
  const [actionError, setActionError] = useState('');

  async function onMarkRead(id: string) {
    try {
      await markRead(id);
      setActionError('');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to mark read');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Notifications</h1>
        {unreadCount > 0 && <Badge>{unreadCount} unread</Badge>}
      </div>
      <ErrorText>{error || actionError}</ErrorText>

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">You&apos;re all caught up — no notifications.</p>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-4 py-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {!n.read && (
                      <span className="h-2 w-2 rounded-full bg-brand" aria-label="unread" />
                    )}
                    <span
                      className={`text-sm ${n.read ? 'text-slate-500' : 'font-medium text-slate-800'}`}
                    >
                      {n.message}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{n.type}</span>
                    <span>·</span>
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                {!n.read && (
                  <Button variant="ghost" onClick={() => onMarkRead(n.id)}>
                    Mark read
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
