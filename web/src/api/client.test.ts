import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, setToken } from './client';

describe('api client', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('injects the bearer token and parses JSON', async () => {
    setToken('tok-123');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{ id: 'e1' }]),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await api.listEnquiries();

    expect(res).toEqual([{ id: 'e1' }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/v1/enquiries');
    expect(init.headers.authorization).toBe('Bearer tok-123');
  });

  it('throws ApiError with the envelope code on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => JSON.stringify({ error: { code: 'FORBIDDEN', message: 'nope' } }),
      }),
    );
    await expect(api.listEnquiries()).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});
