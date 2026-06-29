import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Enquiry } from '../api/types';
import { Button, Card, ErrorText, Field, Input } from '../components/ui';

export function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [error, setError] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [destinations, setDestinations] = useState('');
  const [adults, setAdults] = useState(2);
  const [deadline, setDeadline] = useState('');

  async function load() {
    try {
      setEnquiries(await api.listEnquiries());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.createEnquiry({
        agencyId,
        destinations: destinations
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        pax: { adults, children: [], infants: 0 },
        quoteDeadline: new Date(deadline || Date.now()).toISOString(),
      });
      setAgencyId('');
      setDestinations('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create');
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="md:col-span-2">
        <Card title="Enquiries">
          <ErrorText>{error}</ErrorText>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1">Agency</th>
                <th>Destinations</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enquiries.map((e) => (
                <tr key={e.id} className="border-t border-slate-100">
                  <td className="py-1.5">{e.agencyId}</td>
                  <td>{e.destinations.join(', ')}</td>
                  <td>{e.status}</td>
                  <td className="text-right">
                    <Link className="text-brand hover:underline" to={`/enquiries/${e.id}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
              {enquiries.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-slate-400">
                    No enquiries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
      <Card title="New enquiry">
        <form className="space-y-3" onSubmit={onCreate}>
          <Field label="Agency ID">
            <Input value={agencyId} onChange={(e) => setAgencyId(e.target.value)} required />
          </Field>
          <Field label="Destinations (comma-separated)">
            <Input
              value={destinations}
              onChange={(e) => setDestinations(e.target.value)}
              placeholder="Switzerland, Italy"
              required
            />
          </Field>
          <Field label="Adults">
            <Input
              type="number"
              min={1}
              value={adults}
              onChange={(e) => setAdults(Number(e.target.value))}
            />
          </Field>
          <Field label="Quote deadline">
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full">
            Create enquiry
          </Button>
        </form>
      </Card>
    </div>
  );
}
