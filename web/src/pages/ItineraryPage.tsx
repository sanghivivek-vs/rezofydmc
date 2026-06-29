import { type FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Itinerary } from '../api/types';
import { Button, Card, ErrorText, Field, Input } from '../components/ui';

const SEGMENT_TYPES = [
  'Transfer',
  'CheckIn',
  'Sightseeing',
  'Excursion',
  'Meal',
  'Event',
  'FreeTime',
  'Guide',
  'Cruise',
  'Shopping',
];
const BOOKING_STATUSES = ['Confirmed', 'TM', 'Pending'];

interface SegmentInput {
  type: string;
  description: string;
  startTime?: string;
  endTime?: string;
  bookingStatus: string;
}

export function ItineraryPage() {
  const { id: enquiryId = '' } = useParams();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [error, setError] = useState('');

  const [dayNumber, setDayNumber] = useState(1);
  const [date, setDate] = useState('2026-07-01');
  const [headline, setHeadline] = useState('');

  async function load() {
    try {
      const list = await api.listItineraries(enquiryId);
      setItinerary(list[list.length - 1] ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }
  useEffect(() => {
    void load();
  }, [enquiryId]);

  // Run a mutation, then reload; surface errors.
  async function run(fn: () => Promise<unknown>) {
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed');
    }
  }

  function onSubmit(fn: () => Promise<unknown>) {
    return (e: FormEvent) => {
      e.preventDefault();
      void run(fn);
    };
  }

  return (
    <div className="space-y-4">
      <Link to={`/enquiries/${enquiryId}`} className="text-sm text-brand hover:underline">
        ← Enquiry
      </Link>
      <ErrorText>{error}</ErrorText>

      {!itinerary ? (
        <Card title="Itinerary">
          <p className="mb-3 text-sm text-slate-500">No itinerary yet for this enquiry.</p>
          <Button onClick={() => void run(() => api.createItinerary({ enquiryId }))}>
            Create itinerary
          </Button>
        </Card>
      ) : (
        <>
          <Card title={`Itinerary v${itinerary.version}`}>
            {itinerary.days.length === 0 && (
              <p className="text-sm text-slate-400">No days yet — add one below.</p>
            )}
            {itinerary.days.map((d) => (
              <div key={d.dayNumber} className="mb-4">
                <h3 className="mb-1 font-medium">
                  Day {d.dayNumber} — {d.date}: {d.headline}
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1">Time</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.segments.map((s) => (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="py-1.5">
                          {s.startTime}
                          {s.endTime ? `–${s.endTime}` : ''}
                        </td>
                        <td>{s.type}</td>
                        <td>{s.description}</td>
                        <td>
                          <select
                            className="rounded-lg border border-slate-300 px-2 py-0.5 text-xs"
                            value={s.bookingStatus}
                            onChange={(e) =>
                              void run(() =>
                                api.updateSegmentStatus(itinerary.id, s.id, e.target.value),
                              )
                            }
                          >
                            {BOOKING_STATUSES.map((b) => (
                              <option key={b}>{b}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <AddSegment
                  onAdd={(seg) => run(() => api.addSegment(itinerary.id, d.dayNumber, seg))}
                />
              </div>
            ))}
          </Card>

          <Card title="Add day">
            <form
              className="grid items-end gap-2 md:grid-cols-4"
              onSubmit={onSubmit(async () => {
                await api.addDay(itinerary.id, { dayNumber, date, headline });
                setHeadline('');
                setDayNumber(dayNumber + 1);
              })}
            >
              <Field label="Day #">
                <Input
                  type="number"
                  min={1}
                  value={dayNumber}
                  onChange={(e) => setDayNumber(Number(e.target.value))}
                />
              </Field>
              <Field label="Date">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Headline">
                <Input value={headline} onChange={(e) => setHeadline(e.target.value)} required />
              </Field>
              <Button type="submit">Add day</Button>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}

function AddSegment({ onAdd }: { onAdd: (seg: SegmentInput) => void }) {
  const [type, setType] = useState('Sightseeing');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [bookingStatus, setBookingStatus] = useState('Pending');

  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd({
          type,
          description,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          bookingStatus,
        });
        setDescription('');
      }}
    >
      <select
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        {SEGMENT_TYPES.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <Input
        className="w-48"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
      />
      <Input
        className="w-24"
        type="time"
        value={startTime}
        onChange={(e) => setStartTime(e.target.value)}
      />
      <Input
        className="w-24"
        type="time"
        value={endTime}
        onChange={(e) => setEndTime(e.target.value)}
      />
      <select
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
        value={bookingStatus}
        onChange={(e) => setBookingStatus(e.target.value)}
      >
        {BOOKING_STATUSES.map((b) => (
          <option key={b}>{b}</option>
        ))}
      </select>
      <Button type="submit" variant="ghost">
        Add segment
      </Button>
    </form>
  );
}
