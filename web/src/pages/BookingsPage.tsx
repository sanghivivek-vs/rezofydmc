import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarCheck, CheckCircle2, Clock } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Booking } from '../api/types';
import { Badge, Card, ErrorText, PageHeader } from '../components/ui';

const STATUS_TONE: Record<string, 'default' | 'brand' | 'success' | 'warning' | 'danger'> = {
  Confirming: 'warning',
  Confirmed: 'success',
  Cancelled: 'danger',
};

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listBookings()
      .then(setBookings)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'));
  }, []);

  const confirming = bookings.filter((b) => b.status === 'Confirming').length;
  const confirmed = bookings.filter((b) => b.status === 'Confirmed').length;

  return (
    <div className="space-y-5">
      <PageHeader title="Bookings" subtitle="Operations: confirm services and issue vouchers." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={CalendarCheck} label="Total bookings" value={bookings.length} />
        <Stat icon={Clock} label="Confirming" value={confirming} />
        <Stat icon={CheckCircle2} label="Confirmed" value={confirmed} />
      </div>

      <Card title="All bookings">
        <ErrorText>{error}</ErrorText>
        <div className="divide-y divide-slate-100">
          {bookings.map((b) => {
            const done = b.items.filter((i) => i.status === 'Confirmed').length;
            const pct = b.items.length ? Math.round((done / b.items.length) * 100) : 0;
            return (
              <Link
                key={b.id}
                to={`/bookings/${b.id}`}
                className="flex items-center gap-4 py-3 transition hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    {b.items.length} service{b.items.length === 1 ? '' : 's'}
                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-300" />
                  </div>
                  <div className="font-mono text-xs text-slate-400">{b.id}</div>
                </div>
                <div className="hidden w-40 sm:block">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-right text-xs text-slate-400">
                    {done}/{b.items.length} confirmed
                  </div>
                </div>
                <Badge tone={STATUS_TONE[b.status] ?? 'default'}>{b.status}</Badge>
              </Link>
            );
          })}
          {bookings.length === 0 && (
            <p className="py-3 text-sm text-slate-400">
              No bookings yet — accept a quote to create one.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}
