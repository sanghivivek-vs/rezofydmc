/**
 * Enquiry Intake service (Build guide §4, §9).
 *
 * Business logic for receiving RFQs — manual entry and inbound webhook — plus
 * triage (assignment) and status transitions. All operations are tenant-scoped
 * via the repository, and pricing/status mutations are audited (Build guide §9).
 *
 * The service is framework-agnostic: clock, id generation, repository and audit
 * sink are injected. A NestJS provider will wire concrete implementations in the
 * API slice.
 */

import { type TenantContext, type UserId } from '@common/tenancy/tenant-context';
import { NotFoundError, ValidationError } from '@common/errors/errors';
import type { Clock } from '@common/clock/clock';
import type { IdGenerator } from '@common/ids/id';
import type { AuditSink } from '@common/audit/audit-log';
import { NullAuditSink } from '@common/audit/audit-log';
import type { Enquiry, CreateEnquiryInput } from '../domain/enquiry';
import type { EnquiryStatus } from '../domain/enums';
import { assertTransition } from '../domain/status';
import type { EnquiryRepository } from '../repository/enquiry.repository';
import { mapInboundEnquiry, type InboundEnquiryData } from './inbound-mapper';

export interface EnquiryServiceDeps {
  readonly repository: EnquiryRepository;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly audit?: AuditSink;
}

export class EnquiryService {
  private readonly repo: EnquiryRepository;
  private readonly clock: Clock;
  private readonly newId: IdGenerator;
  private readonly audit: AuditSink;

  constructor(deps: EnquiryServiceDeps) {
    this.repo = deps.repository;
    this.clock = deps.clock;
    this.newId = deps.idGenerator;
    this.audit = deps.audit ?? new NullAuditSink();
  }

  /** Create an enquiry from manual staff entry. Starts in status "New". */
  async createManual(ctx: TenantContext, input: CreateEnquiryInput): Promise<Enquiry> {
    validateCreateInput(input);
    const now = this.clock();
    const enquiry: Enquiry = {
      ...input,
      id: this.newId('enq'),
      orgId: ctx.orgId,
      source: 'manual',
      status: 'New',
      createdAt: now,
      updatedAt: now,
    };
    const saved = await this.repo.create(ctx, enquiry);
    await this.recordStatusAudit(ctx, saved, undefined, 'New', now);
    return saved;
  }

  /**
   * Idempotent upsert from an inbound `enquiry.created` / `enquiry.updated`
   * webhook. Keyed by `enquiryExternalId` within the tenant: first delivery
   * creates (status "New"); subsequent deliveries update details but PRESERVE the
   * workflow status (a re-sent RFQ must not silently reset a "Quoted" enquiry).
   */
  async ingestInbound(ctx: TenantContext, data: InboundEnquiryData): Promise<Enquiry> {
    const input = mapInboundEnquiry(data);
    validateCreateInput(input);
    const externalId = input.enquiryExternalId as string; // mapper guarantees presence
    const now = this.clock();

    const existing = await this.repo.findByExternalId(ctx, externalId);
    if (existing) {
      const updated: Enquiry = {
        ...existing,
        ...input,
        // immutable / service-owned fields preserved:
        id: existing.id,
        orgId: existing.orgId,
        source: existing.source,
        status: existing.status,
        assignedToUserId: existing.assignedToUserId,
        createdAt: existing.createdAt,
        updatedAt: now,
      };
      return this.repo.update(ctx, updated);
    }

    const enquiry: Enquiry = {
      ...input,
      id: this.newId('enq'),
      orgId: ctx.orgId,
      source: 'integration',
      status: 'New',
      createdAt: now,
      updatedAt: now,
    };
    const saved = await this.repo.create(ctx, enquiry);
    await this.recordStatusAudit(ctx, saved, undefined, 'New', now);
    return saved;
  }

  async getById(ctx: TenantContext, id: string): Promise<Enquiry> {
    const found = await this.repo.findById(ctx, id);
    if (!found) {
      throw new NotFoundError(`Enquiry ${id} not found`, { id });
    }
    return found;
  }

  async list(ctx: TenantContext): Promise<Enquiry[]> {
    return this.repo.list(ctx);
  }

  /** Triage: assign the enquiry to a staff user. */
  async assign(ctx: TenantContext, id: string, userId: UserId): Promise<Enquiry> {
    const enquiry = await this.getById(ctx, id);
    const updated: Enquiry = {
      ...enquiry,
      assignedToUserId: userId,
      updatedAt: this.clock(),
    };
    return this.repo.update(ctx, updated);
  }

  /** Transition the enquiry status, validating the move and auditing it. */
  async changeStatus(ctx: TenantContext, id: string, to: EnquiryStatus): Promise<Enquiry> {
    const enquiry = await this.getById(ctx, id);
    assertTransition(enquiry.status, to);
    const now = this.clock();
    const updated: Enquiry = { ...enquiry, status: to, updatedAt: now };
    const saved = await this.repo.update(ctx, updated);
    await this.recordStatusAudit(ctx, saved, enquiry.status, to, now);
    return saved;
  }

  private async recordStatusAudit(
    ctx: TenantContext,
    enquiry: Enquiry,
    from: EnquiryStatus | undefined,
    to: EnquiryStatus,
    at: string,
  ): Promise<void> {
    await this.audit.record({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: 'enquiry.status_changed',
      subject: { type: 'Enquiry', id: enquiry.id },
      before: from ? { status: from } : undefined,
      after: { status: to },
      at,
      requestId: ctx.requestId,
    });
  }
}

function validateCreateInput(input: CreateEnquiryInput): void {
  if (!input.agencyId) {
    throw new ValidationError('agencyId is required');
  }
  if (!input.destinations || input.destinations.length === 0) {
    throw new ValidationError('At least one destination is required');
  }
  if (!input.quoteDeadline) {
    throw new ValidationError('quoteDeadline is required');
  }
  if (input.pax.adults < 0 || input.pax.infants < 0) {
    throw new ValidationError('pax counts must be non-negative');
  }
  if (input.pax.adults + input.pax.children.length + input.pax.infants === 0) {
    throw new ValidationError('Enquiry must have at least one traveller');
  }
}
