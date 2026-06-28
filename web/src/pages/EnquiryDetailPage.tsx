import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, getToken } from '../api/client';
import type { Component, Enquiry, Quote } from '../api/types';
import { Badge, Button, Card, ErrorText, Field, Input, money } from '../components/ui';

export function EnquiryDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [error, setError] = useState('');
  const [componentId, setComponentId] = useState('');
  const [travelDate, setTravelDate] = useState('2026-07-01');

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

  async function onCreateQuote(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.createQuote({
        enquiryId: id,
        lines: [{ componentId, travelDate, inclusion: 'included' }],
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create quote');
    }
  }

  async function onSend(quoteId: string) {
    setError('');
    try {
      await api.sendQuote(quoteId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send');
    }
  }

  async function onAccept(quoteId: string) {
    setError('');
    try {
      const booking = await api.acceptQuote(quoteId);
      navigate(`/bookings/${booking.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to accept');
    }
  }

  // The document endpoint is authenticated, so fetch with the bearer token and
  // open the returned HTML in a new tab.
  async function openDocument(quoteId: string) {
    const res = await fetch(api.quoteDocumentUrl(quoteId), {
      headers: { authorization: `Bearer ${getToken() ?? ''}` },
    });
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  }

  if (!enquiry) return <ErrorText>{error || 'Loading…'}</ErrorText>;

  return (
    <div className="space-y-4">
      <Link to="/enquiries" className="text-sm text-brand hover:underline">
        ← Enquiries
      </Link>
      <ErrorText>{error}</ErrorText>

      <Card title="Enquiry">
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <Info label="Agency" value={enquiry.agencyId} />
          <Info label="Destinations" value={enquiry.destinations.join(', ')} />
          <Info label="Status" value={enquiry.status} />
          <Info
            label="Pax"
            value={`${enquiry.pax.adults}A ${enquiry.pax.children.length}C ${enquiry.pax.infants}I`}
          />
        </div>
      </Card>

      <Card title="Quotes">
        {quotes.length === 0 && <p className="text-sm text-gray-400">No quotes yet.</p>}
        <div className="space-y-3">
          {quotes.map((q) => (
            <div key={q.id} className="rounded border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">v{q.version}</span>
                  <Badge>{q.status}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => openDocument(q.id)}>
                    Document
                  </Button>
                  {q.status === 'Draft' && <Button onClick={() => onSend(q.id)}>Send</Button>}
                  {(q.status === 'Draft' || q.status === 'Sent') && (
                    <Button onClick={() => onAccept(q.id)}>Accept</Button>
                  )}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <Info label="Total" value={money(q.sell.total)} />
                <Info label="Per pax" value={money(q.sell.perPax)} />
                {/* Margin is present only for Owners (server-side gate). */}
                {q.margin ? (
                  <>
                    <Info label="Margin" value={money(q.margin.totalMargin)} />
                    <Info label="Margin %" value={`${q.margin.marginPercent.toFixed(1)}%`} />
                  </>
                ) : (
                  <div className="col-span-2 self-end text-xs text-gray-400">
                    Margin hidden for your role
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="New quote">
        <form className="grid items-end gap-2 md:grid-cols-3" onSubmit={onCreateQuote}>
          <Field label="Component">
            <select
              className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
              value={componentId}
              onChange={(e) => setComponentId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {components.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Travel date">
            <Input type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} />
          </Field>
          <Button type="submit">Price quote</Button>
        </form>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div>{value}</div>
    </div>
  );
}
