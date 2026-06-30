import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BookingDetailPage } from './BookingDetailPage';
import { api } from '../api/client';
import type { Booking, SupplierPO } from '../api/types';

const booking: Booking = {
  id: 'bkg_1',
  enquiryId: 'e1',
  quoteId: 'q1',
  status: 'Confirming',
  createdAt: '2026-06-29T10:00:00Z',
  items: [
    {
      id: 'it1',
      description: 'Airport transfer',
      supplierName: 'Goa Transfers',
      status: 'Pending',
    },
    {
      id: 'it2',
      description: 'Heritage tour',
      supplierName: 'Heritage Walks',
      status: 'Confirmed',
      confirmationRef: 'HW-1',
    },
  ],
};
const pos: SupplierPO[] = [
  {
    supplierId: 's1',
    supplierName: 'Goa Transfers',
    bookingId: 'bkg_1',
    items: [{ itemId: 'it1', description: 'Airport transfer', status: 'Pending' }],
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/bookings/bkg_1']}>
      <Routes>
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BookingDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'getBooking').mockResolvedValue(booking);
    vi.spyOn(api, 'supplierPOs').mockResolvedValue(pos);
  });

  it('shows services, progress, and supplier POs', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('1/2 confirmed')).toBeInTheDocument());
    expect(screen.getByText('Heritage tour')).toBeInTheDocument();
    expect(screen.getByText('Supplier purchase orders')).toBeInTheDocument();
    expect(screen.getByText('HW-1')).toBeInTheDocument(); // confirmed ref shown
  });

  it('confirms a pending item with a reference', async () => {
    const confirmSpy = vi
      .spyOn(api, 'confirmBookingItem')
      .mockResolvedValue({
        ...booking,
        items: booking.items.map((i) => ({ ...i, status: 'Confirmed' as const })),
      });

    renderPage();
    await screen.findByPlaceholderText('Confirmation ref');

    await userEvent.type(screen.getByPlaceholderText('Confirmation ref'), 'GT-99');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(confirmSpy).toHaveBeenCalledWith('bkg_1', 'it1', 'GT-99');
  });
});
