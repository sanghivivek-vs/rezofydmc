import { OperationsService } from './operations.service';
import { InMemoryBookingRepository } from '../repository/booking.repository';
import { QuotationService, InMemoryQuoteRepository } from '@modules/quotation';
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
import type { TenantContext } from '@common/tenancy/tenant-context';

const clock = fixedClock('2026-06-28T10:00:00.000Z');

async function setup() {
  const id = () => sequentialIdGenerator();
  const orgs = new OrgService({
    repository: new InMemoryOrgRepository(),
    clock,
    idGenerator: id(),
  });
  const enquiries = new EnquiryService({
    repository: new InMemoryEnquiryRepository(),
    clock,
    idGenerator: id(),
  });
  const catalog = new CatalogService({
    suppliers: new InMemorySupplierRepository(),
    components: new InMemoryComponentRepository(),
    rates: new InMemoryRateRepository(),
    clock,
    idGenerator: id(),
  });
  const quotation = new QuotationService({
    quotes: new InMemoryQuoteRepository(),
    enquiries,
    catalog,
    orgs,
    clock,
    idGenerator: id(),
  });
  const ops = new OperationsService({
    bookings: new InMemoryBookingRepository(),
    quotation,
    catalog,
    enquiries,
    clock,
    idGenerator: id(),
  });

  const org = await orgs.create({
    name: 'Alpine',
    defaultCurrency: 'CHF',
    defaultMarkupPercent: 20,
  });
  const ctx: TenantContext = { orgId: org.id, userId: 'owner', role: 'Owner' };

  const enquiry = await enquiries.createManual(ctx, {
    agencyId: 'AG-1',
    destinations: ['Switzerland'],
    pax: { adults: 2, children: [], infants: 0 },
    quoteDeadline: '2026-06-15T00:00:00Z',
  });
  const supplier = await catalog.createSupplier(ctx, { name: 'Jungfrau', currency: 'CHF' });
  const component = await catalog.createComponent(ctx, {
    type: 'Ticket',
    supplierId: supplier.id,
    name: 'Jungfraujoch ticket',
    unitBasis: 'per_pax',
  });
  await catalog.addRate(ctx, {
    componentId: component.id,
    net: money(10000, 'CHF'),
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
  });
  const quote = await quotation.createQuote(ctx, {
    enquiryId: enquiry.id,
    lines: [{ componentId: component.id, travelDate: '2026-07-01', inclusion: 'included' }],
  });
  // Move the enquiry to Quoted so acceptance can advance it to Won.
  await enquiries.changeStatus(ctx, enquiry.id, 'In Progress');
  await enquiries.changeStatus(ctx, enquiry.id, 'Quoted');

  return { ops, quotation, enquiries, ctx, enquiry, quote };
}

describe('OperationsService', () => {
  it('accepts a quote: creates a booking, marks the quote Accepted, enquiry Won', async () => {
    const { ops, quotation, enquiries, ctx, enquiry, quote } = await setup();
    const booking = await ops.acceptQuote(ctx, quote.id);

    expect(booking.status).toBe('Confirming');
    expect(booking.items).toHaveLength(1);
    expect(booking.items[0]).toMatchObject({ supplierName: 'Jungfrau', status: 'Pending' });
    expect((await quotation.getById(ctx, quote.id)).status).toBe('Accepted');
    expect((await enquiries.getById(ctx, enquiry.id)).status).toBe('Won');
  });

  it('is idempotent — re-accepting returns the same booking', async () => {
    const { ops, ctx, quote } = await setup();
    const a = await ops.acceptQuote(ctx, quote.id);
    const b = await ops.acceptQuote(ctx, quote.id);
    expect(b.id).toBe(a.id);
  });

  it('confirms items and flips the booking to Confirmed when all are confirmed', async () => {
    const { ops, ctx, quote } = await setup();
    const booking = await ops.acceptQuote(ctx, quote.id);
    const updated = await ops.confirmItem(ctx, booking.id, booking.items[0].id, 'SUP-REF-1');
    expect(updated.items[0]).toMatchObject({ status: 'Confirmed', confirmationRef: 'SUP-REF-1' });
    expect(updated.status).toBe('Confirmed');
  });

  it('derives supplier POs grouped by supplier', async () => {
    const { ops, ctx, quote } = await setup();
    const booking = await ops.acceptQuote(ctx, quote.id);
    const pos = await ops.supplierPOs(ctx, booking.id);
    expect(pos).toHaveLength(1);
    expect(pos[0]).toMatchObject({ supplierName: 'Jungfrau', bookingId: booking.id });
    expect(pos[0].items).toHaveLength(1);
  });

  it('rejects a quote and moves the enquiry to Lost', async () => {
    const { ops, quotation, enquiries, ctx, enquiry, quote } = await setup();
    await ops.rejectQuote(ctx, quote.id);
    expect((await quotation.getById(ctx, quote.id)).status).toBe('Rejected');
    expect((await enquiries.getById(ctx, enquiry.id)).status).toBe('Lost');
  });

  it('reports the pipeline by enquiry status', async () => {
    const { ops, ctx, quote } = await setup();
    await ops.acceptQuote(ctx, quote.id);
    const report = await ops.pipelineReport(ctx);
    expect(report.total).toBe(1);
    expect(report.won).toBe(1);
    expect(report.byStatus.Won).toBe(1);
  });
});
