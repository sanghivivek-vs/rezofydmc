import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { Button, Card, ErrorText, Field, Input } from '../components/ui';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/enquiries');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-900 lg:block">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              <LayoutGrid className="h-6 w-6" />
            </span>
            <span className="text-lg font-semibold">DMC Platform</span>
          </div>
          <div className="max-w-md">
            <h2 className="text-3xl font-semibold leading-tight">
              Run your destination business in one place.
            </h2>
            <p className="mt-4 text-white/70">
              Enquiries, itineraries, quotes, bookings, and multi-channel messaging — built for
              modern DMC teams.
            </p>
          </div>
          <p className="text-sm text-white/50">© DMC Platform</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center lg:hidden">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-pop">
              <LayoutGrid className="h-6 w-6" />
            </span>
          </div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="mb-6 text-sm text-slate-500">Sign in to your operations console.</p>
          <Card>
            <form className="space-y-4" onSubmit={onSubmit}>
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  placeholder="you@company.com"
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  placeholder="••••••••"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
              <ErrorText>{error}</ErrorText>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
