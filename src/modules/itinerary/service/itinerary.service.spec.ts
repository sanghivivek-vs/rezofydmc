import { ItineraryService } from './itinerary.service';
import { InMemoryItineraryRepository } from '../repository/itinerary.repository';
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
import { BusinessRuleError, NotFoundError } from '@common/errors/errors';
import type { AuditEvent, AuditSink } from '@common/audit/audit-log';
import type { TenantContext } from '@common/tenancy/tenant-context';

class CapturingAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];
  async record(e: AuditEvent): Promise<void> {
    this.events.push(e);
  }
}

const clock = fixedClock('2026-06-28T10:00:00.000Z');

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
  const audit = new CapturingAuditSink();
  const service = new ItineraryService({
    repository: new InMemoryItineraryRepository(),
    enquiries,
    catalog,
    orgs,
    clock,
    idGenerator: sequentialIdGenerator(),
    audit,
  });

  const org = await orgs.create({ name: 'Alpine', defaultCurrency: 'CHF' });
  const ctx: TenantContext = { orgId: org.id, userId: 'u1', role: 'Ops' };
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
    name: 'Jungfraujoch',
    unitBasis: 'per_pax',
  });
  return { service, ctx, enquiry, component, audit };
}

describe('ItineraryService', () => {
  it('builds a versioned itinerary with a timed, component-linked segment', async () => {
    const { service, ctx, enquiry, component } = await setup();
    const itinerary = await service.create(ctx, { enquiryId: enquiry.id, title: 'Swiss Tour' });
    expect(itinerary.version).toBe(1);

    await service.addDay(ctx, itinerary.id, {
      dayNumber: 1,
      date: '2026-07-01',
      headline: 'Interlaken → Jungfraujoch',
    });
    const built = await service.addSegment(ctx, itinerary.id, 1, {
      startTime: '08:30',
      endTime: '16:00',
      type: 'Excursion',
      description: 'Top of Europe excursion',
      componentId: component.id,
      bookingStatus: 'Confirmed',
      supplier: 'Jungfrau Railways',
    });

    const seg = built.days[0].segments[0];
    expect(seg).toMatchObject({
      type: 'Excursion',
      startTime: '08:30',
      endTime: '16:00',
      componentId: component.id,
      bookingStatus: 'Confirmed',
    });
  });

  it('defaults booking status to the first org status and validates the set', async () => {
    const { service, ctx, enquiry } = await setup();
    const itin = await service.create(ctx, { enquiryId: enquiry.id });
    await service.addDay(ctx, itin.id, { dayNumber: 1, date: '2026-07-01', headline: 'Day 1' });

    const withDefault = await service.addSegment(ctx, itin.id, 1, {
      type: 'FreeTime',
      description: 'Leisure',
    });
    expect(withDefault.days[0].segments[0].bookingStatus).toBe('Confirmed'); // first default

    await expect(
      service.addSegment(ctx, itin.id, 1, {
        type: 'Meal',
        description: 'Dinner',
        bookingStatus: 'Bogus',
      }),
    ).rejects.toThrow(/not configured/);
  });

  it('validates times, day existence, and component links', async () => {
    const { service, ctx, enquiry } = await setup();
    const itin = await service.create(ctx, { enquiryId: enquiry.id });
    await service.addDay(ctx, itin.id, { dayNumber: 1, date: '2026-07-01', headline: 'Day 1' });

    await expect(
      service.addSegment(ctx, itin.id, 1, {
        type: 'Transfer',
        description: 'x',
        startTime: '18:00',
        endTime: '09:00',
      }),
    ).rejects.toThrow(/on or before/);

    await expect(
      service.addSegment(ctx, itin.id, 9, { type: 'Transfer', description: 'x' }),
    ).rejects.toThrow(NotFoundError);

    await expect(
      service.addSegment(ctx, itin.id, 1, {
        type: 'Sightseeing',
        description: 'x',
        componentId: 'missing',
      }),
    ).rejects.toThrow(NotFoundError);

    await expect(
      service.addDay(ctx, itin.id, { dayNumber: 1, date: '2026-07-02', headline: 'dup' }),
    ).rejects.toThrow(BusinessRuleError);
  });

  it('updates a segment status and audits the change', async () => {
    const { service, ctx, enquiry, audit } = await setup();
    const itin = await service.create(ctx, { enquiryId: enquiry.id });
    await service.addDay(ctx, itin.id, { dayNumber: 1, date: '2026-07-01', headline: 'Day 1' });
    const built = await service.addSegment(ctx, itin.id, 1, {
      type: 'Meal',
      description: 'Dinner',
      bookingStatus: 'Pending',
    });
    const segId = built.days[0].segments[0].id;

    const updated = await service.updateSegmentStatus(ctx, itin.id, segId, 'Confirmed');
    expect(updated.days[0].segments[0].bookingStatus).toBe('Confirmed');

    const statusEvents = audit.events.filter((e) => e.action === 'segment.status_changed');
    expect(statusEvents).toHaveLength(1);
    expect(statusEvents[0]).toMatchObject({
      before: { bookingStatus: 'Pending' },
      after: { bookingStatus: 'Confirmed' },
    });

    await expect(service.updateSegmentStatus(ctx, itin.id, 'nope', 'Confirmed')).rejects.toThrow(
      NotFoundError,
    );
  });

  it('rejects building on a missing enquiry', async () => {
    const { service, ctx } = await setup();
    await expect(service.create(ctx, { enquiryId: 'nope' })).rejects.toThrow(NotFoundError);
  });
});
