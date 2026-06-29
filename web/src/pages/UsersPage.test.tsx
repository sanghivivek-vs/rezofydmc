import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UsersPage } from './UsersPage';
import { api } from '../api/client';
import type { PublicUser } from '../api/types';

const me: PublicUser = {
  id: 'u-owner',
  orgId: 'org1',
  email: 'owner@acme.test',
  name: 'Olivia Owner',
  role: 'Owner',
  status: 'active',
};

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: me, isOwner: true }),
}));

const sally: PublicUser = {
  id: 'u-sales',
  orgId: 'org1',
  email: 'sally@acme.test',
  name: 'Sally Sales',
  role: 'Sales',
  status: 'active',
};

describe('UsersPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'listUsers').mockResolvedValue([me, sally]);
  });

  it('lists users for an Owner', async () => {
    render(<UsersPage />);
    await waitFor(() => expect(screen.getByText('Sally Sales')).toBeInTheDocument());
    expect(screen.getByText('sally@acme.test')).toBeInTheDocument();
  });

  it('disables a user via the API', async () => {
    const updateSpy = vi
      .spyOn(api, 'updateUser')
      .mockResolvedValue({ ...sally, status: 'disabled' });

    render(<UsersPage />);
    await screen.findByText('Sally Sales');

    // Rows render in list order [owner(self), sally]; target Sally's row.
    const disableButtons = screen.getAllByRole('button', { name: 'Disable' });
    await userEvent.click(disableButtons[1]);

    expect(updateSpy).toHaveBeenCalledWith('u-sales', { status: 'disabled' });
  });
});
