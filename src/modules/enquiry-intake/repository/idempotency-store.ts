/**
 * Idempotency store for inbound webhooks (Build guide §6: consumers must be
 * idempotent). Keyed by (orgId, idempotencyKey); records the resulting enquiry
 * id so a redelivered webhook returns the same result without reprocessing.
 *
 * In-memory implementation here; the persistence slice backs this with a
 * `webhook_receipt` table (see prisma/schema.prisma).
 */

export interface IdempotencyRecord {
  readonly enquiryId: string;
}

export interface IdempotencyStore {
  get(orgId: string, key: string): Promise<IdempotencyRecord | null>;
  put(orgId: string, key: string, record: IdempotencyRecord): Promise<void>;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly store = new Map<string, IdempotencyRecord>();

  private key(orgId: string, key: string): string {
    return `${orgId}::${key}`;
  }

  async get(orgId: string, key: string): Promise<IdempotencyRecord | null> {
    return this.store.get(this.key(orgId, key)) ?? null;
  }

  async put(orgId: string, key: string, record: IdempotencyRecord): Promise<void> {
    this.store.set(this.key(orgId, key), record);
  }
}
