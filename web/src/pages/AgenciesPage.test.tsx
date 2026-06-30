import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AgenciesPage } from './AgenciesPage';
import { api } from '../api/client';
import type { Agency } from '../api/types';

const agencies: Agency[] = [
  {
    id: 'agcy_1',
    orgId: 'org_1',
    name: 'Globetrotter Travel',
    type: 'Retail',
    country: 'India',
    status: 'active',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'agcy_2',
    orgId: 'org_1',
    name: 'Skyline OTA',
    type: 'OTA',
    country: 'UAE',
    status: 'inactive',
    createdAt: '2026-06-02T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
  },
];

describe('AgenciesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'listAgencies').mockResolvedValue(agencies);
  });

  it('lists agencies and filters by search', async () => {
    render(
      <MemoryRouter>
        <AgenciesPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Globetrotter Travel')).toBeInTheDocument());
    expect(screen.getByText('Skyline OTA')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Search…'), 'Skyline');
    expect(screen.queryByText('Globetrotter Travel')).not.toBeInTheDocument();
    expect(screen.getByText('Skyline OTA')).toBeInTheDocument();
  });

  it('creates an agency', async () => {
    const createSpy = vi.spyOn(api, 'createAgency').mockResolvedValue(agencies[0]);
    render(
      <MemoryRouter>
        <AgenciesPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('Globetrotter Travel')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /Add agency/i }));
    await userEvent.type(screen.getByLabelText('Name'), 'New Partner Co');
    await userEvent.click(screen.getByRole('button', { name: /Save agency/i }));

    await waitFor(() => expect(createSpy).toHaveBeenCalled());
    expect(createSpy.mock.calls[0][0].name).toBe('New Partner Co');
  });
});
