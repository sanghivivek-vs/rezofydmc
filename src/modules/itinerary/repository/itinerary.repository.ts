/**
 * Itinerary repository (Build guide §9). Tenant-scoped; the whole itinerary tree
 * is the aggregate (days + segments stored together).
 */

import { type TenantContext, assertSameTenant } from '@common/tenancy/tenant-context';
import type { Itinerary } from '../domain/itinerary';

export interface ItineraryRepository {
  create(ctx: TenantContext, itinerary: Itinerary): Promise<Itinerary>;
  save(ctx: TenantContext, itinerary: Itinerary): Promise<Itinerary>;
  findById(ctx: TenantContext, id: string): Promise<Itinerary | null>;
  listByEnquiry(ctx: TenantContext, enquiryId: string): Promise<Itinerary[]>;
  latestVersion(ctx: TenantContext, enquiryId: string): Promise<number>;
}

export class InMemoryItineraryRepository implements ItineraryRepository {
  private readonly store = new Map<string, Itinerary>();

  async create(ctx: TenantContext, itinerary: Itinerary): Promise<Itinerary> {
    assertSameTenant(ctx, itinerary);
    this.store.set(itinerary.id, itinerary);
    return itinerary;
  }

  async save(ctx: TenantContext, itinerary: Itinerary): Promise<Itinerary> {
    assertSameTenant(ctx, itinerary);
    const existing = this.store.get(itinerary.id);
    if (existing) assertSameTenant(ctx, existing);
    this.store.set(itinerary.id, itinerary);
    return itinerary;
  }

  async findById(ctx: TenantContext, id: string): Promise<Itinerary | null> {
    const row = this.store.get(id);
    if (!row || row.orgId !== ctx.orgId) return null;
    return row;
  }

  async listByEnquiry(ctx: TenantContext, enquiryId: string): Promise<Itinerary[]> {
    return [...this.store.values()]
      .filter((i) => i.orgId === ctx.orgId && i.enquiryId === enquiryId)
      .sort((a, b) => a.version - b.version);
  }

  async latestVersion(ctx: TenantContext, enquiryId: string): Promise<number> {
    const versions = (await this.listByEnquiry(ctx, enquiryId)).map((i) => i.version);
    return versions.length === 0 ? 0 : Math.max(...versions);
  }
}
