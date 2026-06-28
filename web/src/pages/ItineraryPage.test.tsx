import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ItineraryPage } from './ItineraryPage';
import { api } from '../api/client';

describe('ItineraryPage', () => {
  it('offers to create an itinerary when none exists', async () => {
    vi.spyOn(api, 'listItineraries').mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/enquiries/e1/itinerary']}>
        <Routes>
          <Route path="/enquiries/:id/itinerary" element={<ItineraryPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /create itinerary/i })).toBeInTheDocument(),
    );
  });
});
