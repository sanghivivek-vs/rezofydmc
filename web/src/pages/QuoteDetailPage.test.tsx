import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QuoteDetailPage } from './QuoteDetailPage';
import { api } from '../api/client';
import type { Quote } from '../api/types';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ isOwner: true }),
}));

const quote: Quote = {
  id: 'q1',
  enquiryId: 'e1',
  version: 1,
  status: 'Sent',
  currency: 'INR',
  sell: {
    currency: 'INR',
    includedSubtotal: { amountMinor: 1000000, currency: 'INR' },
    taxes: [{ label: 'GST', percent: 5, amount: { amountMinor: 50000, currency: 'INR' } }],
    total: { amountMinor: 1050000, currency: 'INR' },
    perPax: { amountMinor: 350000, currency: 'INR' },
    optionalItems: [
      { lineId: 'l1', description: 'Watersports', sell: { amountMinor: 420000, currency: 'INR' } },
    ],
  },
  margin: {
    currency: 'INR',
    totalCost: { amountMinor: 800000, currency: 'INR' },
    totalSell: { amountMinor: 1000000, currency: 'INR' },
    totalMargin: { amountMinor: 200000, currency: 'INR' },
    marginPercent: 25,
  },
  createdAt: '2026-06-29T10:00:00Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/enquiries/e1/quotes/q1']}>
      <Routes>
        <Route path="/enquiries/:id/quotes/:quoteId" element={<QuoteDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('QuoteDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'listQuotes').mockResolvedValue([quote]);
  });

  it('shows the pricing breakdown and owner margin', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Quote v1')).toBeInTheDocument());
    expect(screen.getByText('Price build-up')).toBeInTheDocument();
    expect(screen.getByText('Included services subtotal')).toBeInTheDocument();
    // owner sees the cost & margin card
    expect(screen.getByText('Cost & margin')).toBeInTheDocument();
    expect(screen.getByText('Optional add-ons')).toBeInTheDocument();
  });
});
