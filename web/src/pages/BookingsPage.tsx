import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { Booking } from '../api/types';
import { Badge, Card, ErrorText } from '../components/ui';

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listBookings()
      .then(setBookings)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'));
  }, []);

  return (
    <Card title="Bookings">
      <ErrorText>{error}</ErrorText>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-1">Booking</th>
            <th>Items</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id} className="border-t border-gray-100">
              <td className="py-1.5 font-mono text-xs">{b.id}</td>
              <td>{b.items.length}</td>
              <td>
                <Badge>{b.status}</Badge>
              </td>
              <td className="text-right">
                <Link className="text-brand hover:underline" to={`/bookings/${b.id}`}>
                  Open
                </Link>
              </td>
            </tr>
          ))}
          {bookings.length === 0 && (
            <tr>
              <td colSpan={4} className="py-3 text-gray-400">
                No bookings yet — accept a quote to create one.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
