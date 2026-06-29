import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlatformConsole } from './PlatformConsole';
import { platformApi, setPlatformToken } from '../api/client';
import type { TenantSummary } from '../api/types';

const tenant: TenantSummary = {
  id: 'org1',
  name: 'Alpine DMC',
  status: 'active',
  customerMessagingAllowed: false,
  customerMessagingEnabled: false,
  customerMessagingEffective: false,
  enabledChannels: ['email'],
};

describe('PlatformConsole', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setPlatformToken(null);
  });

  it('shows the super-admin login when no platform token is present', async () => {
    render(<PlatformConsole />);
    await waitFor(() => expect(screen.getByText('Super-admin sign in')).toBeInTheDocument());
  });

  it('lists tenants and can suspend one when authed', async () => {
    setPlatformToken('platform-token');
    vi.spyOn(platformApi, 'me').mockResolvedValue({
      id: 'a1',
      email: 'root@platform.test',
      name: 'Root',
      status: 'active',
    });
    vi.spyOn(platformApi, 'listTenants').mockResolvedValue([tenant]);
    const suspendSpy = vi
      .spyOn(platformApi, 'suspendTenant')
      .mockResolvedValue({ ...tenant, status: 'suspended' });

    render(<PlatformConsole />);
    await waitFor(() => expect(screen.getByText('Alpine DMC')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    expect(suspendSpy).toHaveBeenCalledWith('org1');
  });
});
