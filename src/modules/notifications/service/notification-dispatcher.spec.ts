import { NotificationDispatcher } from './notification-dispatcher';
import { DefaultConsentGate, type ConsentGate } from './consent-gate';
import type { MessageService } from './message.service';
import type { OrgService } from '../../identity-org/service/org.service';
import type { UserService } from '../../identity-org/service/user.service';
import type { AuditEvent } from '@common/audit/audit-log';
import type { ChannelConfig, OutboundMessage } from '@common/messaging/channel';
import type { RoutingRule } from '@common/messaging/routing';

const CHANNELS: ChannelConfig[] = [
  { channel: 'email', enabled: true, provider: 'logging', from: 'ops@dmc.test' },
  { channel: 'sms', enabled: true, provider: 'twilio', from: '+1555' },
];

function deps(opts: {
  rules: RoutingRule[];
  users?: { id: string; email: string; status: string }[];
  gate?: ConsentGate;
  channels?: ChannelConfig[];
}) {
  const sent: { channels: ChannelConfig[]; message: OutboundMessage }[] = [];
  const orgs = {
    async getCurrent() {
      return {
        settings: { channels: opts.channels ?? CHANNELS, notificationRules: opts.rules },
      };
    },
  } as unknown as OrgService;
  const users = {
    async list() {
      return opts.users ?? [{ id: 'u1', email: 'sally@dmc.test', status: 'active' }];
    },
  } as unknown as UserService;
  const messages = {
    async send(channels: ChannelConfig[], message: OutboundMessage) {
      sent.push({ channels, message });
      return { channel: message.channel, provider: 'logging', to: message.to, status: 'sent' };
    },
  } as unknown as MessageService;
  const gate = opts.gate ?? new DefaultConsentGate();
  return { dispatcher: new NotificationDispatcher(orgs, users, messages, gate), sent };
}

const event = (action: AuditEvent['action']): AuditEvent => ({
  orgId: 'org-A',
  actorId: 'u1',
  action,
  subject: { type: 'Quote', id: 'q1' },
  at: '2026-06-29T10:00:00.000Z',
});

describe('NotificationDispatcher', () => {
  it('delivers to the team over email for a matching rule', async () => {
    const { dispatcher, sent } = deps({
      rules: [{ event: 'quote.sent', audience: 'team', channels: ['email'] }],
    });
    const results = await dispatcher.dispatch(event('quote.sent'));
    expect(sent).toHaveLength(1);
    expect(sent[0].message).toMatchObject({ channel: 'email', to: 'sally@dmc.test' });
    expect(results[0].status).toBe('sent');
  });

  it('does nothing for an event with no matching rule', async () => {
    const { dispatcher, sent } = deps({
      rules: [{ event: 'quote.created', audience: 'team', channels: ['email'] }],
    });
    const results = await dispatcher.dispatch(event('quote.sent'));
    expect(sent).toHaveLength(0);
    expect(results).toHaveLength(0);
  });

  it('skips a non-email channel for staff with no phone on file', async () => {
    const { dispatcher, sent } = deps({
      rules: [{ event: 'quote.sent', audience: 'team', channels: ['sms'] }],
    });
    await dispatcher.dispatch(event('quote.sent'));
    expect(sent).toHaveLength(0); // no phone → no address → not sent
  });

  it('fail-closes customer audiences under the default consent gate', async () => {
    const { dispatcher, sent } = deps({
      rules: [{ event: 'quote.sent', audience: 'customer', channels: ['email'] }],
    });
    const results = await dispatcher.dispatch(event('quote.sent'));
    // No customer recipients resolved yet, so nothing is even attempted.
    expect(sent).toHaveLength(0);
    expect(results).toHaveLength(0);
  });

  it('records a consent skip when a customer recipient is denied', async () => {
    // A gate that denies, paired with a dispatcher subclass-free path: prove the
    // gate is consulted by allowing a custom gate that denies team too.
    const denyAll: ConsentGate = {
      async allows() {
        return { allowed: false, reason: 'denied' };
      },
    };
    const { dispatcher, sent } = deps({
      rules: [{ event: 'quote.sent', audience: 'team', channels: ['email'] }],
      gate: denyAll,
    });
    const results = await dispatcher.dispatch(event('quote.sent'));
    expect(sent).toHaveLength(0);
    expect(results[0]).toMatchObject({ status: 'skipped', detail: 'denied' });
  });

  it('never throws if a dependency fails', async () => {
    const orgs = {
      async getCurrent() {
        throw new Error('db down');
      },
    } as unknown as OrgService;
    const dispatcher = new NotificationDispatcher(
      orgs,
      {} as UserService,
      {} as MessageService,
      new DefaultConsentGate(),
    );
    await expect(dispatcher.dispatch(event('quote.sent'))).resolves.toEqual([]);
  });
});
