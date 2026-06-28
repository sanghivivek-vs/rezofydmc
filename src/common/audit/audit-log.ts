/**
 * Audit logging contract (Build guide §3 cross-cutting, §9).
 *
 * Audit-logging is MANDATORY on any pricing or status mutation. The engine and
 * services emit {@link AuditEvent}s through an {@link AuditSink}; the persistence
 * slice provides a DB-backed sink. Keeping this an interface means the costing
 * engine stays pure and testable while still declaring its audit obligations.
 */

import type { OrgId, UserId } from '../tenancy/tenant-context';

export type AuditAction =
  | 'quote.created'
  | 'quote.updated'
  | 'quote.sent'
  | 'quote.status_changed'
  | 'enquiry.status_changed'
  | 'costline.priced'
  | 'markup.changed'
  | 'segment.status_changed'
  // GDPR (ADR 0008): personal-data access/erasure/consent are audited.
  | 'data.exported'
  | 'data.erased'
  | 'data.accessed'
  | 'consent.recorded';

export interface AuditEvent {
  readonly orgId: OrgId;
  readonly actorId: UserId;
  readonly action: AuditAction;
  /** Entity type + id the event concerns, e.g. { type: 'Quote', id: 'q_123' }. */
  readonly subject: { type: string; id: string };
  /** Before/after snapshot for pricing & status changes. */
  readonly before?: Record<string, unknown>;
  readonly after?: Record<string, unknown>;
  /** ISO-8601 UTC timestamp, supplied by the caller (engine stays deterministic). */
  readonly at: string;
  readonly requestId?: string;
}

export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}

/** No-op sink for tests and pure-logic contexts. */
export class NullAuditSink implements AuditSink {
  async record(_event: AuditEvent): Promise<void> {
    // intentionally empty
  }
}
