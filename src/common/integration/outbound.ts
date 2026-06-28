/**
 * Outbound integration port (Build guide §6). Modules that produce events
 * (Quotation → quote.sent, Itinerary → segment.status.updated) depend on this
 * interface, never on the concrete webhook dispatcher — so the engine/services
 * stay decoupled from HTTP delivery. The Integration module binds the real
 * implementation; a NullOutboundPublisher is the safe default.
 */

export interface OutboundEnvelope {
  readonly event: string;
  readonly version: string;
  readonly idempotency_key: string;
  readonly occurred_at: string;
  readonly data: Record<string, unknown>;
}

export interface OutboundPublisher {
  /**
   * Publish a domain event to the Tour Agency platform. Implementations sign,
   * deliver with retries, and dead-letter on exhaustion (ADR 0005). The call
   * resolves once the event is accepted OR dead-lettered — it never throws into
   * the business transaction.
   */
  publish(
    event: string,
    data: Record<string, unknown>,
    idempotencyKey: string,
    occurredAt: string,
  ): Promise<void>;
}

export class NullOutboundPublisher implements OutboundPublisher {
  async publish(): Promise<void> {
    // no-op
  }
}

/** Shared DI token: the Integration module provides it; producers inject it. */
export const OUTBOUND_PUBLISHER = Symbol('OUTBOUND_PUBLISHER');

/** Wire-money shape used in outbound payloads (Build guide §0 on the wire). */
export interface WireMoney {
  amount_minor: number;
  currency: string;
}

export function toWireMoney(money: { amountMinor: number; currency: string }): WireMoney {
  return { amount_minor: money.amountMinor, currency: money.currency };
}
