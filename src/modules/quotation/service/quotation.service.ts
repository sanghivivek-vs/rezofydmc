/**
 * Quotation service (Build guide §4, §5) — the orchestration that turns an
 * enquiry + selected components into a priced, versioned Quote.
 *
 * It composes the bounded contexts through their service interfaces only
 * (Build guide §4): enquiry pax from Enquiry Intake, costing defaults from
 * Identity/Org, rates from Catalog, and the pure Costing engine to price.
 *
 * Owner-only margin data is gated here, at the service boundary (Build guide §9),
 * never merely hidden in the UI.
 */

import { type TenantContext, canSeeMargins } from '@common/tenancy/tenant-context';
import { BusinessRuleError, ValidationError } from '@common/errors/errors';
import type { Clock } from '@common/clock/clock';
import type { IdGenerator } from '@common/ids/id';
import type { AuditSink } from '@common/audit/audit-log';
import { NullAuditSink } from '@common/audit/audit-log';
import {
  type OutboundPublisher,
  NullOutboundPublisher,
  toWireMoney,
} from '@common/integration/outbound';
import {
  priceQuote,
  isWithinValidity,
  type Rate as CostingRate,
  type CostLineInput,
  type MarkupRules,
  type FxTable,
  type PaxBreakdown,
} from '@modules/costing';
import { EnquiryService, type Enquiry } from '@modules/enquiry-intake';
import { CatalogService } from '@modules/catalog';
import { OrgService } from '@modules/identity-org';
import { type CreateQuoteInput, type Quote, type QuoteView } from '../domain/quote';
import type { QuoteRepository } from '../repository/quote.repository';

export interface QuotationServiceDeps {
  readonly quotes: QuoteRepository;
  readonly enquiries: EnquiryService;
  readonly catalog: CatalogService;
  readonly orgs: OrgService;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly audit?: AuditSink;
  readonly publisher?: OutboundPublisher;
}

export class QuotationService {
  private readonly quotes: QuoteRepository;
  private readonly enquiries: EnquiryService;
  private readonly catalog: CatalogService;
  private readonly orgs: OrgService;
  private readonly clock: Clock;
  private readonly newId: IdGenerator;
  private readonly audit: AuditSink;
  private readonly publisher: OutboundPublisher;

  constructor(deps: QuotationServiceDeps) {
    this.quotes = deps.quotes;
    this.enquiries = deps.enquiries;
    this.catalog = deps.catalog;
    this.orgs = deps.orgs;
    this.clock = deps.clock;
    this.newId = deps.idGenerator;
    this.audit = deps.audit ?? new NullAuditSink();
    this.publisher = deps.publisher ?? new NullOutboundPublisher();
  }

  async createQuote(ctx: TenantContext, input: CreateQuoteInput): Promise<QuoteView> {
    if (!input.lines || input.lines.length === 0) {
      throw new ValidationError('A quote needs at least one line');
    }
    const enquiry = await this.enquiries.getById(ctx, input.enquiryId);
    const org = await this.orgs.getCurrent(ctx);
    const quoteCurrency = (input.quoteCurrency ?? org.settings.defaultCurrency).toUpperCase();

    // Build markup rules: org default, with per-line component overrides.
    const byComponent: Record<string, number> = {};
    const costLines: CostLineInput[] = [];

    for (const line of input.lines) {
      const component = await this.catalog.getComponent(ctx, line.componentId);
      const rates = await this.catalog.listCostingRates(ctx, line.componentId);
      const rate = selectRate(rates, line.travelDate, line.rateId, component.id);

      if (line.markupPercentOverride !== undefined) {
        byComponent[component.id] = line.markupPercentOverride;
      }

      costLines.push({
        lineId: this.newId('line'),
        componentId: component.id,
        componentType: component.type,
        description: line.description ?? component.name,
        rate,
        inclusion: line.inclusion,
        travelDate: line.travelDate,
        units: line.units,
      });
    }

    const markup: MarkupRules = {
      orgDefaultPercent: org.settings.defaultMarkupPercent,
      byComponent,
    };
    const fx: FxTable = { quoteCurrency, rates: input.fxRates ?? {} };
    const pax: PaxBreakdown = enquiry.pax;

    const result = priceQuote({
      pax,
      lines: costLines,
      markup,
      fx,
      taxes: input.taxes,
      rounding: input.rounding,
    });

    const now = this.clock();
    const quote: Quote = {
      id: this.newId('quote'),
      orgId: ctx.orgId,
      enquiryId: enquiry.id,
      version: (await this.quotes.latestVersion(ctx, enquiry.id)) + 1,
      status: 'Draft',
      currency: quoteCurrency,
      sell: result.sell,
      margin: result.margin,
      createdBy: ctx.userId,
      createdAt: now,
    };
    const saved = await this.quotes.create(ctx, quote);

    await this.audit.record({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: 'quote.created',
      subject: { type: 'Quote', id: saved.id },
      after: { version: saved.version, total: saved.sell.total, status: saved.status },
      at: now,
      requestId: ctx.requestId,
    });

    return this.redactForRole(ctx, saved);
  }

  async getById(ctx: TenantContext, id: string): Promise<QuoteView> {
    return this.redactForRole(ctx, await this.loadQuote(ctx, id));
  }

  /**
   * Send a quote to the agency: mark it Sent and emit the signed outbound
   * `quote.sent` webhook (Build guide §6). Only a Draft or Under-Revision quote
   * can be sent. Only the sell-side view is shared — never the margin view.
   */
  async sendQuote(ctx: TenantContext, id: string): Promise<QuoteView> {
    const quote = await this.loadQuote(ctx, id);
    if (quote.status !== 'Draft' && quote.status !== 'Under Revision') {
      throw new BusinessRuleError(`Quote ${id} cannot be sent from status "${quote.status}"`, {
        status: quote.status,
      });
    }
    const enquiry = await this.enquiries.getById(ctx, quote.enquiryId);
    const now = this.clock();
    const sent: Quote = { ...quote, status: 'Sent' };
    const saved = await this.quotes.save(ctx, sent);

    await this.publisher.publish(
      'quote.sent',
      mapQuoteSent(saved, enquiry),
      `${saved.id}:sent`,
      now,
    );
    await this.audit.record({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: 'quote.sent',
      subject: { type: 'Quote', id: saved.id },
      before: { status: quote.status },
      after: { status: 'Sent' },
      at: now,
      requestId: ctx.requestId,
    });
    return this.redactForRole(ctx, saved);
  }

  private async loadQuote(ctx: TenantContext, id: string): Promise<Quote> {
    const quote = await this.quotes.findById(ctx, id);
    if (!quote) {
      throw new BusinessRuleError(`Quote ${id} not found`, { id });
    }
    return quote;
  }

  async listByEnquiry(ctx: TenantContext, enquiryId: string): Promise<QuoteView[]> {
    const quotes = await this.quotes.listByEnquiry(ctx, enquiryId);
    return quotes.map((q) => this.redactForRole(ctx, q));
  }

  /** Strip the owner-only margin view for roles that may not see margins. */
  private redactForRole(ctx: TenantContext, quote: Quote): QuoteView {
    if (canSeeMargins(ctx)) return quote;
    const { margin: _margin, ...sellOnly } = quote;
    return sellOnly;
  }
}

/**
 * Map a sent quote to the outbound `quote.sent` payload
 * (docs/integration/outbound/quote.sent.schema.json). Sell-side only — the
 * margin view is never shared. pricing_model defaults to per_pax pending
 * decision #9.
 */
export function mapQuoteSent(quote: Quote, enquiry: Enquiry): Record<string, unknown> {
  const sell = quote.sell;
  return {
    quote_external_id: quote.id,
    enquiry_external_id: enquiry.enquiryExternalId ?? enquiry.id,
    agency_id: enquiry.agencyId,
    version_number: quote.version,
    currency: quote.currency,
    pricing_model: 'per_pax',
    included_subtotal: toWireMoney(sell.includedSubtotal),
    taxes: sell.taxes.map((t) => ({
      label: t.label,
      percent: t.percent,
      amount: toWireMoney(t.amount),
    })),
    total: toWireMoney(sell.total),
    per_pax: toWireMoney(sell.perPax),
    line_items: sell.optionalItems.map((o) => ({
      line_id: o.lineId,
      description: o.description,
      inclusion: 'optional',
      sell: toWireMoney(o.sell),
    })),
    status: quote.status,
  };
}

/**
 * Pick the applicable rate for a component: a pinned rateId if given, else the
 * rate whose validity window covers the travel date. Slab/child resolution
 * happens inside the engine using the group size.
 */
export function selectRate(
  rates: CostingRate[],
  travelDate: string,
  rateId: string | undefined,
  componentId: string,
): CostingRate {
  if (rateId) {
    const pinned = rates.find((r) => r.rateId === rateId);
    if (!pinned) {
      throw new BusinessRuleError(`Rate ${rateId} not found for component ${componentId}`, {
        componentId,
        rateId,
      });
    }
    return pinned;
  }
  const valid = rates.filter((r) => isWithinValidity(r, travelDate));
  if (valid.length === 0) {
    throw new BusinessRuleError(`No rate for component ${componentId} is valid on ${travelDate}`, {
      componentId,
      travelDate,
    });
  }
  return valid[0];
}
