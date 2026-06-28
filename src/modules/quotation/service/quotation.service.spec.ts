import { QuotationService, selectRate } from './quotation.service';
import { InMemoryQuoteRepository } from '../repository/quote.repository';
import { EnquiryService, InMemoryEnquiryRepository } from '@modules/enquiry-intake';
import {
  CatalogService,
  InMemorySupplierRepository,
  InMemoryComponentRepository,
  InMemoryRateRepository,
} from '@modules/catalog';
import { OrgService, InMemoryOrgRepository } from '@modules/identity-org';
import { fixedClock } from '@common/clock/clock';
import { sequentialIdGenerator } from '@common/ids/id';
import { money } from '@common/money/money';
import { BusinessRuleError, ValidationError } from '@common/errors/errors';
import type { TenantContext } from '@common/tenancy/tenant-context';
import type { OutboundPublisher } from '@common/integration/outbound';
import type { CostLineInput, Rate as CostingRate } from '@modules/costing';

const clock = fixedClock('2026-06-28T10:00:00.000Z');

class CapturingPublisher implements OutboundPublisher {
  readonly published: Array<{ event: string; data: Record<string, unknown>; key: string }> = [];
  async publish(event: string, data: Record<string, unknown>, key: string): Promise<void> {
    this.published.push({ event, data, key });
  }
}

async function setup() {
  const orgs = new OrgService({
    repository: new InMemoryOrgRepository(),
    clock,
    idGenerator: sequentialIdGenerator(),
  });
  const enquiries = new EnquiryService({
    repository: new InMemoryEnquiryRepository(),
    clock,
    idGenerator: sequentialIdGenerator(),
  });
  const catalog = new CatalogService({
    suppliers: new InMemorySupplierRepository(),
    components: new InMemoryComponentRepository(),
    rates: new InMemoryRateRepository(),
    clock,
    idGenerator: sequentialIdGenerator(),
  });
  const publisher = new CapturingPublisher();
  const quotation = new QuotationService({
    quotes: new InMemoryQuoteRepository(),
    enquiries,
    catalog,
    orgs,
    clock,
    idGenerator: sequentialIdGenerator(),
    publisher,
  });

  const org = await orgs.create({
    name: 'Alpine DMC',
    defaultCurrency: 'CHF',
    defaultMarkupPercent: 20,
  });
  const owner: TenantContext = { orgId: org.id, userId: 'owner', role: 'Owner' };
  const sales: TenantContext = { orgId: org.id, userId: 'sally', role: 'Sales' };

  const enquiry = await enquiries.createManual(owner, {
    agencyId: 'AG-1',
    destinations: ['Switzerland'],
    pax: { adults: 2, children: [], infants: 0 },
    quoteDeadline: '2026-06-15T00:00:00Z',
  });

  const supplier = await catalog.createSupplier(owner, { name: 'Jungfrau', currency: 'CHF' });
  const component = await catalog.createComponent(owner, {
    type: 'Ticket',
    supplierId: supplier.id,
    name: 'Jungfraujoch ticket',
    unitBasis: 'per_pax',
  });
  await catalog.addRate(owner, {
    componentId: component.id,
    net: money(10000, 'CHF'),
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
  });

  return { quotation, owner, sales, enquiry, component, publisher };
}

describe('QuotationService.createQuote', () => {
  it('prices an enquiry from catalog rates using the org default markup', async () => {
    const { quotation, owner, enquiry, component } = await setup();
    const quote = await quotation.createQuote(owner, {
      enquiryId: enquiry.id,
      lines: [{ componentId: component.id, travelDate: '2026-07-01', inclusion: 'included' }],
    });

    // 10000 * 2 pax = 20000 cost; +20% = 24000 sell; perPax = 12000.
    expect(quote.currency).toBe('CHF');
    expect(quote.version).toBe(1);
    expect(quote.status).toBe('Draft');
    expect(quote.sell.total).toEqual(money(24000, 'CHF'));
    expect(quote.sell.perPax).toEqual(money(12000, 'CHF'));
  });

  it('shows the margin view to an Owner but hides it from Sales', async () => {
    const { quotation, owner, sales, enquiry, component } = await setup();
    const line = {
      componentId: component.id,
      travelDate: '2026-07-01',
      inclusion: 'included' as const,
    };

    const ownerQuote = await quotation.createQuote(owner, { enquiryId: enquiry.id, lines: [line] });
    expect(ownerQuote.margin).toBeDefined();
    expect(ownerQuote.margin?.totalMargin).toEqual(money(4000, 'CHF')); // 24000 - 20000

    const salesQuote = await quotation.createQuote(sales, { enquiryId: enquiry.id, lines: [line] });
    expect(salesQuote.margin).toBeUndefined();
    expect(salesQuote.sell.total).toEqual(money(24000, 'CHF')); // sell still visible
  });

  it('increments the version per enquiry', async () => {
    const { quotation, owner, enquiry, component } = await setup();
    const line = {
      componentId: component.id,
      travelDate: '2026-07-01',
      inclusion: 'included' as const,
    };
    const v1 = await quotation.createQuote(owner, { enquiryId: enquiry.id, lines: [line] });
    const v2 = await quotation.createQuote(owner, { enquiryId: enquiry.id, lines: [line] });
    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
  });

  it('applies a per-line markup override (component precedence)', async () => {
    const { quotation, owner, enquiry, component } = await setup();
    const quote = await quotation.createQuote(owner, {
      enquiryId: enquiry.id,
      lines: [
        {
          componentId: component.id,
          travelDate: '2026-07-01',
          inclusion: 'included',
          markupPercentOverride: 50,
        },
      ],
    });
    // 20000 cost * 1.5 = 30000
    expect(quote.sell.total).toEqual(money(30000, 'CHF'));
  });

  it('sends a draft quote: marks it Sent and emits quote.sent (sell-side only)', async () => {
    const { quotation, owner, enquiry, component, publisher } = await setup();
    const created = await quotation.createQuote(owner, {
      enquiryId: enquiry.id,
      lines: [{ componentId: component.id, travelDate: '2026-07-01', inclusion: 'included' }],
    });

    const sent = await quotation.sendQuote(owner, created.id);
    expect(sent.status).toBe('Sent');

    const event = publisher.published.find((p) => p.event === 'quote.sent');
    expect(event).toBeDefined();
    expect(event?.key).toBe(`${created.id}:sent`);
    expect(event?.data).toMatchObject({
      quote_external_id: created.id,
      agency_id: 'AG-1',
      currency: 'CHF',
      total: { amount_minor: 24000, currency: 'CHF' },
    });
    // The outbound payload carries no margin data.
    expect(JSON.stringify(event?.data)).not.toContain('totalMargin');

    // Re-sending an already-Sent quote is rejected.
    await expect(quotation.sendQuote(owner, created.id)).rejects.toThrow(BusinessRuleError);
  });

  it('rejects an empty line set and an out-of-season travel date', async () => {
    const { quotation, owner, enquiry, component } = await setup();
    await expect(
      quotation.createQuote(owner, { enquiryId: enquiry.id, lines: [] }),
    ).rejects.toThrow(ValidationError);
    await expect(
      quotation.createQuote(owner, {
        enquiryId: enquiry.id,
        lines: [{ componentId: component.id, travelDate: '2030-01-01', inclusion: 'included' }],
      }),
    ).rejects.toThrow(BusinessRuleError);
  });
});

describe('selectRate', () => {
  const mk = (rateId: string, from: string, to: string): CostingRate => ({
    rateId,
    componentId: 'c1',
    unitBasis: 'per_pax',
    net: money(100, 'CHF'),
    validFrom: from,
    validTo: to,
  });

  it('picks the rate whose validity covers the travel date', () => {
    const rates = [
      mk('summer', '2026-06-01', '2026-09-30'),
      mk('winter', '2026-12-01', '2027-02-28'),
    ];
    expect(selectRate(rates, '2026-07-15', undefined, 'c1').rateId).toBe('summer');
    expect(selectRate(rates, '2027-01-10', undefined, 'c1').rateId).toBe('winter');
  });

  it('honours a pinned rateId', () => {
    const rates = [mk('a', '2026-01-01', '2026-12-31'), mk('b', '2026-01-01', '2026-12-31')];
    expect(selectRate(rates, '2026-07-01', 'b', 'c1').rateId).toBe('b');
  });

  it('throws when nothing is valid or the pin is unknown', () => {
    const rates = [mk('a', '2026-01-01', '2026-12-31')];
    expect(() => selectRate(rates, '2030-01-01', undefined, 'c1')).toThrow(BusinessRuleError);
    expect(() => selectRate(rates, '2026-07-01', 'nope', 'c1')).toThrow(BusinessRuleError);
  });
});

// Ensure the bridged line shape is exactly what the engine consumes.
const _typecheck: CostLineInput | undefined = undefined;
void _typecheck;
