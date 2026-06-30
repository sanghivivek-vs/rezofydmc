/**
 * Document service (Build guide §4 Documents, §10). Produces:
 *  - a client-facing quote + itinerary document (sell-side only), and
 *  - an owner-only costing sheet (cost/margin breakdown).
 *
 * Composes Quotation, Enquiry, Identity/Org, and Itinerary through their service
 * interfaces. The owner-only costing sheet is gated server-side (Build guide §9):
 * the margin data never reaches a non-owner, defence-in-depth beyond the route's
 * @Roles guard.
 */

import { type TenantContext, canSeeMargins } from '@common/tenancy/tenant-context';
import { ForbiddenError } from '@common/errors/errors';
import { formatMoney, type Money } from '@common/money/money';
import { QuotationService } from '@modules/quotation';
import { EnquiryService, type Enquiry } from '@modules/enquiry-intake';
import { OrgService, type Organization } from '@modules/identity-org';
import { ItineraryService, type Itinerary } from '@modules/itinerary';
import { OperationsService, type BookingItem } from '@modules/operations';
import type { RenderedDocument } from '../domain/document';
import { type DocumentRenderer, escapeHtml } from './document-renderer';

export interface DocumentServiceDeps {
  readonly renderer: DocumentRenderer;
  readonly quotation: QuotationService;
  readonly enquiries: EnquiryService;
  readonly orgs: OrgService;
  readonly itineraries: ItineraryService;
  readonly operations: OperationsService;
}

export class DocumentService {
  private readonly renderer: DocumentRenderer;
  private readonly quotation: QuotationService;
  private readonly enquiries: EnquiryService;
  private readonly orgs: OrgService;
  private readonly itineraries: ItineraryService;
  private readonly operations: OperationsService;

  constructor(deps: DocumentServiceDeps) {
    this.renderer = deps.renderer;
    this.quotation = deps.quotation;
    this.enquiries = deps.enquiries;
    this.orgs = deps.orgs;
    this.itineraries = deps.itineraries;
    this.operations = deps.operations;
  }

  /**
   * Branded service voucher for a booking: the confirmed services grouped by
   * supplier, with confirmation references. Readable by any authenticated tenant
   * user (sell-side only — no cost/margin).
   */
  async bookingVoucher(ctx: TenantContext, bookingId: string): Promise<RenderedDocument> {
    const booking = await this.operations.getBooking(ctx, bookingId);
    const enquiry = await this.enquiries.getById(ctx, booking.enquiryId);
    const org = await this.orgs.getCurrent(ctx);

    const bodyHtml = [
      header(org, `Service Voucher — Booking ${escapeHtml(booking.id)}`),
      `<p class="muted">Status: ${escapeHtml(booking.status)} · Quote ${escapeHtml(booking.quoteId)}</p>`,
      enquirySummary(enquiry),
      voucherItems(booking.items),
      `<p class="muted">Please present this voucher to the service provider on arrival.</p>`,
    ].join('\n');

    return this.renderer.render(
      { title: `Voucher ${booking.id}`, bodyHtml },
      `voucher-${booking.id}`,
    );
  }

  /** Client-facing quote + itinerary document (sell-side only). */
  async clientQuoteDocument(ctx: TenantContext, quoteId: string): Promise<RenderedDocument> {
    const quote = await this.quotation.getById(ctx, quoteId);
    const enquiry = await this.enquiries.getById(ctx, quote.enquiryId);
    const org = await this.orgs.getCurrent(ctx);
    const itineraries = await this.itineraries.listByEnquiry(ctx, quote.enquiryId);
    const latest = itineraries[itineraries.length - 1];

    const bodyHtml = [
      header(org, `Quote ${escapeHtml(quote.id)} — v${quote.version}`),
      enquirySummary(enquiry),
      latest ? itinerarySection(latest) : '',
      sellPricing(quote.currency, quote.sell),
      `<p class="muted">Status: ${escapeHtml(quote.status)}</p>`,
    ].join('\n');

    return this.renderer.render({ title: `Quote ${quote.id}`, bodyHtml }, `quote-${quote.id}`);
  }

  /** Owner-only internal costing sheet (cost + margin breakdown). */
  async costingSheet(ctx: TenantContext, quoteId: string): Promise<RenderedDocument> {
    if (!canSeeMargins(ctx)) {
      throw new ForbiddenError('Only an Owner may view the costing sheet');
    }
    const quote = await this.quotation.getById(ctx, quoteId);
    const org = await this.orgs.getCurrent(ctx);
    if (!quote.margin) {
      throw new ForbiddenError('Costing data unavailable for this role');
    }

    const bodyHtml = [
      header(org, `Costing sheet — Quote ${escapeHtml(quote.id)} (v${quote.version})`),
      `<p class="muted">OWNER ONLY — contains net cost and margin.</p>`,
      marginTable(quote.margin),
    ].join('\n');

    return this.renderer.render(
      { title: `Costing sheet ${quote.id}`, bodyHtml },
      `costing-${quote.id}`,
    );
  }
}

// --------------------------------------------------------------------------
// HTML fragment builders (all values escaped)
// --------------------------------------------------------------------------

function header(org: Organization, subtitle: string): string {
  return `<h1>${escapeHtml(org.name)}</h1><h2>${subtitle}</h2>`;
}

function enquirySummary(enquiry: Enquiry): string {
  const pax = enquiry.pax;
  return `<h2>Enquiry</h2>
<table>
  <tr><th>Agency</th><td>${escapeHtml(enquiry.agencyId)}</td></tr>
  <tr><th>Destinations</th><td>${escapeHtml(enquiry.destinations.join(', '))}</td></tr>
  <tr><th>Pax</th><td>${pax.adults} adult(s), ${pax.children.length} child(ren), ${pax.infants} infant(s)</td></tr>
  <tr><th>Quote deadline</th><td>${escapeHtml(enquiry.quoteDeadline)}</td></tr>
</table>`;
}

function voucherItems(items: BookingItem[]): string {
  const bySupplier = new Map<string, BookingItem[]>();
  for (const it of items) {
    const key = it.supplierName ?? 'Unassigned';
    const list = bySupplier.get(key) ?? [];
    list.push(it);
    bySupplier.set(key, list);
  }
  return [...bySupplier.entries()]
    .map(([supplier, list]) => {
      const rows = list
        .map(
          (i) =>
            `<tr><td>${escapeHtml(i.description)}</td><td>${escapeHtml(i.status)}</td>` +
            `<td>${escapeHtml(i.confirmationRef ?? '—')}</td></tr>`,
        )
        .join('');
      return `<h3>${escapeHtml(supplier)}</h3>
<table><tr><th>Service</th><th>Status</th><th>Confirmation ref</th></tr>${rows}</table>`;
    })
    .join('\n');
}

function itinerarySection(itinerary: Itinerary): string {
  const days = itinerary.days
    .map((d) => {
      const rows = d.segments
        .map(
          (s) =>
            `<tr><td>${escapeHtml(time(s.startTime, s.endTime))}</td><td>${escapeHtml(s.type)}</td>` +
            `<td>${escapeHtml(s.description)}</td><td>${escapeHtml(s.bookingStatus)}</td></tr>`,
        )
        .join('');
      return `<h3>Day ${d.dayNumber} — ${escapeHtml(d.date)}: ${escapeHtml(d.headline)}</h3>
<table><tr><th>Time</th><th>Type</th><th>Description</th><th>Status</th></tr>${rows}</table>`;
    })
    .join('\n');
  return `<h2>Itinerary${itinerary.title ? ` — ${escapeHtml(itinerary.title)}` : ''}</h2>${days}`;
}

function time(start?: string, end?: string): string {
  if (start && end) return `${start}–${end}`;
  return start ?? end ?? '';
}

interface SellLike {
  includedSubtotal: Money;
  taxes: Array<{ label: string; percent: number; amount: Money }>;
  total: Money;
  perPax: Money;
  optionalItems: Array<{ lineId: string; description: string; sell: Money }>;
}

function sellPricing(currency: string, sell: SellLike): string {
  const taxRows = sell.taxes
    .map(
      (t) =>
        `<tr><td>${escapeHtml(t.label)} (${t.percent}%)</td><td>${formatMoney(t.amount)}</td></tr>`,
    )
    .join('');
  const optional = sell.optionalItems.length
    ? `<h3>Optional add-ons</h3><table><tr><th>Item</th><th>Price</th></tr>${sell.optionalItems
        .map((o) => `<tr><td>${escapeHtml(o.description)}</td><td>${formatMoney(o.sell)}</td></tr>`)
        .join('')}</table>`
    : '';
  return `<h2>Price (${escapeHtml(currency)})</h2>
<table>
  <tr><td>Included subtotal</td><td>${formatMoney(sell.includedSubtotal)}</td></tr>
  ${taxRows}
  <tr class="total"><td>Total</td><td>${formatMoney(sell.total)}</td></tr>
  <tr><td>Per person</td><td>${formatMoney(sell.perPax)}</td></tr>
</table>
${optional}`;
}

interface MarginLike {
  totalCost: Money;
  totalSell: Money;
  totalMargin: Money;
  marginPercent: number;
  lines: Array<{
    description: string;
    costQuoteCcy: Money;
    markupPercent: number;
    sell: Money;
    margin: Money;
  }>;
}

function marginTable(margin: MarginLike): string {
  const rows = margin.lines
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.description)}</td><td>${formatMoney(l.costQuoteCcy)}</td>` +
        `<td>${l.markupPercent}%</td><td>${formatMoney(l.sell)}</td><td>${formatMoney(l.margin)}</td></tr>`,
    )
    .join('');
  return (
    `<h2>Cost &amp; margin</h2>
<table>
  <tr><th>Component</th><th>Net cost</th><th>Markup</th><th>Sell</th><th>Margin</th></tr>
  ${rows}
  <tr class="total"><td>Totals</td><td>${formatMoney(margin.totalCost)}</td><td>—</td>` +
    `<td>${formatMoney(margin.totalSell)}</td><td>${formatMoney(margin.totalMargin)}</td></tr>
</table>
<p>Overall margin: <strong>${margin.marginPercent.toFixed(2)}%</strong></p>`
  );
}
