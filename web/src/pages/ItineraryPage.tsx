import { type FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Camera,
  Car,
  Coffee,
  Hotel,
  MapPin,
  Mountain,
  Plus,
  Ship,
  ShoppingBag,
  Ticket,
  UserRound,
  Utensils,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { api, ApiError } from '../api/client';
import type { Itinerary, ItineraryDay, Segment } from '../api/types';
import { Badge, Button, Card, ErrorText, Field, Input, Select } from '../components/ui';

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

const TYPE_ICON: Record<string, ComponentType<{ className?: string }>> = {
  Transfer: Car,
  CheckIn: Hotel,
  Sightseeing: Camera,
  Excursion: Mountain,
  Meal: Utensils,
  Event: Ticket,
  FreeTime: Coffee,
  Guide: UserRound,
  Cruise: Ship,
  Shopping: ShoppingBag,
};

const STATUS_TONE: Record<string, 'success' | 'brand' | 'warning' | 'default'> = {
  Confirmed: 'success',
  TM: 'brand',
  Pending: 'warning',
};

export function ItineraryPage() {
  const { id: enquiryId = '' } = useParams();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [error, setError] = useState('');

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

  async function run(fn: () => Promise<unknown>) {
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed');
    }
  }

  const totalSegments = itinerary?.days.reduce((n, d) => n + d.segments.length, 0) ?? 0;

  return (
    <div className="space-y-5">
      <Link to={`/enquiries/${enquiryId}`} className="text-sm text-brand hover:underline">
        ← Back to enquiry
      </Link>
      <ErrorText>{error}</ErrorText>

      {!itinerary ? (
        <Card title="Itinerary">
          <p className="mb-3 text-sm text-slate-500">No itinerary yet for this enquiry.</p>
          <Button onClick={() => void run(() => api.createItinerary({ enquiryId }))}>
            <Plus className="h-4 w-4" /> Create itinerary
          </Button>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                {itinerary.title || 'Itinerary'}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Version {itinerary.version} · {itinerary.days.length} days · {totalSegments}{' '}
                activities
              </p>
            </div>
            <Badge tone="brand">Day-by-day builder</Badge>
          </div>

          <div className="space-y-4">
            {itinerary.days.length === 0 && (
              <Card>
                <p className="text-sm text-slate-400">No days yet — add your first day below.</p>
              </Card>
            )}
            {itinerary.days.map((day) => (
              <DayCard
                key={day.dayNumber}
                day={day}
                onAddSegment={(seg) => run(() => api.addSegment(itinerary.id, day.dayNumber, seg))}
                onStatus={(segId, status) =>
                  run(() => api.updateSegmentStatus(itinerary.id, segId, status))
                }
              />
            ))}
          </div>

          <AddDayForm
            nextDay={itinerary.days.length + 1}
            onAdd={(input) => run(() => api.addDay(itinerary.id, input))}
          />
        </>
      )}
    </div>
  );
}

function DayCard({
  day,
  onAddSegment,
  onStatus,
}: {
  day: ItineraryDay;
  onAddSegment: (seg: SegmentInput) => Promise<void> | void;
  onStatus: (segId: string, status: string) => Promise<void> | void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
          <span className="text-[10px] font-medium uppercase leading-none opacity-80">Day</span>
          <span className="text-base font-bold leading-none">{day.dayNumber}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-800">{day.headline}</div>
          <div className="text-xs text-slate-400">{day.date}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4" /> Activity
        </Button>
      </div>

      {day.segments.length === 0 && !adding && (
        <p className="pl-14 text-sm text-slate-400">No activities yet.</p>
      )}

      <ol className="relative space-y-4 border-l border-slate-200 pl-6">
        {day.segments.map((s) => (
          <SegmentRow key={s.id} segment={s} onStatus={(status) => onStatus(s.id, status)} />
        ))}
      </ol>

      {adding && (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
          <AddSegmentForm
            onAdd={async (seg) => {
              await onAddSegment(seg);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}
    </Card>
  );
}

function SegmentRow({
  segment,
  onStatus,
}: {
  segment: Segment;
  onStatus: (status: string) => Promise<void> | void;
}) {
  const Icon = TYPE_ICON[segment.type] ?? MapPin;
  return (
    <li className="relative">
      <span className="absolute -left-[33px] grid h-6 w-6 place-items-center rounded-full bg-brand-50 text-brand-600 ring-4 ring-white">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800">{segment.description}</span>
            <span className="text-xs text-slate-400">{segment.type}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
            {(segment.startTime || segment.endTime) && (
              <span>
                {segment.startTime}
                {segment.endTime ? `–${segment.endTime}` : ''}
              </span>
            )}
            {segment.supplier && <span>· {segment.supplier}</span>}
          </div>
        </div>
        <Select
          className="max-w-[8rem]"
          value={segment.bookingStatus}
          aria-label={`Status for ${segment.description}`}
          onChange={(e) => void onStatus(e.target.value)}
        >
          {BOOKING_STATUSES.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </Select>
      </div>
      <div className="mt-1">
        <Badge tone={STATUS_TONE[segment.bookingStatus] ?? 'default'}>
          {segment.bookingStatus}
        </Badge>
      </div>
    </li>
  );
}

interface SegmentInput {
  type: string;
  description: string;
  startTime?: string;
  endTime?: string;
  bookingStatus: string;
  supplier?: string;
}

function AddSegmentForm({
  onAdd,
  onCancel,
}: {
  onAdd: (seg: SegmentInput) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [type, setType] = useState('Sightseeing');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [supplier, setSupplier] = useState('');
  const [bookingStatus, setBookingStatus] = useState('Pending');

  function submit(e: FormEvent) {
    e.preventDefault();
    void onAdd({
      type,
      description,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      supplier: supplier || undefined,
      bookingStatus,
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Type">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          {SEGMENT_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
      </Field>
      <Field label="Description">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
      </Field>
      <Field label="Supplier (optional)">
        <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
      </Field>
      <Field label="Start">
        <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
      </Field>
      <Field label="End">
        <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
      </Field>
      <Field label="Booking status">
        <Select value={bookingStatus} onChange={(e) => setBookingStatus(e.target.value)}>
          {BOOKING_STATUSES.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </Select>
      </Field>
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit" size="sm">
          Add activity
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AddDayForm({
  nextDay,
  onAdd,
}: {
  nextDay: number;
  onAdd: (input: { dayNumber: number; date: string; headline: string }) => Promise<void> | void;
}) {
  const [date, setDate] = useState('');
  const [headline, setHeadline] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    void Promise.resolve(onAdd({ dayNumber: nextDay, date, headline })).then(() => {
      setHeadline('');
      setDate('');
    });
  }

  return (
    <Card title={`Add day ${nextDay}`}>
      <form onSubmit={submit} className="grid items-end gap-3 sm:grid-cols-3">
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Headline">
          <Input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="e.g. Arrival & city tour"
            required
          />
        </Field>
        <Button type="submit">
          <Plus className="h-4 w-4" /> Add day
        </Button>
      </form>
    </Card>
  );
}
