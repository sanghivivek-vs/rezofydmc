import { type FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Building2,
  Calendar,
  Globe,
  Inbox,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Star,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { api, ApiError } from '../api/client';
import {
  INTERACTION_TYPES,
  type Agency,
  type Contact,
  type Enquiry,
  type Interaction,
  type InteractionType,
} from '../api/types';
import { Badge, Button, Card, ErrorText, Field, Input, Select, Switch } from '../components/ui';

const TYPE_LABEL: Record<InteractionType, string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
};
const TYPE_TONE: Record<InteractionType, 'brand' | 'success' | 'warning' | 'default'> = {
  call: 'brand',
  email: 'success',
  meeting: 'warning',
  note: 'default',
};

export function AgencyDetailPage() {
  const { id = '' } = useParams();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [error, setError] = useState('');
  const [showContact, setShowContact] = useState(false);

  async function load() {
    try {
      const [a, c, i] = await Promise.all([
        api.getAgency(id),
        api.listContacts(id),
        api.listInteractions(id),
      ]);
      setAgency(a);
      setContacts(c);
      setInteractions(i);
      try {
        const all = await api.listEnquiries();
        setEnquiries(all.filter((e) => e.agencyId.toLowerCase() === a.name.toLowerCase()));
      } catch {
        // enquiries are a nicety; ignore if unavailable
      }
      setError('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }
  useEffect(() => {
    void load();
  }, [id]);

  async function toggleStatus(active: boolean) {
    if (!agency) return;
    setError('');
    try {
      const updated = await api.updateAgency(agency.id, { status: active ? 'active' : 'inactive' });
      setAgency(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update');
    }
  }

  async function removeContact(contactId: string) {
    setError('');
    try {
      await api.deleteContact(contactId);
      setContacts((cs) => cs.filter((c) => c.id !== contactId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove contact');
    }
  }

  if (!agency) return <ErrorText>{error || 'Loading…'}</ErrorText>;

  return (
    <div className="space-y-5">
      <Link to="/agencies" className="text-sm text-brand hover:underline">
        ← Agencies
      </Link>
      <ErrorText>{error}</ErrorText>

      {/* Header */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <Building2 className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                  {agency.name}
                </h1>
                {agency.type && <Badge>{agency.type}</Badge>}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                {agency.country && (
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" />
                    {agency.country}
                  </span>
                )}
                {agency.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {agency.email}
                  </span>
                )}
                {agency.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {agency.phone}
                  </span>
                )}
                {agency.website && (
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" />
                    {agency.website}
                  </span>
                )}
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Switch checked={agency.status === 'active'} onChange={toggleStatus} label="Active" />
            {agency.status === 'active' ? 'Active' : 'Inactive'}
          </label>
        </div>
        {agency.notes && <p className="mt-3 text-sm text-slate-600">{agency.notes}</p>}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Contacts */}
        <Card
          title="Contacts"
          description="People you deal with at this agency"
          actions={
            <Button
              size="sm"
              variant={showContact ? 'ghost' : 'primary'}
              onClick={() => setShowContact((v) => !v)}
            >
              <UserPlus className="h-4 w-4" /> Add
            </Button>
          }
        >
          {showContact && (
            <ContactForm
              agencyId={agency.id}
              onDone={async () => {
                setShowContact(false);
                setContacts(await api.listContacts(agency.id));
              }}
              onError={setError}
            />
          )}
          <div className="space-y-2">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    {c.name}
                    {c.isPrimary && (
                      <span title="Primary contact">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {[c.title, c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <button
                  onClick={() => removeContact(c.id)}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  aria-label={`Remove ${c.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {contacts.length === 0 && (
              <p className="py-2 text-sm text-slate-400">No contacts yet.</p>
            )}
          </div>
        </Card>

        {/* Related enquiries */}
        <Card title="Enquiries" description="Recent enquiries from this agency">
          <div className="divide-y divide-slate-100">
            {enquiries.map((e) => (
              <Link
                key={e.id}
                to={`/enquiries/${e.id}`}
                className="flex items-center gap-3 py-2.5 transition hover:bg-slate-50"
              >
                <Inbox className="h-4 w-4 shrink-0 text-slate-300" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-700">
                    {e.destinations.join(', ') || 'Enquiry'}
                  </div>
                  <div className="font-mono text-xs text-slate-400">{e.id}</div>
                </div>
                <Badge>{e.status}</Badge>
              </Link>
            ))}
            {enquiries.length === 0 && (
              <p className="py-2 text-sm text-slate-400">No linked enquiries.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Interaction timeline */}
      <Card title="Interaction history" description="Calls, emails, meetings, and notes">
        <InteractionForm
          agencyId={agency.id}
          onDone={async () => setInteractions(await api.listInteractions(agency.id))}
          onError={setError}
        />
        <ol className="mt-4 space-y-3">
          {interactions.map((it) => (
            <li key={it.id} className="flex gap-3">
              <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                <MessageSquare className="h-3.5 w-3.5" />
              </span>
              <div className="flex-1 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={TYPE_TONE[it.type]}>{TYPE_LABEL[it.type]}</Badge>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <Calendar className="h-3 w-3" />
                    {new Date(it.occurredAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-slate-700">{it.summary}</p>
              </div>
            </li>
          ))}
          {interactions.length === 0 && (
            <p className="text-sm text-slate-400">No interactions logged yet.</p>
          )}
        </ol>
      </Card>
    </div>
  );
}

function ContactForm({
  agencyId,
  onDone,
  onError,
}: {
  agencyId: string;
  onDone: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.addContact(agencyId, {
        name,
        title: title || undefined,
        email: email || undefined,
        phone: phone || undefined,
        isPrimary,
      });
      await onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to add contact');
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-4 grid gap-3 rounded-xl bg-slate-50/70 p-3 sm:grid-cols-2"
    >
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Phone">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <Switch checked={isPrimary} onChange={setIsPrimary} label="Primary contact" />
        Primary contact
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm">
          Save contact
        </Button>
      </div>
    </form>
  );
}

function InteractionForm({
  agencyId,
  onDone,
  onError,
}: {
  agencyId: string;
  onDone: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const [type, setType] = useState<InteractionType>('call');
  const [summary, setSummary] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!summary.trim()) return;
    try {
      await api.logInteraction(agencyId, { type, summary });
      setSummary('');
      await onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Failed to log interaction');
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <Field label="Type">
        <Select
          className="w-32"
          value={type}
          onChange={(e) => setType(e.target.value as InteractionType)}
        >
          {INTERACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Summary">
        <Input
          className="min-w-[16rem]"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="What happened?"
          required
        />
      </Field>
      <Button type="submit" size="sm">
        <Plus className="h-4 w-4" /> Log
      </Button>
    </form>
  );
}
