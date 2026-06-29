import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPage } from './SettingsPage';
import { api } from '../api/client';
import type { ChannelConfig, RoutingRule } from '../api/types';

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ isOwner: true }),
}));

const channels: ChannelConfig[] = [
  { channel: 'email', enabled: false, provider: 'logging' },
  { channel: 'sms', enabled: false, provider: 'twilio', from: '+15550000000' },
  { channel: 'whatsapp', enabled: false, provider: 'gupshup', from: 'DMC' },
];

const rules: RoutingRule[] = [{ event: 'quote.sent', audience: 'team', channels: ['email'] }];

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'getChannels').mockResolvedValue(channels);
    vi.spyOn(api, 'getRoutingRules').mockResolvedValue(rules);
  });

  it('renders the configured channels', async () => {
    render(<SettingsPage />);
    await waitFor(() => expect(screen.getByLabelText('Enable whatsapp')).toBeInTheDocument());
    expect(screen.getByLabelText('Enable email')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable sms')).toBeInTheDocument();
  });

  it('saves an edited channel config', async () => {
    const saveSpy = vi
      .spyOn(api, 'updateChannels')
      .mockResolvedValue([{ ...channels[0], enabled: true }, channels[1], channels[2]]);

    render(<SettingsPage />);
    await screen.findByLabelText('Enable email');

    await userEvent.click(screen.getByLabelText('Enable email'));
    await userEvent.click(screen.getByRole('button', { name: 'Save channels' }));

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const sent = saveSpy.mock.calls[0][0];
    expect(sent.find((c) => c.channel === 'email')?.enabled).toBe(true);
    await waitFor(() => expect(screen.getByText('Saved.')).toBeInTheDocument());
  });

  it('runs a channel test and shows the delivery status', async () => {
    vi.spyOn(api, 'testChannel').mockResolvedValue({
      channel: 'email',
      provider: 'logging',
      to: 'x@acme.test',
      status: 'sent',
    });

    render(<SettingsPage />);
    await screen.findByLabelText('Enable email');

    const testInputs = screen.getAllByPlaceholderText(/^test /);
    await userEvent.type(testInputs[0], 'x@acme.test');
    const testButtons = screen.getAllByRole('button', { name: 'Send test' });
    await userEvent.click(testButtons[0]);

    await waitFor(() => expect(screen.getByText('sent')).toBeInTheDocument());
  });

  it('saves edited routing rules (adds a channel to a rule)', async () => {
    const saveSpy = vi
      .spyOn(api, 'updateRoutingRules')
      .mockResolvedValue([
        { event: 'quote.sent', audience: 'team', channels: ['email', 'whatsapp'] },
      ]);

    render(<SettingsPage />);
    await screen.findByText('quote.sent');

    await userEvent.click(screen.getByLabelText('quote.sent whatsapp'));
    await userEvent.click(screen.getByRole('button', { name: 'Save rules' }));

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const sent = saveSpy.mock.calls[0][0];
    expect(sent[0].channels).toContain('whatsapp');
  });
});
