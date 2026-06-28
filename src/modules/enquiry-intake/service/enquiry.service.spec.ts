import { EnquiryService } from './enquiry.service';
import { InMemoryEnquiryRepository } from '../repository/in-memory-enquiry.repository';
import type { CreateEnquiryInput } from '../domain/enquiry';
import { fixedClock } from '@common/clock/clock';
import { sequentialIdGenerator } from '@common/ids/id';
import type { TenantContext } from '@common/tenancy/tenant-context';
import type { AuditEvent, AuditSink } from '@common/audit/audit-log';
import { NotFoundError } from '@common/errors/errors';

class CapturingAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];
  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}

const ORG_A: TenantContext = { orgId: 'org-A', userId: 'u-1', role: 'Sales', requestId: 'req-1' };
const ORG_B: TenantContext = { orgId: 'org-B', userId: 'u-9', role: 'Sales' };

function makeService(audit?: AuditSink) {
  return new EnquiryService({
    repository: new InMemoryEnquiryRepository(),
    clock: fixedClock('2026-06-28T10:00:00.000Z'),
    idGenerator: sequentialIdGenerator(),
    audit,
  });
}

const manualInput: CreateEnquiryInput = {
  agencyId: 'AG-1',
  destinations: ['Switzerland'],
  pax: { adults: 2, children: [], infants: 0 },
  quoteDeadline: '2026-06-15T00:00:00Z',
};

describe('EnquiryService.createManual', () => {
  it('creates a New, manually-sourced, tenant-scoped enquiry', async () => {
    const svc = makeService();
    const e = await svc.createManual(ORG_A, manualInput);
    expect(e).toMatchObject({
      id: 'enq_1',
      orgId: 'org-A',
      source: 'manual',
      status: 'New',
      agencyId: 'AG-1',
      createdAt: '2026-06-28T10:00:00.000Z',
      updatedAt: '2026-06-28T10:00:00.000Z',
    });
  });

  it('rejects an enquiry with no travellers', async () => {
    const svc = makeService();
    await expect(
      svc.createManual(ORG_A, { ...manualInput, pax: { adults: 0, children: [], infants: 0 } }),
    ).rejects.toThrow(/at least one traveller/);
  });

  it('emits a status audit event on creation', async () => {
    const audit = new CapturingAuditSink();
    const svc = makeService(audit);
    await svc.createManual(ORG_A, manualInput);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      orgId: 'org-A',
      actorId: 'u-1',
      action: 'enquiry.status_changed',
      after: { status: 'New' },
      requestId: 'req-1',
    });
  });
});

describe('EnquiryService.ingestInbound (idempotent upsert)', () => {
  const inbound = {
    enquiry_external_id: 'EXT-7',
    agency_id: 'AG-2',
    destinations: ['Switzerland'],
    pax: { adults: 3 },
    quote_deadline: '2026-06-20T00:00:00Z',
  };

  it('creates an integration-sourced enquiry on first delivery', async () => {
    const svc = makeService();
    const e = await svc.ingestInbound(ORG_A, inbound);
    expect(e).toMatchObject({
      orgId: 'org-A',
      source: 'integration',
      status: 'New',
      enquiryExternalId: 'EXT-7',
    });
  });

  it('updates details but preserves workflow status on re-delivery', async () => {
    const svc = makeService();
    const created = await svc.ingestInbound(ORG_A, inbound);
    // advance the enquiry's workflow
    await svc.changeStatus(ORG_A, created.id, 'In Progress');
    await svc.changeStatus(ORG_A, created.id, 'Quoted');

    // a re-sent RFQ with changed details
    const updated = await svc.ingestInbound(ORG_A, {
      ...inbound,
      destinations: ['Switzerland', 'Italy'],
    });

    expect(updated.id).toBe(created.id); // same row, not a duplicate
    expect(updated.destinations).toEqual(['Switzerland', 'Italy']); // detail updated
    expect(updated.status).toBe('Quoted'); // status NOT reset to New
    const all = await svc.list(ORG_A);
    expect(all).toHaveLength(1);
  });
});

describe('EnquiryService tenant isolation', () => {
  it('never returns another tenant’s enquiry', async () => {
    const svc = makeService();
    const a = await svc.createManual(ORG_A, manualInput);

    // org B cannot read org A's enquiry
    await expect(svc.getById(ORG_B, a.id)).rejects.toThrow(NotFoundError);
    expect(await svc.list(ORG_B)).toHaveLength(0);

    // org B has its own, separate enquiry
    await svc.createManual(ORG_B, manualInput);
    expect(await svc.list(ORG_A)).toHaveLength(1);
    expect(await svc.list(ORG_B)).toHaveLength(1);
  });
});

describe('EnquiryService.assign & changeStatus', () => {
  it('assigns an enquiry to a user', async () => {
    const svc = makeService();
    const e = await svc.createManual(ORG_A, manualInput);
    const assigned = await svc.assign(ORG_A, e.id, 'staff-42');
    expect(assigned.assignedToUserId).toBe('staff-42');
  });

  it('validates status transitions and audits them', async () => {
    const audit = new CapturingAuditSink();
    const svc = makeService(audit);
    const e = await svc.createManual(ORG_A, manualInput);

    await svc.changeStatus(ORG_A, e.id, 'In Progress');
    await expect(svc.changeStatus(ORG_A, e.id, 'Won')).rejects.toThrow(/Illegal/);

    // create audit + one transition audit
    const statusEvents = audit.events.filter((ev) => ev.action === 'enquiry.status_changed');
    expect(statusEvents).toHaveLength(2);
    expect(statusEvents[1]).toMatchObject({
      before: { status: 'New' },
      after: { status: 'In Progress' },
    });
  });
});
