import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Booking, SupplierPO } from '../api/types';
import { Badge, Button, Card, ErrorText, Input } from '../components/ui';

export function BookingDetailPage() {
  const { id = '' } = useParams();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [pos, setPos] = useState<SupplierPO[]>([]);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

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

  return (
    <div className="space-y-4">
      <Link to="/bookings" className="text-sm text-brand hover:underline">
        ← Bookings
      </Link>
      <ErrorText>{error}</ErrorText>

      <Card title={`Booking ${booking.id}`}>
        <div className="mb-2 flex items-center gap-2 text-sm">
          <Badge>{booking.status}</Badge>
          <span className="text-gray-400">enquiry {booking.enquiryId}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-1">Item</th>
              <th>Supplier</th>
              <th>Status</th>
              <th>Confirmation</th>
            </tr>
          </thead>
          <tbody>
            {booking.items.map((it) => (
              <tr key={it.id} className="border-t border-gray-100">
                <td className="py-1.5">{it.description}</td>
                <td>{it.supplierName ?? '—'}</td>
                <td>
                  <Badge>{it.status}</Badge>
                </td>
                <td>
                  {it.status === 'Confirmed' ? (
                    <span className="text-gray-500">{it.confirmationRef}</span>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        className="w-32"
                        placeholder="Ref"
                        value={refs[it.id] ?? ''}
                        onChange={(e) => setRefs({ ...refs, [it.id]: e.target.value })}
                      />
                      <Button onClick={() => confirm(it.id)} disabled={!refs[it.id]}>
                        Confirm
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Supplier purchase orders">
        {pos.map((po) => (
          <div key={po.supplierId} className="mb-2 rounded border border-gray-200 p-2 text-sm">
            <div className="font-medium">{po.supplierName}</div>
            <ul className="ml-4 list-disc text-gray-600">
              {po.items.map((i) => (
                <li key={i.itemId}>
                  {i.description} — {i.status}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    </div>
  );
}
