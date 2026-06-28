/**
 * Webhook signature (Build guide §6, ADR 0005).
 *
 * Inbound/outbound webhooks are HMAC-SHA256 signed over the RAW request body
 * using a shared secret. Consumers verify before processing. Comparison is
 * constant-time to avoid timing attacks.
 *
 * NOTE: the final auth scheme between platforms (OAuth client-credentials vs API
 * key) is decision #1 in docs/decisions-to-confirm.md. HMAC body-signing is
 * orthogonal to that and is the integrity mechanism regardless.
 */

import { createHmac, timingSafeEqual } from 'crypto';

export function signPayload(rawBody: string | Buffer, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

/**
 * Verify a hex signature against the raw body. Returns false (never throws) on
 * any mismatch, including malformed signatures.
 */
export function verifySignature(
  rawBody: string | Buffer,
  signatureHex: string,
  secret: string,
): boolean {
  if (!signatureHex) return false;
  const expected = signPayload(rawBody, secret);
  const a = Buffer.from(expected, 'hex');
  let b: Buffer;
  try {
    b = Buffer.from(signatureHex, 'hex');
  } catch {
    return false;
  }
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}
