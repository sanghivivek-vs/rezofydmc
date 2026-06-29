import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from './DashboardPage';
import { api } from '../api/client';
import type { DashboardReport } from '../api/types';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Olivia Owner', role: 'Owner' } }),
}));

const report: DashboardReport = {
  currency: 'INR',
  enquiries: {
    total: 6,
    byStatus: { Won: 2, Quoted: 1, 'In Progress': 1, New: 1, Lost: 1 },
    won: 2,
    lost: 1,
    winRatePercent: 67,
    recent: [
      {
        id: 'e1',
        agencyId: 'MakeMyTrip',
        destinations: ['Goa'],
        status: 'Won',
        createdAt: '2026-06-29T10:00:00Z',
      },
    ],
  },
  quotes: { count: 3, sent: 1, accepted: 2, openValue: { amountMinor: 840000, currency: 'INR' } },
  bookings: { total: 2, confirming: 1, confirmed: 1, cancelled: 0, itemsToConfirm: 2 },
  revenue: {
    sell: { amountMinor: 6876000, currency: 'INR' },
    cost: { amountMinor: 5730000, currency: 'INR' },
    margin: { amountMinor: 1146000, currency: 'INR' },
    marginPercent: 20,
  },
  upcoming: [
    {
      id: 'e2',
      agencyId: 'Yatra',
      destinations: ['Kerala'],
      status: 'Quoted',
      quoteDeadline: '2026-07-05T10:00:00Z',
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'dashboard').mockResolvedValue(report);
  });

  it('shows headline KPIs and the pipeline', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Active enquiries')).toBeInTheDocument());
    expect(screen.getByText('Open quote value')).toBeInTheDocument();
    expect(screen.getByText('67% win rate')).toBeInTheDocument();
    // owner sees the margin KPI
    expect(screen.getByText('Margin (won)')).toBeInTheDocument();
  });

  it('lists recent enquiries and upcoming deadlines', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Recent enquiries')).toBeInTheDocument());
    expect(screen.getByText('Goa')).toBeInTheDocument();
    expect(screen.getByText('Upcoming quote deadlines')).toBeInTheDocument();
  });
});
