/**
 * Webhook transport (Build guide §6). Abstracts the HTTP delivery so the
 * dispatcher is testable without a live endpoint. The fetch-based implementation
 * is used at runtime; tests inject a fake.
 */

export interface WebhookRequest {
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: string;
}

export interface WebhookResponse {
  readonly status: number;
}

export interface WebhookTransport {
  send(req: WebhookRequest): Promise<WebhookResponse>;
}

/** Delivers via the global fetch (Node 20+). */
export class FetchWebhookTransport implements WebhookTransport {
  async send(req: WebhookRequest): Promise<WebhookResponse> {
    const res = await fetch(req.url, {
      method: 'POST',
      headers: req.headers,
      body: req.body,
    });
    return { status: res.status };
  }
}
