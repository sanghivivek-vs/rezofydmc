/**
 * Enquiry repository interface (Build guide §9 layering).
 *
 * The service depends on this interface, not a concrete store. Tenant scoping is
 * the repository's responsibility — every method takes a {@link TenantContext}
 * and must apply the `org_id` filter centrally so callers cannot forget it
 * (Build guide §0, §9). The Prisma-backed implementation arrives with the
 * persistence slice; an in-memory implementation backs the tests.
 */

import type { TenantContext } from '@common/tenancy/tenant-context';
import type { Enquiry } from '../domain/enquiry';

export interface EnquiryRepository {
  create(ctx: TenantContext, enquiry: Enquiry): Promise<Enquiry>;
  update(ctx: TenantContext, enquiry: Enquiry): Promise<Enquiry>;
  findById(ctx: TenantContext, id: string): Promise<Enquiry | null>;
  findByExternalId(ctx: TenantContext, enquiryExternalId: string): Promise<Enquiry | null>;
  list(ctx: TenantContext): Promise<Enquiry[]>;
}
