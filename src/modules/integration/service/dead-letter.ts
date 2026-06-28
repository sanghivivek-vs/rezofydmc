/**
 * Dead-letter store (Build guide §6: "delivery retries + dead-letter"). Holds
 * webhook deliveries that exhausted their retries, for later inspection/replay.
 */

import type { OutboundEnvelope } from '@common/integration/outbound';

export interface DeadLetter {
  readonly envelope: OutboundEnvelope;
  readonly lastStatus?: number;
  readonly error?: string;
  readonly failedAt: string;
}

export interface DeadLetterStore {
  add(entry: DeadLetter): Promise<void>;
  list(): Promise<DeadLetter[]>;
}

export class InMemoryDeadLetterStore implements DeadLetterStore {
  private readonly entries: DeadLetter[] = [];
  async add(entry: DeadLetter): Promise<void> {
    this.entries.push(entry);
  }
  async list(): Promise<DeadLetter[]> {
    return [...this.entries];
  }
}
