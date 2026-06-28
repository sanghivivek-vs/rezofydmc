/**
 * In-memory EnquiryRepository — used by tests and local dev.
 *
 * Demonstrates the central tenant-scoping contract (Build guide §0, §9): the
 * `org_id` filter is applied here, once, so no service or query can leak another
 * tenant's rows. `assertSameTenant` is a loud backstop.
 */

import { type TenantContext, assertSameTenant } from '@common/tenancy/tenant-context';
import type { Enquiry } from '../domain/enquiry';
import type { EnquiryRepository } from './enquiry.repository';

export class InMemoryEnquiryRepository implements EnquiryRepository {
  /** Keyed by enquiry id. Values carry their own orgId for scoping. */
  private readonly store = new Map<string, Enquiry>();

  async create(ctx: TenantContext, enquiry: Enquiry): Promise<Enquiry> {
    assertSameTenant(ctx, enquiry);
    this.store.set(enquiry.id, enquiry);
    return enquiry;
  }

  async update(ctx: TenantContext, enquiry: Enquiry): Promise<Enquiry> {
    assertSameTenant(ctx, enquiry);
    const existing = this.store.get(enquiry.id);
    if (existing) {
      // Guard: cannot update across tenants even if ids collide.
      assertSameTenant(ctx, existing);
    }
    this.store.set(enquiry.id, enquiry);
    return enquiry;
  }

  async findById(ctx: TenantContext, id: string): Promise<Enquiry | null> {
    const row = this.store.get(id);
    if (!row || row.orgId !== ctx.orgId) return null;
    return row;
  }

  async findByExternalId(ctx: TenantContext, enquiryExternalId: string): Promise<Enquiry | null> {
    for (const row of this.store.values()) {
      if (row.orgId === ctx.orgId && row.enquiryExternalId === enquiryExternalId) {
        return row;
      }
    }
    return null;
  }

  async list(ctx: TenantContext): Promise<Enquiry[]> {
    return [...this.store.values()].filter((row) => row.orgId === ctx.orgId);
  }
}
