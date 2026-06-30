import { DocumentService } from './document.service';
import { HtmlDocumentRenderer } from './document-renderer';
import { QuotationService, InMemoryQuoteRepository } from '@modules/quotation';
import { EnquiryService, InMemoryEnquiryRepository } from '@modules/enquiry-intake';
import {
  CatalogService,
  InMemorySupplierRepository,
  InMemoryComponentRepository,
  InMemoryRateRepository,
} from '@modules/catalog';
import { OrgService, InMemoryOrgRepository } from '@modules/identity-org';
import { ItineraryService, InMemoryItineraryRepository } from '@modules/itinerary';
import { OperationsService, InMemoryBookingRepository } from '@modules/operations';
import { fixedClock } from '@common/clock/clock';
import { sequentialIdGenerator } from '@common/ids/id';
import { money } from '@common/money/money';
import { ForbiddenError } from '@common/errors/errors';
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
  const itineraries = new ItineraryService({
    repository: new InMemoryItineraryRepository(),
    enquiries,
    catalog,
    orgs,
    clock,
    idGenerator: id(),
  });
  const operations = new OperationsService({
    bookings: new InMemoryBookingRepository(),
    quotation,
    catalog,
    enquiries,
    clock,
    idGenerator: id(),
  });
  const documents = new DocumentService({
    renderer: new HtmlDocumentRenderer(),
    quotation,
    enquiries,
    orgs,
    itineraries,
    operations,
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
  const quote = await quotation.createQuote(owner, {
    enquiryId: enquiry.id,
    lines: [{ componentId: component.id, travelDate: '2026-07-01', inclusion: 'included' }],
  });

  // Build an itinerary so the client doc includes it.
  const itin = await itineraries.create(owner, { enquiryId: enquiry.id, title: 'Swiss Tour' });
  await itineraries.addDay(owner, itin.id, {
    dayNumber: 1,
    date: '2026-07-01',
    headline: 'Jungfraujoch',
  });
  await itineraries.addSegment(owner, itin.id, 1, {
    type: 'Excursion',
    description: 'Top of Europe',
    bookingStatus: 'Confirmed',
  });

  return { documents, owner, sales, quote };
}

describe('DocumentService', () => {
  it('renders a client quote document with sell totals and the itinerary, no margin', async () => {
    const { documents, owner, quote } = await setup();
    const doc = await documents.clientQuoteDocument(owner, quote.id);
    expect(doc.contentType).toContain('text/html');
    expect(doc.body).toContain('Alpine DMC');
    expect(doc.body).toContain('240.00 CHF'); // total 24000 minor
    expect(doc.body).toContain('Top of Europe'); // itinerary segment
    expect(doc.body).not.toContain('Margin'); // sell-side only
  });

  it('renders an owner costing sheet with cost and margin', async () => {
    const { documents, owner, quote } = await setup();
    const doc = await documents.costingSheet(owner, quote.id);
    expect(doc.body).toContain('Cost &amp; margin');
    expect(doc.body).toContain('200.00 CHF'); // net cost 20000 minor
    expect(doc.body).toContain('40.00 CHF'); // margin 4000 minor
  });

  it('forbids a non-owner from the costing sheet', async () => {
    const { documents, sales, quote } = await setup();
    await expect(documents.costingSheet(sales, quote.id)).rejects.toThrow(ForbiddenError);
  });
});
