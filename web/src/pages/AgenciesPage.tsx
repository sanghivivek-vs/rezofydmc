import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2, Globe, Mail, Plus } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { AGENCY_TYPES, type Agency } from '../api/types';
import { Badge, Button, Card, ErrorText, Field, Input, PageHeader, Select } from '../components/ui';

export function AgenciesPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');

  async function load() {
    try {
      setAgencies(await api.listAgencies());
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = agencies.filter((a) =>
    `${a.name} ${a.country ?? ''} ${a.type ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  );
  const active = agencies.filter((a) => a.status === 'active').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Agencies"
        subtitle="Your counterparties — the agencies and partners you sell to."
        actions={
          <Button variant={showForm ? 'ghost' : 'primary'} onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" /> Add agency
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total agencies" value={agencies.length} />
        <Stat label="Active" value={active} />
        <Stat label="Types" value={new Set(agencies.map((a) => a.type).filter(Boolean)).size} />
      </div>

      <ErrorText>{error}</ErrorText>

      {showForm && (
        <Card title="New agency">
          <AgencyForm
            onDone={async () => {
              setShowForm(false);
              await load();
            }}
            onError={setError}
          />
        </Card>
      )}

      <Card
        title="All agencies"
        actions={
          <Input
            className="w-48"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        }
      >
        <div className="divide-y divide-slate-100">
          {filtered.map((a) => (
            <Link
              key={a.id}
              to={`/agencies/${a.id}`}
              className="flex items-center gap-4 py-3 transition hover:bg-slate-50"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 font-medium text-slate-800">
                  {a.name}
                  <ArrowUpRight className="h-3.5 w-3.5 text-slate-300" />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
                  {a.country && <span>{a.country}</span>}
                  {a.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {a.email}
                    </span>
                  )}
                  {a.website && (
                    <span className="inline-flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {a.website}
                    </span>
                  )}
                </div>
              </div>
              {a.type && <Badge>{a.type}</Badge>}
              <Badge tone={a.status === 'active' ? 'success' : 'default'}>{a.status}</Badge>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="py-3 text-sm text-slate-400">
              {agencies.length === 0 ? 'No agencies yet — add your first one.' : 'No matches.'}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

function AgencyForm({
  onDone,
  onError,
}: {
  onDone: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('Retail');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [website, setWebsite] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createAgency({
        name,
        type: type as Agency['type'],
        email: email || undefined,
        phone: phone || undefined,
        country: country || undefined,
        website: website || undefined,
      });
      await onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to add agency');
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Type">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          {AGENCY_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="Country">
        <Input value={country} onChange={(e) => setCountry(e.target.value)} />
      </Field>
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Phone">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <Field label="Website">
        <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
      </Field>
      <div className="sm:col-span-2 lg:col-span-3">
        <Button type="submit" size="sm">
          Save agency
        </Button>
      </div>
    </form>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Building2 className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}
