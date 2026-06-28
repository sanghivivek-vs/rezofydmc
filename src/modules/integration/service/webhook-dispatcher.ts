/**
 * Outbound webhook dispatcher (Build guide §6, ADR 0005).
 *
 * Builds the standard envelope, HMAC-signs the raw body, and delivers via the
 * injected transport with bounded retries + exponential backoff. On exhaustion
 * the delivery is dead-lettered (never thrown into the business transaction).
 *
 * Auth between platforms (decision #1) is still open; HMAC body-signing is the
 * integrity mechanism regardless, and the auth header is injected via
 * `staticHeaders` so it can be swapped without touching this code.
 */

import { signPayload } from '@common/integration/signature';
import { type OutboundEnvelope, type OutboundPublisher } from '@common/integration/outbound';
import type { WebhookTransport } from './transport';
import type { DeadLetterStore } from './dead-letter';

export interface DispatcherConfig {
  /** Target URL on the Tour Agency platform. Empty disables delivery (dev). */
  readonly url: string;
  readonly secret: string;
  readonly version?: string; // default "v1"
  readonly maxAttempts?: number; // default 4
  readonly staticHeaders?: Record<string, string>;
}

export type Sleep = (ms: number) => Promise<void>;
export const realSleep: Sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export interface DispatchResult {
  readonly delivered: boolean;
  readonly attempts: number;
  readonly lastStatus?: number;
  readonly deadLettered: boolean;
}

export class WebhookDispatcher implements OutboundPublisher {
  constructor(
    private readonly transport: WebhookTransport,
    private readonly deadLetters: DeadLetterStore,
    private readonly config: DispatcherConfig,
    private readonly sleep: Sleep = realSleep,
    private readonly logger: { warn: (m: string) => void } = console,
  ) {}

  async publish(
    event: string,
    data: Record<string, unknown>,
    idempotencyKey: string,
    occurredAt: string,
  ): Promise<void> {
    const envelope: OutboundEnvelope = {
      event,
      version: this.config.version ?? 'v1',
      idempotency_key: idempotencyKey,
      occurred_at: occurredAt,
      data,
    };
    await this.dispatch(envelope);
  }

  async dispatch(envelope: OutboundEnvelope): Promise<DispatchResult> {
    if (!this.config.url) {
      this.logger.warn(`Outbound webhook ${envelope.event} dropped: no URL configured`);
      return { delivered: false, attempts: 0, deadLettered: false };
    }

    const body = JSON.stringify(envelope);
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-signature': signPayload(body, this.config.secret),
      'x-idempotency-key': envelope.idempotency_key,
      'x-event': envelope.event,
      ...(this.config.staticHeaders ?? {}),
    };

    const maxAttempts = this.config.maxAttempts ?? 4;
    let lastStatus: number | undefined;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await this.transport.send({ url: this.config.url, headers, body });
        lastStatus = res.status;
        if (res.status >= 200 && res.status < 300) {
          return { delivered: true, attempts: attempt, lastStatus, deadLettered: false };
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
      if (attempt < maxAttempts) {
        await this.sleep(backoffMs(attempt));
      }
    }

    await this.deadLetters.add({
      envelope,
      lastStatus,
      error: lastError,
      failedAt: envelope.occurred_at,
    });
    this.logger.warn(
      `Outbound webhook ${envelope.event} dead-lettered after ${maxAttempts} attempts`,
    );
    return { delivered: false, attempts: maxAttempts, lastStatus, deadLettered: true };
  }
}

/** Exponential backoff: 2s, 4s, 8s, ... (attempt is 1-based). */
export function backoffMs(attempt: number): number {
  return 2000 * 2 ** (attempt - 1);
}
