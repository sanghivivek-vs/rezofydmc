import { useEffect, useState } from 'react';
import { ApiError, getPlatformToken, platformApi, setPlatformToken } from '../api/client';
import type { BroadcastResult, PlatformAdmin, TenantSummary } from '../api/types';
import { Badge, Button, Card, ErrorText, Field, Input } from '../components/ui';

export function PlatformConsole() {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getPlatformToken()) {
      setLoading(false);
      return;
    }
    platformApi
      .me()
      .then(setAdmin)
      .catch(() => setPlatformToken(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>;
  if (!admin) return <PlatformLogin onAuthed={setAdmin} />;
  return (
    <Console
      admin={admin}
      onSignOut={() => {
        setPlatformToken(null);
        setAdmin(null);
      }}
    />
  );
}

function PlatformLogin({ onAuthed }: { onAuthed: (a: PlatformAdmin) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await platformApi.login(email, password);
      setPlatformToken(res.token);
      onAuthed(res.admin);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <h1 className="mb-1 text-center text-xl font-semibold">DMC Platform Console</h1>
      <p className="mb-6 text-center text-sm text-gray-500">Super-admin sign in</p>
      <Card>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Console({ admin, onSignOut }: { admin: PlatformAdmin; onSignOut: () => void }) {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [error, setError] = useState('');

  async function reload() {
    try {
      setTenants(await platformApi.listTenants());
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load tenants');
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed');
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-gray-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="font-semibold">DMC Platform Console</span>
          <div className="flex items-center gap-3 text-sm">
            <span>{admin.name}</span>
            <Badge>super-admin</Badge>
            <Button variant="ghost" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <ErrorText>{error}</ErrorText>
        <BroadcastCard onSent={reload} />
        <Card title={`Tenants (${tenants.length})`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-1.5">Tenant</th>
                <th>Status</th>
                <th>Channels</th>
                <th>Customer messaging</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-t border-gray-100 align-top">
                  <td className="py-2">
                    <div className="font-medium">{t.name}</div>
                    <div className="font-mono text-xs text-gray-400">{t.id}</div>
                  </td>
                  <td>
                    {t.status === 'suspended' ? (
                      <span className="text-red-600">suspended</span>
                    ) : (
                      <span className="text-green-700">active</span>
                    )}
                  </td>
                  <td className="text-xs text-gray-600">
                    {t.enabledChannels.length ? t.enabledChannels.join(', ') : '—'}
                  </td>
                  <td className="text-xs">
                    <div>platform: {t.customerMessagingAllowed ? 'allowed' : 'blocked'}</div>
                    <div className="text-gray-500">
                      tenant: {t.customerMessagingEnabled ? 'on' : 'off'} · effective:{' '}
                      {t.customerMessagingEffective ? 'yes' : 'no'}
                    </div>
                  </td>
                  <td className="space-x-2 py-2 text-right">
                    <Button
                      variant="ghost"
                      onClick={() =>
                        run(() =>
                          t.status === 'suspended'
                            ? platformApi.unsuspendTenant(t.id)
                            : platformApi.suspendTenant(t.id),
                        )
                      }
                    >
                      {t.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        run(() =>
                          platformApi.setCustomerMessaging(t.id, !t.customerMessagingAllowed),
                        )
                      }
                    >
                      {t.customerMessagingAllowed ? 'Block customer msg' : 'Allow customer msg'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </main>
    </div>
  );
}

function BroadcastCard({ onSent }: { onSent: () => void }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [error, setError] = useState('');

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setError('');
    try {
      setResult(await platformApi.broadcast({ subject, message }));
      setSubject('');
      setMessage('');
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Broadcast failed');
    }
  }

  return (
    <Card title="Broadcast to all tenants">
      <form onSubmit={send} className="space-y-3">
        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </Field>
        <Field label="Message">
          <textarea
            className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="flex items-center gap-3">
          <Button type="submit">Send broadcast</Button>
          {result && (
            <span className="text-sm text-green-700">
              Sent to {result.tenants} tenant(s) · email sent {result.emailsSent}, skipped{' '}
              {result.emailsSkipped}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}
