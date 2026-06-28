import { WebhookDispatcher, backoffMs } from './webhook-dispatcher';
import { InMemoryDeadLetterStore } from './dead-letter';
import type { WebhookRequest, WebhookResponse, WebhookTransport } from './transport';
import { verifySignature } from '@common/integration/signature';

class FakeTransport implements WebhookTransport {
  readonly requests: WebhookRequest[] = [];
  constructor(private readonly statuses: number[]) {}
  async send(req: WebhookRequest): Promise<WebhookResponse> {
    this.requests.push(req);
    const status = this.statuses[this.requests.length - 1] ?? 500;
    return { status };
  }
}

const noSleep = async () => {};
const silent = { warn: () => {} };
const cfg = { url: 'https://agency.test/webhooks', secret: 'sek', maxAttempts: 4 };

describe('WebhookDispatcher', () => {
  it('delivers on first success and signs the raw body', async () => {
    const transport = new FakeTransport([200]);
    const dl = new InMemoryDeadLetterStore();
    const d = new WebhookDispatcher(transport, dl, cfg, noSleep, silent);

    const result = await d.dispatch({
      event: 'quote.sent',
      version: 'v1',
      idempotency_key: 'k1',
      occurred_at: '2026-06-28T10:00:00Z',
      data: { a: 1 },
    });

    expect(result).toMatchObject({ delivered: true, attempts: 1, deadLettered: false });
    const req = transport.requests[0];
    expect(verifySignature(req.body, req.headers['x-signature'], 'sek')).toBe(true);
    expect(req.headers['x-event']).toBe('quote.sent');
    expect(await dl.list()).toHaveLength(0);
  });

  it('retries on 5xx then succeeds', async () => {
    const transport = new FakeTransport([500, 503, 200]);
    const d = new WebhookDispatcher(transport, new InMemoryDeadLetterStore(), cfg, noSleep, silent);
    const result = await d.dispatch(envelope());
    expect(result).toMatchObject({ delivered: true, attempts: 3 });
  });

  it('dead-letters after exhausting attempts', async () => {
    const transport = new FakeTransport([500, 500, 500, 500]);
    const dl = new InMemoryDeadLetterStore();
    const d = new WebhookDispatcher(transport, dl, cfg, noSleep, silent);
    const result = await d.dispatch(envelope());
    expect(result).toMatchObject({ delivered: false, attempts: 4, deadLettered: true });
    const dead = await dl.list();
    expect(dead).toHaveLength(1);
    expect(dead[0].lastStatus).toBe(500);
  });

  it('drops (no dead-letter) when no URL is configured', async () => {
    const transport = new FakeTransport([200]);
    const dl = new InMemoryDeadLetterStore();
    const d = new WebhookDispatcher(transport, dl, { ...cfg, url: '' }, noSleep, silent);
    const result = await d.dispatch(envelope());
    expect(result.delivered).toBe(false);
    expect(transport.requests).toHaveLength(0);
    expect(await dl.list()).toHaveLength(0);
  });

  it('uses exponential backoff', () => {
    expect(backoffMs(1)).toBe(2000);
    expect(backoffMs(2)).toBe(4000);
    expect(backoffMs(3)).toBe(8000);
  });
});

function envelope() {
  return {
    event: 'segment.status.updated',
    version: 'v1',
    idempotency_key: 'k',
    occurred_at: '2026-06-28T10:00:00Z',
    data: {},
  };
}
