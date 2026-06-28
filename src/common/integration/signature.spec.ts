import { signPayload, verifySignature } from './signature';

describe('webhook signature', () => {
  const secret = 'shared-secret';
  const body = JSON.stringify({ event: 'enquiry.created', data: { a: 1 } });

  it('verifies a correct signature', () => {
    const sig = signPayload(body, secret);
    expect(verifySignature(body, sig, secret)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const sig = signPayload(body, secret);
    expect(verifySignature(body + ' ', sig, secret)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    const sig = signPayload(body, secret);
    expect(verifySignature(body, sig, 'other-secret')).toBe(false);
  });

  it('rejects empty or malformed signatures without throwing', () => {
    expect(verifySignature(body, '', secret)).toBe(false);
    expect(verifySignature(body, 'not-hex-zzz', secret)).toBe(false);
  });
});
