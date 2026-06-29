import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { ApiError, getPlatformToken, platformApi, setPlatformToken } from '../api/client';
import type { BroadcastResult, PlatformAdmin, TenantSummary } from '../api/types';
import { Button, Card, ErrorText, Field, Input } from '../components/ui';

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

  if (loading) return <div className="p-8 text-slate-400">Loading…</div>;
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-pop">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-xl font-semibold text-white">DMC Platform Console</h1>
          <p className="text-sm text-slate-400">Super-admin sign in</p>
        </div>
        <Card>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
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
      <header className="border-b border-slate-800 bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="font-semibold">DMC Platform Console</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden sm:inline">{admin.name}</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/90">
              super-admin
            </span>
            <button
              onClick={onSignOut}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-sm font-medium text-white/90 transition hover:bg-white/10"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <ErrorText>{error}</ErrorText>
        <BroadcastCard onSent={reload} />
        <Card title={`Tenants (${tenants.length})`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1.5">Tenant</th>
                <th>Status</th>
                <th>Channels</th>
                <th>Customer messaging</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 align-top">
                  <td className="py-2">
                    <div className="font-medium">{t.name}</div>
                    <div className="font-mono text-xs text-slate-400">{t.id}</div>
                  </td>
                  <td>
                    {t.status === 'suspended' ? (
                      <span className="text-red-600">suspended</span>
                    ) : (
                      <span className="text-green-700">active</span>
                    )}
                  </td>
                  <td className="text-xs text-slate-600">
                    {t.enabledChannels.length ? t.enabledChannels.join(', ') : '—'}
                  </td>
                  <td className="text-xs">
                    <div>platform: {t.customerMessagingAllowed ? 'allowed' : 'blocked'}</div>
                    <div className="text-slate-500">
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
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
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
