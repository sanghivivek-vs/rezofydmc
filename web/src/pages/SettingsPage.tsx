import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { ChannelConfig, DeliveryResult, MessageChannel, ProviderName } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Badge, Button, Card, ErrorText, Input } from '../components/ui';

const PROVIDERS: ProviderName[] = ['logging', 'twilio', 'gupshup', 'heydoot'];

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
