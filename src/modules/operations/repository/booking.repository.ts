import { type TenantContext, assertSameTenant } from '@common/tenancy/tenant-context';
import type { Booking } from '../domain/booking';

export interface BookingRepository {
  create(ctx: TenantContext, booking: Booking): Promise<Booking>;
  save(ctx: TenantContext, booking: Booking): Promise<Booking>;
  findById(ctx: TenantContext, id: string): Promise<Booking | null>;
  findByQuote(ctx: TenantContext, quoteId: string): Promise<Booking | null>;
  list(ctx: TenantContext): Promise<Booking[]>;
}

export class InMemoryBookingRepository implements BookingRepository {
  private readonly store = new Map<string, Booking>();

  async create(ctx: TenantContext, booking: Booking): Promise<Booking> {
    assertSameTenant(ctx, booking);
    this.store.set(booking.id, booking);
    return booking;
  }
  async save(ctx: TenantContext, booking: Booking): Promise<Booking> {
    assertSameTenant(ctx, booking);
    const existing = this.store.get(booking.id);
    if (existing) assertSameTenant(ctx, existing);
    this.store.set(booking.id, booking);
    return booking;
  }
  async findById(ctx: TenantContext, id: string): Promise<Booking | null> {
    const row = this.store.get(id);
    if (!row || row.orgId !== ctx.orgId) return null;
    return row;
  }
  async findByQuote(ctx: TenantContext, quoteId: string): Promise<Booking | null> {
    for (const b of this.store.values()) {
      if (b.orgId === ctx.orgId && b.quoteId === quoteId) return b;
    }
    return null;
  }
  async list(ctx: TenantContext): Promise<Booking[]> {
    return [...this.store.values()].filter((b) => b.orgId === ctx.orgId);
  }
}
