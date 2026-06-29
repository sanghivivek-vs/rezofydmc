import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  CalendarCheck,
  CircleDollarSign,
  ClipboardList,
  FileText,
  Inbox,
  TrendingUp,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { api, ApiError } from '../api/client';
import type { DashboardReport, Money } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Badge, Card, ErrorText, PageHeader, Spinner } from '../components/ui';

const STATUS_ORDER = ['New', 'In Progress', 'Quoted', 'Revision Requested', 'Won', 'Lost'];

const STATUS_TONE: Record<string, 'default' | 'brand' | 'success' | 'warning' | 'danger'> = {
  New: 'default',
  'In Progress': 'warning',
  Quoted: 'brand',
  'Revision Requested': 'warning',
  Won: 'success',
  Lost: 'danger',
  Expired: 'default',
};

function fmtMoney(m: Money): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: m.currency,
      maximumFractionDigits: 0,
    }).format(m.amountMinor / 100);
  } catch {
    return `${(m.amountMinor / 100).toLocaleString()} ${m.currency}`;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.parse(iso) - Date.now();
  const days = Math.round(diff / 86400000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (Math.abs(days) >= 1) return rtf.format(days, 'day');
  const hours = Math.round(diff / 3600000);
  return rtf.format(hours, 'hour');
}

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .dashboard()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load dashboard'));
  }, []);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!data)
    return (
      <div className="flex items-center gap-2 p-8 text-slate-400">
        <Spinner /> Loading your dashboard…
      </div>
    );

  const activeEnquiries = data.enquiries.total - data.enquiries.won - data.enquiries.lost;
  const maxStatus = Math.max(1, ...Object.values(data.enquiries.byStatus));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? ''}`.trim()}
        subtitle="Here's how your DMC is doing today."
      />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={Inbox}
          label="Active enquiries"
          value={String(activeEnquiries)}
          sub={`${data.enquiries.total} total`}
          to="/enquiries"
        />
        <Kpi
          icon={FileText}
          label="Open quote value"
          value={fmtMoney(data.quotes.openValue)}
          sub={`${data.quotes.sent} sent · ${data.quotes.accepted} accepted`}
        />
        <Kpi
          icon={CalendarCheck}
          label="Confirmed bookings"
          value={`${data.bookings.confirmed}/${data.bookings.total}`}
          sub={`${data.bookings.itemsToConfirm} items to confirm`}
          to="/bookings"
        />
        {data.revenue ? (
          <Kpi
            icon={CircleDollarSign}
            label="Margin (won)"
            value={fmtMoney(data.revenue.margin)}
            sub={`${data.revenue.marginPercent}% on ${fmtMoney(data.revenue.sell)} sell`}
            accent
          />
        ) : (
          <Kpi
            icon={TrendingUp}
            label="Win rate"
            value={`${data.enquiries.winRatePercent}%`}
            sub={`${data.enquiries.won} won · ${data.enquiries.lost} lost`}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pipeline funnel */}
        <Card
          title="Pipeline"
          description="Enquiries by stage"
          actions={<Badge tone="success">{data.enquiries.winRatePercent}% win rate</Badge>}
          className="lg:col-span-2"
        >
          <div className="space-y-3">
            {STATUS_ORDER.map((status) => {
              const count = data.enquiries.byStatus[status] ?? 0;
              const pct = Math.round((count / maxStatus) * 100);
              return (
                <div key={status} className="flex items-center gap-3">
                  <div className="w-32 shrink-0 text-sm text-slate-600">{status}</div>
                  <div className="h-7 flex-1 overflow-hidden rounded-lg bg-slate-100">
                    <div
                      className={`flex h-full items-center justify-end rounded-lg px-2 text-xs font-semibold text-white ${barColor(status)}`}
                      style={{ width: `${count === 0 ? 0 : Math.max(pct, 12)}%` }}
                    >
                      {count > 0 && count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* To-do / quick state */}
        <Card title="Needs attention">
          <ul className="space-y-3 text-sm">
            <AttentionRow
              icon={ClipboardList}
              label="Booking items to confirm"
              value={data.bookings.itemsToConfirm}
              to="/bookings"
            />
            <AttentionRow
              icon={FileText}
              label="Quotes sent, awaiting decision"
              value={data.quotes.sent}
            />
            <AttentionRow
              icon={Inbox}
              label="New enquiries to triage"
              value={data.enquiries.byStatus['New'] ?? 0}
              to="/enquiries"
            />
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent enquiries */}
        <Card
          title="Recent enquiries"
          actions={
            <Link to="/enquiries" className="text-xs font-medium text-brand hover:underline">
              View all
            </Link>
          }
        >
          <ul className="divide-y divide-slate-100">
            {data.enquiries.recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link to={`/enquiries/${e.id}`} className="group min-w-0">
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    {e.destinations.join(', ')}
                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-brand" />
                  </div>
                  <div className="text-xs text-slate-400">
                    {e.agencyId} · {timeAgo(e.createdAt)}
                  </div>
                </Link>
                <Badge tone={STATUS_TONE[e.status] ?? 'default'}>{e.status}</Badge>
              </li>
            ))}
            {data.enquiries.recent.length === 0 && (
              <li className="py-3 text-sm text-slate-400">No enquiries yet.</li>
            )}
          </ul>
        </Card>

        {/* Upcoming deadlines */}
        <Card title="Upcoming quote deadlines">
          <ul className="divide-y divide-slate-100">
            {data.upcoming.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link to={`/enquiries/${e.id}`} className="min-w-0">
                  <div className="font-medium text-slate-800">{e.destinations.join(', ')}</div>
                  <div className="text-xs text-slate-400">{e.agencyId}</div>
                </Link>
                <div className="text-right">
                  <div className="text-sm font-medium text-slate-700">
                    {new Date(e.quoteDeadline).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-slate-400">{timeAgo(e.quoteDeadline)}</div>
                </div>
              </li>
            ))}
            {data.upcoming.length === 0 && (
              <li className="py-3 text-sm text-slate-400">Nothing due. 🎉</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function barColor(status: string): string {
  switch (status) {
    case 'Won':
      return 'bg-emerald-500';
    case 'Lost':
      return 'bg-rose-400';
    case 'Quoted':
      return 'bg-brand';
    case 'In Progress':
    case 'Revision Requested':
      return 'bg-amber-400';
    default:
      return 'bg-slate-400';
  }
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  to,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  to?: string;
  accent?: boolean;
}) {
  const inner = (
    <Card className={accent ? 'bg-gradient-to-br from-brand-600 to-brand-800 text-white' : ''}>
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-xs font-medium ${accent ? 'text-white/70' : 'text-slate-500'}`}>
            {label}
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
          {sub && (
            <div className={`mt-1 text-xs ${accent ? 'text-white/70' : 'text-slate-400'}`}>
              {sub}
            </div>
          )}
        </div>
        <span
          className={`grid h-10 w-10 place-items-center rounded-xl ${
            accent ? 'bg-white/15 text-white' : 'bg-brand-50 text-brand-600'
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
  return to ? (
    <Link to={to} className="block transition-transform hover:-translate-y-0.5">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function AttentionRow({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  to?: string;
}) {
  const body = (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-slate-600">
        <Icon className="h-4 w-4 text-slate-400" />
        {label}
      </span>
      <span
        className={`grid h-6 min-w-[1.5rem] place-items-center rounded-full px-2 text-xs font-semibold ${
          value > 0 ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-400'
        }`}
      >
        {value}
      </span>
    </div>
  );
  return <li>{to ? <Link to={to}>{body}</Link> : body}</li>;
}
