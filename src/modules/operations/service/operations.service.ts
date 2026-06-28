/**
 * Operations service (Build guide §3 Operations, §10 Phase 2). Turns an accepted
 * quote into a Booking (one item per included component, to confirm with its
 * supplier), tracks confirmation, derives supplier POs, and reports the pipeline.
 *
 * Composes Quotation, Catalog, and Enquiry through their service interfaces. All
 * status mutations are audited (Build guide §9).
 */

import { type TenantContext } from '@common/tenancy/tenant-context';
import { NotFoundError, ValidationError } from '@common/errors/errors';
import type { Clock } from '@common/clock/clock';
import type { IdGenerator } from '@common/ids/id';
import type { AuditSink } from '@common/audit/audit-log';
import { NullAuditSink } from '@common/audit/audit-log';
import { QuotationService } from '@modules/quotation';
import { CatalogService } from '@modules/catalog';
import { EnquiryService, canTransition, type EnquiryStatus } from '@modules/enquiry-intake';
import { type Booking, type BookingItem, type SupplierPO } from '../domain/booking';
import type { BookingRepository } from '../repository/booking.repository';

export interface OperationsServiceDeps {
  readonly bookings: BookingRepository;
  readonly quotation: QuotationService;
  readonly catalog: CatalogService;
  readonly enquiries: EnquiryService;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly audit?: AuditSink;
}

export interface PipelineReport {
  readonly byStatus: Record<string, number>;
  readonly total: number;
  readonly won: number;
  readonly lost: number;
}

export class OperationsService {
  private readonly bookings: BookingRepository;
  private readonly quotation: QuotationService;
  private readonly catalog: CatalogService;
  private readonly enquiries: EnquiryService;
  private readonly clock: Clock;
  private readonly newId: IdGenerator;
  private readonly audit: AuditSink;

  constructor(deps: OperationsServiceDeps) {
    this.bookings = deps.bookings;
    this.quotation = deps.quotation;
    this.catalog = deps.catalog;
    this.enquiries = deps.enquiries;
    this.clock = deps.clock;
    this.newId = deps.idGenerator;
    this.audit = deps.audit ?? new NullAuditSink();
  }

  /**
   * Accept a quote: mark it Accepted, advance the enquiry to Won (if the move is
   * legal), and create one Booking with an item per included component. Idempotent
   * — re-accepting returns the existing booking.
   */
  async acceptQuote(ctx: TenantContext, quoteId: string): Promise<Booking> {
    const existing = await this.bookings.findByQuote(ctx, quoteId);
    if (existing) return existing;

    const quote = await this.quotation.markAccepted(ctx, quoteId);
    await this.advanceEnquiry(ctx, quote.enquiryId, 'Won');

    const refs = await this.quotation.listIncludedComponents(ctx, quoteId);
    const items: BookingItem[] = [];
    for (const ref of refs) {
      const component = await this.catalog.getComponent(ctx, ref.componentId);
      const supplier = await this.catalog.getSupplier(ctx, component.supplierId);
      items.push({
        id: this.newId('bitem'),
        componentId: component.id,
        description: ref.description,
        supplierId: supplier.id,
        supplierName: supplier.name,
        status: 'Pending',
      });
    }

    const now = this.clock();
    const booking: Booking = {
      id: this.newId('bkg'),
      orgId: ctx.orgId,
      enquiryId: quote.enquiryId,
      quoteId,
      status: 'Confirming',
      items,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    };
    const saved = await this.bookings.create(ctx, booking);
    await this.recordAudit(ctx, 'quote.status_changed', 'Booking', saved.id, {
      created: true,
      items: items.length,
    });
    return saved;
  }

  /** Reject a quote: mark it Rejected and move the enquiry to Lost (if legal). */
  async rejectQuote(ctx: TenantContext, quoteId: string): Promise<void> {
    const quote = await this.quotation.markRejected(ctx, quoteId);
    await this.advanceEnquiry(ctx, quote.enquiryId, 'Lost');
  }

  async getBooking(ctx: TenantContext, id: string): Promise<Booking> {
    const booking = await this.bookings.findById(ctx, id);
    if (!booking) throw new NotFoundError(`Booking ${id} not found`, { id });
    return booking;
  }

  async listBookings(ctx: TenantContext): Promise<Booking[]> {
    return this.bookings.list(ctx);
  }

  /** Confirm a booking item; when all items are Confirmed the booking is too. */
  async confirmItem(
    ctx: TenantContext,
    bookingId: string,
    itemId: string,
    confirmationRef: string,
  ): Promise<Booking> {
    if (!confirmationRef) throw new ValidationError('confirmationRef is required');
    const booking = await this.getBooking(ctx, bookingId);
    if (!booking.items.some((i) => i.id === itemId)) {
      throw new NotFoundError(`Booking item ${itemId} not found`, { itemId });
    }
    const items = booking.items.map((i) =>
      i.id === itemId ? { ...i, status: 'Confirmed' as const, confirmationRef } : i,
    );
    const allConfirmed = items.every((i) => i.status === 'Confirmed');
    const now = this.clock();
    const saved = await this.bookings.save(ctx, {
      ...booking,
      items,
      status: allConfirmed ? 'Confirmed' : booking.status,
      updatedAt: now,
    });
    await this.recordAudit(ctx, 'segment.status_changed', 'BookingItem', itemId, {
      status: 'Confirmed',
      bookingConfirmed: allConfirmed,
    });
    return saved;
  }

  /** Group a booking's items by supplier into purchase orders. */
  async supplierPOs(ctx: TenantContext, bookingId: string): Promise<SupplierPO[]> {
    const booking = await this.getBooking(ctx, bookingId);
    const bySupplier = new Map<string, SupplierPO>();
    for (const item of booking.items) {
      const key = item.supplierId ?? 'unassigned';
      if (!bySupplier.has(key)) {
        bySupplier.set(key, {
          supplierId: item.supplierId ?? 'unassigned',
          supplierName: item.supplierName ?? 'Unassigned',
          bookingId: booking.id,
          items: [],
        });
      }
      bySupplier.get(key)!.items.push({
        itemId: item.id,
        description: item.description,
        status: item.status,
      });
    }
    return [...bySupplier.values()];
  }

  /** Pipeline report: enquiry counts by status, plus won/lost (Build guide §11). */
  async pipelineReport(ctx: TenantContext): Promise<PipelineReport> {
    const enquiries = await this.enquiries.list(ctx);
    const byStatus: Record<string, number> = {};
    for (const e of enquiries) {
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    }
    return {
      byStatus,
      total: enquiries.length,
      won: byStatus.Won ?? 0,
      lost: byStatus.Lost ?? 0,
    };
  }

  private async advanceEnquiry(
    ctx: TenantContext,
    enquiryId: string,
    to: EnquiryStatus,
  ): Promise<void> {
    const enquiry = await this.enquiries.getById(ctx, enquiryId);
    if (enquiry.status !== to && canTransition(enquiry.status, to)) {
      await this.enquiries.changeStatus(ctx, enquiryId, to);
    }
  }

  private async recordAudit(
    ctx: TenantContext,
    action: 'quote.status_changed' | 'segment.status_changed',
    subjectType: string,
    subjectId: string,
    after: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      action,
      subject: { type: subjectType, id: subjectId },
      after,
      at: this.clock(),
      requestId: ctx.requestId,
    });
  }
}
