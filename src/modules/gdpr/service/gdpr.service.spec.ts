import { GdprService } from './gdpr.service';
import { InMemoryConsentRepository } from '../repository/consent.repository';
import {
  UserService,
  OrgService,
  AuthService,
  InMemoryOrgRepository,
  InMemoryUserRepository,
} from '@modules/identity-org';
import { EnquiryService, InMemoryEnquiryRepository } from '@modules/enquiry-intake';
import { ItineraryService, InMemoryItineraryRepository } from '@modules/itinerary';
import {
  CatalogService,
  InMemorySupplierRepository,
  InMemoryComponentRepository,
  InMemoryRateRepository,
} from '@modules/catalog';
import { fixedClock } from '@common/clock/clock';
import { sequentialIdGenerator } from '@common/ids/id';
import type { AuditEvent, AuditSink } from '@common/audit/audit-log';
import type { TokenService, AuthClaims } from '@modules/identity-org';
import type { TenantContext } from '@common/tenancy/tenant-context';

class CapturingAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];
  async record(e: AuditEvent): Promise<void> {
    this.events.push(e);
  }
}
class FakeTokens implements TokenService {
  sign(c: AuthClaims): string {
    return `${c.sub}`;
  }
  verify(): AuthClaims {
    return { sub: 'x', orgId: 'x', role: 'Owner' };
  }
}

async function setup() {
  const clock = fixedClock('2026-06-28T10:00:00.000Z');
  const id = () => sequentialIdGenerator();
  const orgs = new OrgService({
    repository: new InMemoryOrgRepository(),
    clock,
    idGenerator: id(),
  });
  const users = new UserService({
    repository: new InMemoryUserRepository(),
    clock,
    idGenerator: id(),
  });
  const auth = new AuthService(orgs, users, new FakeTokens());
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
  const itineraries = new ItineraryService({
    repository: new InMemoryItineraryRepository(),
    enquiries,
    catalog,
    orgs,
    clock,
    idGenerator: id(),
  });
  const audit = new CapturingAuditSink();
  const gdpr = new GdprService({
    users,
    enquiries,
    itineraries,
    consent: new InMemoryConsentRepository(),
    clock,
    idGenerator: id(),
    audit,
  });

  const reg = await auth.registerOrg({
    org: { name: 'Alpine', defaultCurrency: 'CHF' },
    owner: { email: 'owner@alpine.test', name: 'Owner', password: 'password123' },
  });
  const ctx: TenantContext = { orgId: reg.organization.id, userId: reg.owner.id, role: 'Owner' };

  const enquiry = await enquiries.createManual(ctx, {
    agencyId: 'AG-1',
    destinations: ['Switzerland'],
    pax: { adults: 2, children: [{ age: 8 }], infants: 0 },
    mealPreference: 'Jain',
    specialRequirements: 'Wheelchair for Mr X',
    quoteDeadline: '2026-06-15T00:00:00Z',
  });

  return { gdpr, users, enquiries, itineraries, ctx, enquiry, owner: reg.owner, audit };
}

describe('GdprService', () => {
  it('exports a user’s personal data and audits the access', async () => {
    const { gdpr, ctx, owner, audit } = await setup();
    const out = await gdpr.exportUser(ctx, owner.id);
    expect(out.subjectType).toBe('user');
    expect(out.data).toMatchObject({ email: 'owner@alpine.test', name: 'Owner' });
    expect(audit.events.some((e) => e.action === 'data.exported')).toBe(true);
  });

  it('exports traveller PII from an enquiry (special-category included)', async () => {
    const { gdpr, ctx, enquiry } = await setup();
    const out = await gdpr.exportEnquiry(ctx, enquiry.id);
    expect(out.subjectType).toBe('traveller');
    expect(out.data.enquiry).toMatchObject({
      mealPreference: 'Jain',
      specialRequirements: 'Wheelchair for Mr X',
    });
  });

  it('erases a user (anonymise in place) and audits it', async () => {
    const { gdpr, users, ctx, owner, audit } = await setup();
    await gdpr.eraseUser(ctx, owner.id);
    const after = await users.exportPersonalData(ctx, owner.id);
    expect(after.name).toBe('ERASED');
    expect(after.email).toContain('@erased.invalid');
    expect(after.status).toBe('disabled');
    expect(audit.events.some((e) => e.action === 'data.erased')).toBe(true);
  });

  it('erases enquiry traveller PII and itinerary notes', async () => {
    const { gdpr, enquiries, itineraries, ctx, enquiry } = await setup();
    const itin = await itineraries.create(ctx, { enquiryId: enquiry.id });
    await itineraries.addDay(ctx, itin.id, { dayNumber: 1, date: '2026-07-01', headline: 'D1' });
    await itineraries.addSegment(ctx, itin.id, 1, {
      type: 'Meal',
      description: 'Dinner',
      notes: 'Allergy: peanuts (Mr X)',
      bookingStatus: 'Pending',
    });

    await gdpr.eraseEnquiry(ctx, enquiry.id);

    const e = await enquiries.exportPersonalData(ctx, enquiry.id);
    expect(e.specialRequirements).toBeUndefined();
    expect(e.mealPreference).toBeUndefined();
    expect((e.pax as { children: unknown[] }).children).toEqual([]);

    const after = (await itineraries.getById(ctx, itin.id)).days[0].segments[0];
    expect(after.notes).toBeUndefined();
    expect(after.description).toBe('Dinner'); // operational data retained
  });

  it('records consent with a lawful basis', async () => {
    const { gdpr, ctx, enquiry } = await setup();
    const c = await gdpr.recordConsent(ctx, {
      subjectType: 'traveller',
      subjectRef: enquiry.id,
      purpose: 'Trip fulfilment',
      lawfulBasis: 'contract',
      granted: true,
    });
    expect(c.lawfulBasis).toBe('contract');
    expect(await gdpr.listConsent(ctx, enquiry.id)).toHaveLength(1);
  });

  it('retention sweep erases PII on old closed enquiries only', async () => {
    const { gdpr, enquiries, ctx, enquiry } = await setup();
    // Close the enquiry: New -> In Progress -> Lost.
    await enquiries.changeStatus(ctx, enquiry.id, 'In Progress');
    await enquiries.changeStatus(ctx, enquiry.id, 'Lost');

    // asOf far in the future so the (fixed-clock) updatedAt is well past retention.
    const result = await gdpr.retentionSweep(ctx, '2027-01-01T00:00:00.000Z', 30);
    expect(result.swept).toContain(enquiry.id);
    const e = await enquiries.exportPersonalData(ctx, enquiry.id);
    expect(e.specialRequirements).toBeUndefined();
  });
});
