import { MessageService } from './message.service';
import type { ProviderRegistry } from './providers/provider-factory';
import type { MessageProvider } from './providers/provider';
import type { ChannelConfig, OutboundMessage, ProviderName } from '@common/messaging/channel';

function fakeProvider(name: ProviderName, onSend?: () => void): MessageProvider {
  return {
    name,
    async send() {
      onSend?.();
    },
  };
}

function registryWith(provider: MessageProvider): ProviderRegistry {
  return { resolve: () => provider } as unknown as ProviderRegistry;
}

const msg = (over: Partial<OutboundMessage> = {}): OutboundMessage => ({
  channel: 'sms',
  to: '+15551234567',
  body: 'hello',
  ...over,
});

describe('MessageService', () => {
  it('sends through the configured provider for an enabled channel', async () => {
    let sent = 0;
    const svc = new MessageService(registryWith(fakeProvider('twilio', () => (sent += 1))));
    const channels: ChannelConfig[] = [
      { channel: 'sms', enabled: true, provider: 'twilio', from: '+15550000000' },
    ];

    const result = await svc.send(channels, msg());

    expect(result.status).toBe('sent');
    expect(result.provider).toBe('twilio');
    expect(sent).toBe(1);
  });

  it('skips a disabled channel without calling the provider', async () => {
    let sent = 0;
    const svc = new MessageService(registryWith(fakeProvider('twilio', () => (sent += 1))));
    const channels: ChannelConfig[] = [{ channel: 'sms', enabled: false, provider: 'twilio' }];

    const result = await svc.send(channels, msg());

    expect(result.status).toBe('skipped');
    expect(result.detail).toBe('channel disabled');
    expect(sent).toBe(0);
  });

  it('skips a channel that is not configured at all', async () => {
    const svc = new MessageService(registryWith(fakeProvider('twilio')));
    const result = await svc.send([], msg({ channel: 'whatsapp' }));
    expect(result.status).toBe('skipped');
    expect(result.detail).toBe('channel not configured');
  });

  it('records a failed delivery when the provider throws (never propagates)', async () => {
    const throwing: MessageProvider = {
      name: 'gupshup',
      async send() {
        throw new Error('boom');
      },
    };
    const svc = new MessageService(registryWith(throwing));
    const channels: ChannelConfig[] = [
      { channel: 'sms', enabled: true, provider: 'gupshup', from: 'DMC' },
    ];

    const result = await svc.send(channels, msg());

    expect(result.status).toBe('failed');
    expect(result.detail).toBe('boom');
  });

  it('skips when there is no recipient address', async () => {
    const svc = new MessageService(registryWith(fakeProvider('logging')));
    const channels: ChannelConfig[] = [{ channel: 'email', enabled: true, provider: 'logging' }];
    const result = await svc.send(channels, msg({ channel: 'email', to: '  ' }));
    expect(result.status).toBe('skipped');
    expect(result.detail).toBe('no recipient address');
  });
});
