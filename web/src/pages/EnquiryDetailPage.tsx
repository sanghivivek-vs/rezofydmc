import { type FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Map, Plus, Sparkles, Trash2, Users } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Component, Enquiry, Quote } from '../api/types';
import { Badge, Button, Card, ErrorText, Field, Input, Select, money } from '../components/ui';

const STATUS_TONE: Record<string, 'default' | 'brand' | 'success' | 'warning' | 'danger'> = {
  New: 'default',
  'In Progress': 'warning',
  Quoted: 'brand',
  'Revision Requested': 'warning',
  Won: 'success',
  Lost: 'danger',
  Expired: 'default',
};

interface DraftLine {
  componentId: string;
  name: string;
  inclusion: 'included' | 'optional';
}

export function EnquiryDetailPage() {
  const { id = '' } = useParams();
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [error, setError] = useState('');

  const [travelDate, setTravelDate] = useState('2026-08-15');
  const [pick, setPick] = useState('');
  const [inclusion, setInclusion] = useState<'included' | 'optional'>('included');
  const [lines, setLines] = useState<DraftLine[]>([]);

  async function load() {
    try {
      const [e, q, c] = await Promise.all([
        api.getEnquiry(id),
        api.listQuotes(id),
        api.listComponents(),
      ]);
      setEnquiry(e);
      setQuotes(q);
      setComponents(c);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }
  useEffect(() => {
    void load();
  }, [id]);

  function addLine() {
    const c = components.find((x) => x.id === pick);
    if (!c) return;
    setLines((prev) => [...prev, { componentId: c.id, name: c.name, inclusion }]);
    setPick('');
  }

  async function onPriceQuote(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.createQuote({
        enquiryId: id,
        lines: lines.map((l) => ({
          componentId: l.componentId,
          travelDate,
          inclusion: l.inclusion,
        })),
      });
      setLines([]);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create quote');
    }
  }

  if (!enquiry) return <ErrorText>{error || 'Loading…'}</ErrorText>;

  return (
    <div className="space-y-5">
      <Link to="/enquiries" className="text-sm text-brand hover:underline">
        ← Enquiries
      </Link>
      <ErrorText>{error}</ErrorText>

      {/* Enquiry hero */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                {enquiry.destinations.join(' · ')}
              </h1>
              <Badge tone={STATUS_TONE[enquiry.status] ?? 'default'}>{enquiry.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">Agency: {enquiry.agencyId}</p>
          </div>
          <Link to={`/enquiries/${id}/itinerary`}>
            <Button variant="ghost">
              <Map className="h-4 w-4" /> Itinerary builder
            </Button>
          </Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Meta
            icon={Users}
            label="Travellers"
            value={`${enquiry.pax.adults} adults · ${enquiry.pax.children.length} children · ${enquiry.pax.infants} infants`}
          />
          <Meta
            icon={CalendarDays}
            label="Quote deadline"
            value={new Date(enquiry.quoteDeadline).toLocaleDateString()}
          />
          <Meta icon={Sparkles} label="Meal preference" value={enquiry.mealPreference || '—'} />
          <Meta icon={Map} label="Destinations" value={enquiry.destinations.join(', ')} />
        </div>
        {enquiry.specialRequirements && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Special requirements: </span>
            {enquiry.specialRequirements}
          </div>
        )}
      </Card>

      {/* Quotes */}
      <Card title="Quotes" description="Versioned, priced by the costing engine">
        {quotes.length === 0 && <p className="text-sm text-slate-400">No quotes yet.</p>}
        <div className="space-y-3">
          {quotes.map((q) => (
            <Link
              key={q.id}
              to={`/enquiries/${id}/quotes/${q.id}`}
              className="block rounded-xl border border-slate-200 p-3 transition hover:border-brand-300 hover:bg-brand-50/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">Quote v{q.version}</span>
                  <Badge tone={q.status === 'Accepted' ? 'success' : 'brand'}>{q.status}</Badge>
                </div>
                <div className="flex items-center gap-5 text-sm">
                  <Num label="Total" value={money(q.sell.total)} />
                  <Num label="Per pax" value={money(q.sell.perPax)} />
                  {q.margin && (
                    <Num label="Margin" value={`${q.margin.marginPercent.toFixed(0)}%`} accent />
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      {/* Quote builder */}
      <Card title="Build a new quote">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Field label="Add a component">
            <Select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Select a service…</option>
              {components.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Inclusion">
            <Select
              value={inclusion}
              onChange={(e) => setInclusion(e.target.value as DraftLine['inclusion'])}
            >
              <option value="included">Included</option>
              <option value="optional">Optional</option>
            </Select>
          </Field>
          <Button type="button" variant="ghost" onClick={addLine} disabled={!pick}>
            <Plus className="h-4 w-4" /> Add line
          </Button>
        </div>

        {lines.length > 0 && (
          <div className="mt-4 space-y-2">
            {lines.map((l, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="text-slate-700">{l.name}</span>
                <div className="flex items-center gap-3">
                  <Badge tone={l.inclusion === 'included' ? 'success' : 'default'}>
                    {l.inclusion}
                  </Badge>
                  <button
                    onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                    className="text-slate-400 hover:text-rose-500"
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <form onSubmit={onPriceQuote} className="flex flex-wrap items-end gap-3 pt-2">
              <Field label="Travel date">
                <Input
                  type="date"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                />
              </Field>
              <Button type="submit">
                Price {lines.length} line{lines.length > 1 ? 's' : ''}
              </Button>
            </form>
          </div>
        )}
        {lines.length === 0 && (
          <p className="mt-3 text-xs text-slate-400">
            Add one or more components, then price them into a versioned quote.
          </p>
        )}
      </Card>
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="truncate text-sm font-medium text-slate-800">{value}</div>
      </div>
    </div>
  );
}

function Num({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`font-semibold ${accent ? 'text-brand-700' : 'text-slate-800'}`}>{value}</div>
    </div>
  );
}
