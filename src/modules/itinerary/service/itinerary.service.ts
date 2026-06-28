/**
 * Itinerary Builder service (Build guide §4, §3). Builds the day-by-day, timed
 * structure for an enquiry. Composes Enquiry Intake (enquiry existence), Catalog
 * (segment→component links), and Identity/Org (configurable booking statuses)
 * through their service interfaces. Segment status changes are audited
 * (Build guide §9) and are the source of the outbound segment.status.updated
 * event (Build guide §6) wired in the integration slice.
 */

import { type TenantContext } from '@common/tenancy/tenant-context';
import { BusinessRuleError, NotFoundError, ValidationError } from '@common/errors/errors';
import type { Clock } from '@common/clock/clock';
import type { IdGenerator } from '@common/ids/id';
import type { AuditSink } from '@common/audit/audit-log';
import { NullAuditSink } from '@common/audit/audit-log';
import { type OutboundPublisher, NullOutboundPublisher } from '@common/integration/outbound';
import { EnquiryService } from '@modules/enquiry-intake';
import { CatalogService } from '@modules/catalog';
import { OrgService } from '@modules/identity-org';
import {
  type AddDayInput,
  type AddSegmentInput,
  type CreateItineraryInput,
  type Itinerary,
  type ItineraryDay,
  type Segment,
} from '../domain/itinerary';
import { SEGMENT_TYPES } from '../domain/enums';
import type { ItineraryRepository } from '../repository/itinerary.repository';

export interface ItineraryServiceDeps {
  readonly repository: ItineraryRepository;
  readonly enquiries: EnquiryService;
  readonly catalog: CatalogService;
  readonly orgs: OrgService;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly audit?: AuditSink;
  readonly publisher?: OutboundPublisher;
}

export class ItineraryService {
  private readonly repo: ItineraryRepository;
  private readonly enquiries: EnquiryService;
  private readonly catalog: CatalogService;
  private readonly orgs: OrgService;
  private readonly clock: Clock;
  private readonly newId: IdGenerator;
  private readonly audit: AuditSink;
  private readonly publisher: OutboundPublisher;

  constructor(deps: ItineraryServiceDeps) {
    this.repo = deps.repository;
    this.enquiries = deps.enquiries;
    this.catalog = deps.catalog;
    this.orgs = deps.orgs;
    this.clock = deps.clock;
    this.newId = deps.idGenerator;
    this.audit = deps.audit ?? new NullAuditSink();
    this.publisher = deps.publisher ?? new NullOutboundPublisher();
  }

  async create(ctx: TenantContext, input: CreateItineraryInput): Promise<Itinerary> {
    await this.enquiries.getById(ctx, input.enquiryId); // tenant-scoped existence
    const now = this.clock();
    const itinerary: Itinerary = {
      id: this.newId('itin'),
      orgId: ctx.orgId,
      enquiryId: input.enquiryId,
      version: (await this.repo.latestVersion(ctx, input.enquiryId)) + 1,
      title: input.title,
      days: [],
      createdAt: now,
      updatedAt: now,
    };
    return this.repo.create(ctx, itinerary);
  }

  async getById(ctx: TenantContext, id: string): Promise<Itinerary> {
    const itinerary = await this.repo.findById(ctx, id);
    if (!itinerary) throw new NotFoundError(`Itinerary ${id} not found`, { id });
    return itinerary;
  }

  async listByEnquiry(ctx: TenantContext, enquiryId: string): Promise<Itinerary[]> {
    return this.repo.listByEnquiry(ctx, enquiryId);
  }

  async addDay(ctx: TenantContext, itineraryId: string, input: AddDayInput): Promise<Itinerary> {
    const itinerary = await this.getById(ctx, itineraryId);
    if (!input.date) throw new ValidationError('Day date is required');
    if (!Number.isInteger(input.dayNumber) || input.dayNumber < 1) {
      throw new ValidationError('dayNumber must be a positive integer');
    }
    if (itinerary.days.some((d) => d.dayNumber === input.dayNumber)) {
      throw new BusinessRuleError(`Day ${input.dayNumber} already exists`, {
        dayNumber: input.dayNumber,
      });
    }
    const day: ItineraryDay = {
      dayNumber: input.dayNumber,
      date: input.date,
      headline: input.headline,
      segments: [],
    };
    const days = [...itinerary.days, day].sort((a, b) => a.dayNumber - b.dayNumber);
    return this.repo.save(ctx, { ...itinerary, days, updatedAt: this.clock() });
  }

  async addSegment(
    ctx: TenantContext,
    itineraryId: string,
    dayNumber: number,
    input: AddSegmentInput,
  ): Promise<Itinerary> {
    const itinerary = await this.getById(ctx, itineraryId);
    const day = itinerary.days.find((d) => d.dayNumber === dayNumber);
    if (!day) throw new NotFoundError(`Day ${dayNumber} not found on itinerary`, { dayNumber });

    if (!SEGMENT_TYPES.includes(input.type)) {
      throw new ValidationError(`Unknown segment type "${input.type}"`, { type: input.type });
    }
    if (!input.description) throw new ValidationError('Segment description is required');
    validateTimes(input.startTime, input.endTime);

    const bookingStatus = await this.resolveBookingStatus(ctx, input.bookingStatus);
    if (input.componentId) {
      await this.catalog.getComponent(ctx, input.componentId); // validate link
    }

    const segment: Segment = {
      id: this.newId('seg'),
      startTime: input.startTime,
      endTime: input.endTime,
      type: input.type,
      description: input.description,
      notes: input.notes,
      componentId: input.componentId,
      bookingStatus,
      supplier: input.supplier,
    };
    const days = itinerary.days.map((d) =>
      d.dayNumber === dayNumber ? { ...d, segments: [...d.segments, segment] } : d,
    );
    return this.repo.save(ctx, { ...itinerary, days, updatedAt: this.clock() });
  }

  async updateSegmentStatus(
    ctx: TenantContext,
    itineraryId: string,
    segmentId: string,
    bookingStatus: string,
  ): Promise<Itinerary> {
    const itinerary = await this.getById(ctx, itineraryId);
    const status = await this.resolveBookingStatus(ctx, bookingStatus, true);

    let found: { from: string; dayNumber: number; supplier?: string } | undefined;
    const days = itinerary.days.map((d) => ({
      ...d,
      segments: d.segments.map((s) => {
        if (s.id !== segmentId) return s;
        found = { from: s.bookingStatus, dayNumber: d.dayNumber, supplier: s.supplier };
        return { ...s, bookingStatus: status };
      }),
    }));
    if (!found) throw new NotFoundError(`Segment ${segmentId} not found`, { segmentId });

    const now = this.clock();
    const saved = await this.repo.save(ctx, { ...itinerary, days, updatedAt: now });
    await this.audit.record({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action: 'segment.status_changed',
      subject: { type: 'Segment', id: segmentId },
      before: { bookingStatus: found.from },
      after: { bookingStatus: status },
      at: now,
      requestId: ctx.requestId,
    });

    // Outbound segment.status.updated (Build guide §6).
    const enquiry = await this.enquiries.getById(ctx, itinerary.enquiryId);
    await this.publisher.publish(
      'segment.status.updated',
      {
        enquiry_external_id: enquiry.enquiryExternalId ?? enquiry.id,
        agency_id: enquiry.agencyId,
        segment_id: segmentId,
        day_number: found.dayNumber,
        booking_status: status,
        supplier: found.supplier,
      },
      `${segmentId}:${status}:${now}`,
      now,
    );
    return saved;
  }

  /** Validate a booking status against the org's configurable set. */
  private async resolveBookingStatus(
    ctx: TenantContext,
    status: string | undefined,
    required = false,
  ): Promise<string> {
    const org = await this.orgs.getCurrent(ctx);
    const allowed = org.settings.bookingStatuses;
    if (status === undefined) {
      if (required) throw new ValidationError('bookingStatus is required');
      return allowed[0]; // default to the first configured status
    }
    if (!allowed.includes(status)) {
      throw new ValidationError(`bookingStatus "${status}" is not configured for this org`, {
        status,
        allowed,
      });
    }
    return status;
  }
}

function validateTimes(start?: string, end?: string): void {
  const re = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (start !== undefined && !re.test(start)) {
    throw new ValidationError('startTime must be "HH:MM" (24h)', { startTime: start });
  }
  if (end !== undefined && !re.test(end)) {
    throw new ValidationError('endTime must be "HH:MM" (24h)', { endTime: end });
  }
  if (start !== undefined && end !== undefined && start > end) {
    throw new ValidationError('startTime must be on or before endTime', { start, end });
  }
}
