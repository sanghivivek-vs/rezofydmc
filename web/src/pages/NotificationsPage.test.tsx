import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationsPage } from './NotificationsPage';
import { NotificationsProvider } from '../notifications/NotificationsContext';
import { api } from '../api/client';
import type { Notification } from '../api/types';

function notif(over: Partial<Notification>): Notification {
  return {
    id: 'n1',
    orgId: 'org1',
    type: 'quote.sent',
    subject: { type: 'quote', id: 'q1' },
    message: 'Quote q1 sent to the agency',
    read: false,
    createdAt: '2026-06-29T10:00:00.000Z',
    ...over,
  };
}

function renderPage() {
  return render(
    <NotificationsProvider>
      <NotificationsPage />
    </NotificationsProvider>,
  );
}

describe('NotificationsPage', () => {
  it('lists notifications with an unread count', async () => {
    vi.spyOn(api, 'listNotifications').mockResolvedValue([
      notif({ id: 'n1', message: 'Quote q1 sent to the agency' }),
      notif({ id: 'n2', message: 'Enquiry e1 → Won', read: true }),
    ]);

    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Quote q1 sent to the agency')).toBeInTheDocument(),
    );
    expect(screen.getByText('1 unread')).toBeInTheDocument();
  });

  it('marks a notification read', async () => {
    vi.spyOn(api, 'listNotifications').mockResolvedValue([notif({ id: 'n1' })]);
    const markSpy = vi
      .spyOn(api, 'markNotificationRead')
      .mockResolvedValue(notif({ id: 'n1', read: true }));

    renderPage();

    const button = await screen.findByRole('button', { name: 'Mark read' });
    await userEvent.click(button);

    expect(markSpy).toHaveBeenCalledWith('n1');
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Mark read' })).not.toBeInTheDocument(),
    );
  });
});
