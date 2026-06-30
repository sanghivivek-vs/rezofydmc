import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AgencyDetailPage } from './AgencyDetailPage';
import { api } from '../api/client';
import type { Agency, Contact, Interaction } from '../api/types';

const agency: Agency = {
  id: 'agcy_1',
  orgId: 'org_1',
  name: 'Globetrotter Travel',
  type: 'Retail',
  email: 'hello@globetrotter.test',
  country: 'India',
  status: 'active',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};
const contacts: Contact[] = [
  {
    id: 'cont_1',
    orgId: 'org_1',
    agencyId: 'agcy_1',
    name: 'Asha Rao',
    title: 'Director',
    isPrimary: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  },
];
const interactions: Interaction[] = [
  {
    id: 'intx_1',
    orgId: 'org_1',
    agencyId: 'agcy_1',
    type: 'call',
    summary: 'Discussed Q3 group tours',
    occurredAt: '2026-06-10T09:00:00.000Z',
    recordedBy: 'usr_1',
    createdAt: '2026-06-10T09:00:00.000Z',
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/agencies/agcy_1']}>
      <Routes>
        <Route path="/agencies/:id" element={<AgencyDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AgencyDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'getAgency').mockResolvedValue(agency);
    vi.spyOn(api, 'listContacts').mockResolvedValue(contacts);
    vi.spyOn(api, 'listInteractions').mockResolvedValue(interactions);
    vi.spyOn(api, 'listEnquiries').mockResolvedValue([]);
  });

  it('shows agency info, contacts, and interaction history', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Globetrotter Travel')).toBeInTheDocument());
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('Discussed Q3 group tours')).toBeInTheDocument();
  });

  it('logs an interaction and reloads the timeline', async () => {
    const logSpy = vi.spyOn(api, 'logInteraction').mockResolvedValue({
      ...interactions[0],
      id: 'intx_2',
      type: 'note',
      summary: 'Sent revised quote',
    });
    renderPage();
    await waitFor(() => expect(screen.getByText('Globetrotter Travel')).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('What happened?'), 'Sent revised quote');
    await userEvent.click(screen.getByRole('button', { name: /Log/i }));

    await waitFor(() =>
      expect(logSpy).toHaveBeenCalledWith('agcy_1', {
        type: 'call',
        summary: 'Sent revised quote',
      }),
    );
  });
});
