import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, FileBadge, Inbox, Receipt, Truck } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Booking, SupplierPO } from '../api/types';
import { Badge, Button, Card, ErrorText, Input } from '../components/ui';
import { DocumentFrame } from '../components/DocumentFrame';

const STATUS_TONE: Record<string, 'default' | 'brand' | 'success' | 'warning' | 'danger'> = {
  Confirming: 'warning',
  Confirmed: 'success',
  Cancelled: 'danger',
  Pending: 'warning',
};

export function BookingDetailPage() {
  const { id = '' } = useParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [pos, setPos] = useState<SupplierPO[]>([]);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [showVoucher, setShowVoucher] = useState(false);

  async function load() {
    try {
      const [b, p] = await Promise.all([api.getBooking(id), api.supplierPOs(id)]);
      setBooking(b);
      setPos(p);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }
  useEffect(() => {
    void load();
  }, [id]);

  async function confirm(itemId: string) {
    setError('');
    try {
      await api.confirmBookingItem(id, itemId, refs[itemId] ?? '');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to confirm');
    }
  }

  if (!booking) return <ErrorText>{error || 'Loading…'}</ErrorText>;

  const done = booking.items.filter((i) => i.status === 'Confirmed').length;
  const pct = booking.items.length ? Math.round((done / booking.items.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <Link to="/bookings" className="text-sm text-brand hover:underline">
        ← Bookings
      </Link>
      <ErrorText>{error}</ErrorText>

      {/* Header */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">Booking</h1>
              <Badge tone={STATUS_TONE[booking.status] ?? 'default'}>{booking.status}</Badge>
            </div>
            <div className="mt-1 font-mono text-xs text-slate-400">{booking.id}</div>
            <Link
              to={`/enquiries/${booking.enquiryId}`}
              className="mt-1 inline-flex items-center gap-1 text-sm text-brand hover:underline"
            >
              <Inbox className="h-3.5 w-3.5" /> View enquiry
            </Link>
          </div>
          <Button
            variant={showVoucher ? 'ghost' : 'primary'}
            onClick={() => setShowVoucher((v) => !v)}
          >
            <FileBadge className="h-4 w-4" /> {showVoucher ? 'Hide voucher' : 'Service voucher'}
          </Button>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Confirmation progress</span>
            <span>
              {done}/{booking.items.length} confirmed
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </Card>

      {showVoucher && (
        <Card title="Service voucher" description="Branded, print-ready — Print → Save as PDF">
          <DocumentFrame path={api.bookingVoucherUrl(booking.id)} />
        </Card>
      )}

      {/* Items + confirmation */}
      <Card title="Services" description="Confirm each service with its supplier">
        <div className="space-y-2">
          {booking.items.map((it) => (
            <div
              key={it.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
            >
              <div className="min-w-0">
                <div className="font-medium text-slate-800">{it.description}</div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Truck className="h-3.5 w-3.5" />
                  {it.supplierName ?? 'Unassigned supplier'}
                </div>
              </div>
              {it.status === 'Confirmed' ? (
                <div className="flex items-center gap-2 text-sm">
                  <Badge tone="success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Confirmed
                  </Badge>
                  <span className="font-mono text-xs text-slate-500">{it.confirmationRef}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    className="w-40"
                    placeholder="Confirmation ref"
                    value={refs[it.id] ?? ''}
                    onChange={(e) => setRefs({ ...refs, [it.id]: e.target.value })}
                  />
                  <Button size="sm" onClick={() => confirm(it.id)} disabled={!refs[it.id]?.trim()}>
                    Confirm
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Supplier POs */}
      <Card title="Supplier purchase orders" description="Grouped by supplier">
        <div className="grid gap-3 sm:grid-cols-2">
          {pos.map((po) => (
            <div key={po.supplierId} className="rounded-xl border border-slate-200 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <Receipt className="h-4 w-4" />
                </span>
                <span className="font-medium text-slate-800">{po.supplierName}</span>
              </div>
              <ul className="space-y-1 text-sm">
                {po.items.map((i) => (
                  <li key={i.itemId} className="flex items-center justify-between gap-2">
                    <span className="text-slate-600">{i.description}</span>
                    <Badge tone={STATUS_TONE[i.status] ?? 'default'}>{i.status}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {pos.length === 0 && <p className="text-sm text-slate-400">No supplier POs.</p>}
        </div>
      </Card>
    </div>
  );
}
