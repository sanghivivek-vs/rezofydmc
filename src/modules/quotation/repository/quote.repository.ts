/**
 * Quote repository (Build guide §9). Tenant-scoped; tracks versions per enquiry.
 */

import { type TenantContext, assertSameTenant } from '@common/tenancy/tenant-context';
import type { Quote } from '../domain/quote';

export interface QuoteRepository {
  create(ctx: TenantContext, quote: Quote): Promise<Quote>;
  findById(ctx: TenantContext, id: string): Promise<Quote | null>;
  listByEnquiry(ctx: TenantContext, enquiryId: string): Promise<Quote[]>;
  /** Highest existing version for an enquiry (0 if none). */
  latestVersion(ctx: TenantContext, enquiryId: string): Promise<number>;
}

export class InMemoryQuoteRepository implements QuoteRepository {
  private readonly store = new Map<string, Quote>();

  async create(ctx: TenantContext, quote: Quote): Promise<Quote> {
    assertSameTenant(ctx, quote);
    this.store.set(quote.id, quote);
    return quote;
  }

  async findById(ctx: TenantContext, id: string): Promise<Quote | null> {
    const row = this.store.get(id);
    if (!row || row.orgId !== ctx.orgId) return null;
    return row;
  }

  async listByEnquiry(ctx: TenantContext, enquiryId: string): Promise<Quote[]> {
    return [...this.store.values()]
      .filter((q) => q.orgId === ctx.orgId && q.enquiryId === enquiryId)
      .sort((a, b) => a.version - b.version);
  }

  async latestVersion(ctx: TenantContext, enquiryId: string): Promise<number> {
    const versions = (await this.listByEnquiry(ctx, enquiryId)).map((q) => q.version);
    return versions.length === 0 ? 0 : Math.max(...versions);
  }
}
