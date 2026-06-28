import { type TenantContext, assertSameTenant } from '@common/tenancy/tenant-context';
import type { ConsentRecord } from '../domain/consent';

export interface ConsentRepository {
  create(ctx: TenantContext, record: ConsentRecord): Promise<ConsentRecord>;
  list(ctx: TenantContext, subjectRef?: string): Promise<ConsentRecord[]>;
}

export class InMemoryConsentRepository implements ConsentRepository {
  private readonly store = new Map<string, ConsentRecord>();

  async create(ctx: TenantContext, record: ConsentRecord): Promise<ConsentRecord> {
    assertSameTenant(ctx, record);
    this.store.set(record.id, record);
    return record;
  }

  async list(ctx: TenantContext, subjectRef?: string): Promise<ConsentRecord[]> {
    return [...this.store.values()].filter(
      (r) => r.orgId === ctx.orgId && (subjectRef === undefined || r.subjectRef === subjectRef),
    );
  }
}
