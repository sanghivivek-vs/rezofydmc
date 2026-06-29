import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type {
  ChannelConfig,
  DeliveryResult,
  MessageChannel,
  NotificationAudience,
  OrgInfo,
  ProviderName,
  RoutingRule,
} from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, ErrorText, Input } from '../components/ui';

const PROVIDERS: ProviderName[] = ['logging', 'twilio', 'gupshup', 'heydoot'];
const ALL_CHANNELS: MessageChannel[] = ['email', 'sms', 'whatsapp'];
const AUDIENCES: NotificationAudience[] = ['team', 'actor', 'customer'];

const CHANNEL_LABEL: Record<MessageChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};

const FROM_HINT: Record<MessageChannel, string> = {
  email: 'from address',
  sms: 'sender number',
  whatsapp: 'sender id / number',
};

const selectClass =
  'w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none disabled:bg-gray-50';

export function SettingsPage() {
  const { isOwner } = useAuth();
  const [channels, setChannels] = useState<ChannelConfig[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .getChannels()
      .then(setChannels)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load channels'));
  }, []);

  function patch(channel: MessageChannel, change: Partial<ChannelConfig>) {
    setSaved(false);
    setChannels((prev) => prev.map((c) => (c.channel === channel ? { ...c, ...change } : c)));
  }

  async function save() {
    try {
      setChannels(await api.updateChannels(channels));
      setError('');
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save channels');
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Messaging channels</h1>
      <p className="text-sm text-gray-500">
        Configure how the platform reaches customers and your team over email, SMS, and WhatsApp.
        Provider credentials are held securely on the server and never shown here.
      </p>
      <ErrorText>{error}</ErrorText>

      <Card title="Channels">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="py-1.5">Channel</th>
              <th>Enabled</th>
              <th>Provider</th>
              <th>Sender</th>
              <th className="text-right">Test</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <ChannelRow
                key={c.channel}
                config={c}
                canEdit={isOwner}
                onPatch={(change) => patch(c.channel, change)}
              />
            ))}
          </tbody>
        </table>
        {isOwner && (
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={save}>Save channels</Button>
            {saved && <span className="text-sm text-green-700">Saved.</span>}
          </div>
        )}
        {!isOwner && (
          <p className="mt-3 text-xs text-gray-400">Only an Owner can change channel settings.</p>
        )}
      </Card>

      <RoutingRulesCard isOwner={isOwner} />
      <CustomerMessagingCard isOwner={isOwner} />
    </div>
  );
}

function ChannelRow({
  config,
  canEdit,
  onPatch,
}: {
  config: ChannelConfig;
  canEdit: boolean;
  onPatch: (change: Partial<ChannelConfig>) => void;
}) {
  const [to, setTo] = useState('');
  const [result, setResult] = useState<DeliveryResult | null>(null);
  const [testError, setTestError] = useState('');

  async function sendTest() {
    setResult(null);
    setTestError('');
    try {
      setResult(await api.testChannel(config.channel, to));
    } catch (err) {
      setTestError(err instanceof ApiError ? err.message : 'Test failed');
    }
  }

  return (
    <tr className="border-t border-gray-100 align-top">
      <td className="py-2 font-medium">{CHANNEL_LABEL[config.channel]}</td>
      <td>
        <input
          type="checkbox"
          checked={config.enabled}
          disabled={!canEdit}
          aria-label={`Enable ${config.channel}`}
          onChange={(e) => onPatch({ enabled: e.target.checked })}
        />
      </td>
      <td>
        <select
          className={selectClass}
          value={config.provider}
          disabled={!canEdit}
          aria-label={`Provider for ${config.channel}`}
          onChange={(e) => onPatch({ provider: e.target.value as ProviderName })}
        >
          {PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
      <td>
        <Input
          value={config.from ?? ''}
          disabled={!canEdit}
          placeholder={FROM_HINT[config.channel]}
          onChange={(e) => onPatch({ from: e.target.value })}
        />
      </td>
      <td className="py-2 text-right">
        {canEdit && (
          <div className="flex items-center justify-end gap-2">
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={`test ${FROM_HINT[config.channel].split(' ')[1] ?? 'address'}`}
              className="max-w-[12rem]"
            />
            <Button variant="ghost" onClick={sendTest} disabled={!to.trim()}>
              Send test
            </Button>
          </div>
        )}
        {result && (
          <div className="mt-1 text-xs">
            <Badge>
              {result.status}
              {result.detail ? ` — ${result.detail}` : ''}
            </Badge>
          </div>
        )}
        {testError && <p className="mt-1 text-xs text-red-600">{testError}</p>}
      </td>
    </tr>
  );
}

function CustomerMessagingCard({ isOwner }: { isOwner: boolean }) {
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [error, setError] = useState('');

  async function reload() {
    try {
      setOrg(await api.getOrg());
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load org');
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const allowed = org?.governance.customerMessagingAllowed ?? false;
  const enabled = org?.settings.customerMessagingEnabled === true;

  async function toggle() {
    try {
      setOrg(await api.setCustomerMessagingEnabled(!enabled));
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update');
    }
  }

  return (
    <Card title="Customer & partner messaging">
      <p className="mb-3 text-xs text-gray-500">
        Turn on direct messaging to your customers and partners. This only takes effect once the
        platform operator has allowed it for your account, and consent is in place.
      </p>
      <ErrorText>{error}</ErrorText>
      <div className="flex items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!isOwner || !allowed}
            aria-label="Enable customer messaging"
            onChange={toggle}
          />
          Enable customer/partner messaging
        </label>
        <Badge>{allowed ? 'platform: allowed' : 'platform: not yet allowed'}</Badge>
        {enabled && allowed && <Badge>effective</Badge>}
      </div>
      {!allowed && (
        <p className="mt-2 text-xs text-gray-400">
          Ask your platform operator to enable customer messaging for your organization.
        </p>
      )}
    </Card>
  );
}

function RoutingRulesCard({ isOwner }: { isOwner: boolean }) {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .getRoutingRules()
      .then(setRules)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load rules'));
  }, []);

  function patchRule(index: number, change: Partial<RoutingRule>) {
    setSaved(false);
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...change } : r)));
  }

  function toggleChannel(index: number, channel: MessageChannel) {
    const rule = rules[index];
    const has = rule.channels.includes(channel);
    patchRule(index, {
      channels: has ? rule.channels.filter((c) => c !== channel) : [...rule.channels, channel],
    });
  }

  async function save() {
    try {
      setRules(await api.updateRoutingRules(rules));
      setError('');
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save rules');
    }
  }

  return (
    <Card title="Trigger rules — who hears about what">
      <p className="mb-3 text-xs text-gray-500">
        Each event can notify your team or (once consent is wired) the customer over the selected
        channels. Customer delivery is held back until consent and contacts are configured.
      </p>
      <ErrorText>{error}</ErrorText>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="py-1.5">Event</th>
            <th>Audience</th>
            <th>Channels</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule, i) => (
            <tr key={`${rule.event}-${i}`} className="border-t border-gray-100">
              <td className="py-2 font-mono text-xs">{rule.event}</td>
              <td>
                <select
                  className={selectClass}
                  value={rule.audience}
                  disabled={!isOwner}
                  aria-label={`Audience for ${rule.event}`}
                  onChange={(e) =>
                    patchRule(i, { audience: e.target.value as NotificationAudience })
                  }
                >
                  {AUDIENCES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </td>
              <td className="space-x-3 py-2">
                {ALL_CHANNELS.map((ch) => (
                  <label key={ch} className="inline-flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={rule.channels.includes(ch)}
                      disabled={!isOwner}
                      aria-label={`${rule.event} ${ch}`}
                      onChange={() => toggleChannel(i, ch)}
                    />
                    {CHANNEL_LABEL[ch]}
                  </label>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {isOwner && (
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={save}>Save rules</Button>
          {saved && <span className="text-sm text-green-700">Saved.</span>}
        </div>
      )}
    </Card>
  );
}
