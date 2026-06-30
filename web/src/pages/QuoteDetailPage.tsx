import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileText, Printer, ReceiptText, Send, ThumbsUp } from 'lucide-react';
import { api, ApiError } from '../api/client';
import type { Quote } from '../api/types';
import { Badge, Button, Card, ErrorText, Spinner, money } from '../components/ui';
import { useAuth } from '../auth/AuthContext';

type Tab = 'breakdown' | 'document';

const STATUS_TONE: Record<string, 'default' | 'brand' | 'success' | 'warning' | 'danger'> = {
  Draft: 'default',
  Sent: 'brand',
  'Under Revision': 'warning',
  Accepted: 'success',
  Rejected: 'danger',
  Expired: 'default',
};

export function QuoteDetailPage() {
  const { id: enquiryId = '', quoteId = '' } = useParams();
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('breakdown');

  async function load() {
    try {
      const quotes = await api.listQuotes(enquiryId);
      setQuote(quotes.find((q) => q.id === quoteId) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load quote');
    }
  }
  useEffect(() => {
    void load();
  }, [enquiryId, quoteId]);

  async function run(fn: () => Promise<unknown>) {
    setError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed');
    }
  }

  if (error && !quote) return <ErrorText>{error}</ErrorText>;
  if (!quote)
    return (
      <div className="flex items-center gap-2 p-8 text-slate-400">
        <Spinner /> Loading quote…
      </div>
    );

  const sell = quote.sell;

  return (
    <div className="space-y-5">
      <Link to={`/enquiries/${enquiryId}`} className="text-sm text-brand hover:underline">
        ← Back to enquiry
      </Link>
      <ErrorText>{error}</ErrorText>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Quote v{quote.version}
          </h1>
          <Badge tone={STATUS_TONE[quote.status] ?? 'default'}>{quote.status}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {quote.status === 'Draft' && (
            <Button onClick={() => run(() => api.sendQuote(quote.id))}>
              <Send className="h-4 w-4" /> Send to agency
            </Button>
          )}
          {(quote.status === 'Draft' || quote.status === 'Sent') && (
            <Button
              onClick={() =>
                run(async () => {
                  const booking = await api.acceptQuote(quote.id);
                  navigate(`/bookings/${booking.id}`);
                })
              }
            >
              <ThumbsUp className="h-4 w-4" /> Accept
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        <TabButton
          active={tab === 'breakdown'}
          onClick={() => setTab('breakdown')}
          icon={ReceiptText}
        >
          Pricing breakdown
        </TabButton>
        <TabButton active={tab === 'document'} onClick={() => setTab('document')} icon={FileText}>
          Client document
        </TabButton>
      </div>

      {tab === 'breakdown' ? (
        <div className="space-y-5">
          {/* Headline numbers */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total (incl. tax)" value={money(sell.total)} big />
            <Stat label="Per person" value={money(sell.perPax)} />
            {quote.margin ? (
              <>
                <Stat label="Margin" value={money(quote.margin.totalMargin)} accent />
                <Stat label="Margin %" value={`${quote.margin.marginPercent.toFixed(1)}%`} accent />
              </>
            ) : (
              <div className="sm:col-span-2 grid place-items-center rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                Cost & margin are visible to Owners only
              </div>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Price build-up" description="What the agency sees">
              <table className="w-full text-sm">
                <tbody>
                  <Row label="Included services subtotal" value={money(sell.includedSubtotal)} />
                  {sell.taxes.map((t) => (
                    <Row
                      key={t.label}
                      label={`${t.label} (${t.percent}%)`}
                      value={money(t.amount)}
                      muted
                    />
                  ))}
                  <Row label="Total" value={money(sell.total)} strong />
                  <Row label="Per person" value={money(sell.perPax)} muted />
                </tbody>
              </table>

              {sell.optionalItems.length > 0 && (
                <>
                  <div className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Optional add-ons
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {sell.optionalItems.map((o) => (
                        <Row key={o.lineId} label={o.description} value={money(o.sell)} muted />
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </Card>

            {quote.margin ? (
              <Card
                title="Cost & margin"
                description="Owner-only"
                actions={<Badge tone="brand">internal</Badge>}
              >
                <table className="w-full text-sm">
                  <tbody>
                    <Row label="Net cost" value={money(quote.margin.totalCost)} />
                    <Row label="Sell" value={money(quote.margin.totalSell)} />
                    <Row label="Margin" value={money(quote.margin.totalMargin)} strong />
                    <Row
                      label="Margin %"
                      value={`${quote.margin.marginPercent.toFixed(1)}%`}
                      muted
                    />
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-slate-400">
                  Full line-by-line costing is in the owner costing sheet (Document tab).
                </p>
              </Card>
            ) : (
              <Card title="Cost & margin">
                <p className="text-sm text-slate-400">
                  Hidden for your role. Ask an Owner for the internal costing.
                </p>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <DocumentViewer quoteId={quote.id} isOwner={isOwner} />
      )}
    </div>
  );
}

function DocumentViewer({ quoteId, isOwner }: { quoteId: string; isOwner: boolean }) {
  const [which, setWhich] = useState<'client' | 'costing'>('client');
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const path = which === 'client' ? api.quoteDocumentUrl(quoteId) : api.costingSheetUrl(quoteId);
    setHtml('');
    setError('');
    api
      .fetchDocument(path)
      .then(setHtml)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load document'));
  }, [quoteId, which]);

  function print() {
    frameRef.current?.contentWindow?.print();
  }

  return (
    <Card
      title={which === 'client' ? 'Client quote & itinerary' : 'Owner costing sheet'}
      description="Branded, print-ready — use Print → Save as PDF"
      actions={
        <div className="flex items-center gap-2">
          {isOwner && (
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
              <button
                className={`rounded px-2 py-1 ${which === 'client' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                onClick={() => setWhich('client')}
              >
                Client
              </button>
              <button
                className={`rounded px-2 py-1 ${which === 'costing' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                onClick={() => setWhich('costing')}
              >
                Costing
              </button>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={print} disabled={!html}>
            <Printer className="h-4 w-4" /> Print / PDF
          </Button>
        </div>
      }
    >
      <ErrorText>{error}</ErrorText>
      {html ? (
        <iframe
          ref={frameRef}
          title="document"
          srcDoc={html}
          className="h-[70vh] w-full rounded-lg border border-slate-200 bg-white"
        />
      ) : (
        !error && (
          <div className="flex items-center gap-2 p-8 text-slate-400">
            <Spinner /> Rendering document…
          </div>
        )
      )}
    </Card>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
  big,
  accent,
}: {
  label: string;
  value: string;
  big?: boolean;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? 'bg-gradient-to-br from-brand-600 to-brand-800 text-white' : ''}>
      <div className={`text-xs font-medium ${accent ? 'text-white/70' : 'text-slate-500'}`}>
        {label}
      </div>
      <div className={`mt-1 font-semibold tracking-tight ${big ? 'text-2xl' : 'text-xl'}`}>
        {value}
      </div>
    </Card>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <tr className="border-t border-slate-100 first:border-t-0">
      <td className={`py-2 ${muted ? 'text-slate-500' : 'text-slate-700'}`}>{label}</td>
      <td
        className={`py-2 text-right tabular-nums ${strong ? 'text-base font-semibold text-slate-900' : muted ? 'text-slate-500' : 'font-medium'}`}
      >
        {value}
      </td>
    </tr>
  );
}
