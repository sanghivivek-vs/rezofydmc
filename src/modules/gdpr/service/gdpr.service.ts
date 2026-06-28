/**
 * GDPR service (ADR 0008) — technical data-subject controls. Orchestrates the
 * owning bounded contexts (Identity/Org for users, Enquiry + Itinerary for
 * traveller data) through their service interfaces to satisfy:
 *  - Right of access (DSAR export),
 *  - Right to erasure (anonymise/redact in place),
 *  - Consent / lawful-basis records,
 *  - Retention/minimization sweeps.
 *
 * Every access and erasure is audited (Build guide §9; read-access auditing was
 * previously missing). The ORGANIZATIONAL side of GDPR (DPA, DPIA, DPO,
 * data-residency) is out of code scope — see ADR 0008.
 */

import { type TenantContext } from '@common/tenancy/tenant-context';
import { ValidationError } from '@common/errors/errors';
import type { Clock } from '@common/clock/clock';
import type { IdGenerator } from '@common/ids/id';
import type { AuditSink } from '@common/audit/audit-log';
import { NullAuditSink } from '@common/audit/audit-log';
import { UserService } from '@modules/identity-org';
import { EnquiryService } from '@modules/enquiry-intake';
import { ItineraryService } from '@modules/itinerary';
import { type ConsentRecord, type RecordConsentInput } from '../domain/consent';
import { PII_REGISTRY, type PiiField } from '../domain/pii';
import type { ConsentRepository } from '../repository/consent.repository';

export interface GdprServiceDeps {
  readonly users: UserService;
  readonly enquiries: EnquiryService;
  readonly itineraries: ItineraryService;
  readonly consent: ConsentRepository;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly audit?: AuditSink;
}

export interface DataExport {
  readonly subjectType: 'user' | 'traveller';
  readonly subjectRef: string;
  readonly exportedAt: string;
  readonly data: Record<string, unknown>;
}

export class GdprService {
  private readonly users: UserService;
  private readonly enquiries: EnquiryService;
  private readonly itineraries: ItineraryService;
  private readonly consentRepo: ConsentRepository;
  private readonly clock: Clock;
  private readonly newId: IdGenerator;
  private readonly audit: AuditSink;

  constructor(deps: GdprServiceDeps) {
    this.users = deps.users;
    this.enquiries = deps.enquiries;
    this.itineraries = deps.itineraries;
    this.consentRepo = deps.consent;
    this.clock = deps.clock;
    this.newId = deps.idGenerator;
    this.audit = deps.audit ?? new NullAuditSink();
  }

  piiRegistry(): readonly PiiField[] {
    return PII_REGISTRY;
  }

  // ---- Right of access (DSAR) ------------------------------------------

  async exportUser(ctx: TenantContext, userId: string): Promise<DataExport> {
    const data = await this.users.exportPersonalData(ctx, userId);
    await this.recordAccess(ctx, 'data.exported', 'User', userId);
    return { subjectType: 'user', subjectRef: userId, exportedAt: this.clock(), data };
  }

  async exportEnquiry(ctx: TenantContext, enquiryId: string): Promise<DataExport> {
    const enquiry = await this.enquiries.exportPersonalData(ctx, enquiryId);
    const itineraries = await this.itineraries.listByEnquiry(ctx, enquiryId);
    const itineraryPii = itineraries.map((i) => ({
      id: i.id,
      segments: i.days.flatMap((d) =>
        d.segments
          .filter((s) => s.notes !== undefined)
          .map((s) => ({ segmentId: s.id, notes: s.notes })),
      ),
    }));
    await this.recordAccess(ctx, 'data.exported', 'Enquiry', enquiryId);
    return {
      subjectType: 'traveller',
      subjectRef: enquiryId,
      exportedAt: this.clock(),
      data: { enquiry, itineraries: itineraryPii },
    };
  }

  // ---- Right to erasure -------------------------------------------------

  async eraseUser(ctx: TenantContext, userId: string): Promise<void> {
    await this.users.anonymise(ctx, userId);
    await this.recordAccess(ctx, 'data.erased', 'User', userId);
  }

  async eraseEnquiry(ctx: TenantContext, enquiryId: string): Promise<void> {
    await this.enquiries.eraseSubjectData(ctx, enquiryId);
    const itineraries = await this.itineraries.listByEnquiry(ctx, enquiryId);
    for (const itinerary of itineraries) {
      await this.itineraries.redactPersonalData(ctx, itinerary.id);
    }
    await this.recordAccess(ctx, 'data.erased', 'Enquiry', enquiryId);
  }

  // ---- Consent ----------------------------------------------------------

  async recordConsent(ctx: TenantContext, input: RecordConsentInput): Promise<ConsentRecord> {
    if (!input.purpose) throw new ValidationError('Consent purpose is required');
    if (!input.subjectRef) throw new ValidationError('Consent subjectRef is required');
    const now = this.clock();
    const record: ConsentRecord = {
      id: this.newId('consent'),
      orgId: ctx.orgId,
      subjectType: input.subjectType,
      subjectRef: input.subjectRef,
      purpose: input.purpose,
      lawfulBasis: input.lawfulBasis,
      granted: input.granted,
      recordedBy: ctx.userId,
      recordedAt: now,
    };
    const saved = await this.consentRepo.create(ctx, record);
    await this.audit.record({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: 'consent.recorded',
      subject: { type: 'Consent', id: saved.id },
      after: {
        subjectRef: saved.subjectRef,
        lawfulBasis: saved.lawfulBasis,
        granted: saved.granted,
      },
      at: now,
      requestId: ctx.requestId,
    });
    return saved;
  }

  async listConsent(ctx: TenantContext, subjectRef?: string): Promise<ConsentRecord[]> {
    return this.consentRepo.list(ctx, subjectRef);
  }

  // ---- Retention / minimization ----------------------------------------

  /**
   * Erase traveller PII on closed enquiries (Won/Lost/Expired) whose last update
   * is older than `retentionDays` before `asOf`. Returns the ids swept. `asOf` is
   * supplied by the caller so the sweep is deterministic/testable.
   */
  async retentionSweep(
    ctx: TenantContext,
    asOf: string,
    retentionDays: number,
  ): Promise<{ swept: string[] }> {
    if (retentionDays < 0) throw new ValidationError('retentionDays must be >= 0');
    const cutoff = new Date(new Date(asOf).getTime() - retentionDays * 86_400_000).toISOString();
    const terminal = new Set(['Won', 'Lost', 'Expired']);
    const enquiries = await this.enquiries.list(ctx);
    const swept: string[] = [];
    for (const e of enquiries) {
      if (terminal.has(e.status) && e.updatedAt < cutoff) {
        await this.eraseEnquiry(ctx, e.id);
        swept.push(e.id);
      }
    }
    return { swept };
  }

  private async recordAccess(
    ctx: TenantContext,
    action: 'data.exported' | 'data.erased',
    subjectType: string,
    subjectId: string,
  ): Promise<void> {
    await this.audit.record({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action,
      subject: { type: subjectType, id: subjectId },
      at: this.clock(),
      requestId: ctx.requestId,
    });
  }
}
