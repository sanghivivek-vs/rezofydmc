import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../api/client';
import type { Notification } from '../api/types';

interface NotificationsState {
  items: Notification[];
  unreadCount: number;
  error: string;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsState | null>(null);

// Light polling keeps the nav bell roughly current without a websocket.
const POLL_MS = 30_000;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setItems(await api.listNotifications());
      setError('');
    } catch {
      setError('Failed to load notifications');
    }
  }, []);

  const markRead = useCallback(async (id: string) => {
    const updated = await api.markNotificationRead(id);
    setItems((prev) => prev.map((n) => (n.id === id ? updated : n)));
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider value={{ items, unreadCount, error, refresh, markRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
