import type {
  Component,
  Enquiry,
  LoginResult,
  PublicUser,
  Quote,
  Supplier,
} from './types';

const TOKEN_KEY = 'dmc.token';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const err = (data && data.error) || {};
    throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? res.statusText);
  }
  return data as T;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<LoginResult>('POST', '/v1/auth/login', { email, password }),
  registerOrg: (input: {
    org: { name: string; defaultCurrency: string; defaultMarkupPercent?: number };
    owner: { email: string; name: string; password: string };
  }) => request<{ token: string; owner: PublicUser }>('POST', '/v1/auth/register-org', input),
  me: () => request<PublicUser>('GET', '/v1/users/me'),

  // Enquiries
  listEnquiries: () => request<Enquiry[]>('GET', '/v1/enquiries'),
  getEnquiry: (id: string) => request<Enquiry>('GET', `/v1/enquiries/${id}`),
  createEnquiry: (input: Partial<Enquiry> & { agencyId: string; quoteDeadline: string }) =>
    request<Enquiry>('POST', '/v1/enquiries', input),

  // Catalog
  listSuppliers: () => request<Supplier[]>('GET', '/v1/suppliers'),
  createSupplier: (input: { name: string; currency: string; type?: string }) =>
    request<Supplier>('POST', '/v1/suppliers', input),
  listComponents: () => request<Component[]>('GET', '/v1/components'),
  createComponent: (input: {
    type: string;
    supplierId: string;
    name: string;
    unitBasis: string;
  }) => request<Component>('POST', '/v1/components', input),
  addRate: (
    componentId: string,
    input: { net: { amountMinor: number; currency: string }; validFrom: string; validTo: string },
  ) => request<unknown>('POST', `/v1/components/${componentId}/rates`, input),

  // Quotes
  listQuotes: (enquiryId: string) =>
    request<Quote[]>('GET', `/v1/quotes?enquiryId=${encodeURIComponent(enquiryId)}`),
  createQuote: (input: {
    enquiryId: string;
    lines: { componentId: string; travelDate: string; inclusion: 'included' | 'optional' }[];
  }) => request<Quote>('POST', '/v1/quotes', input),
  sendQuote: (id: string) => request<Quote>('POST', `/v1/quotes/${id}/send`),
  quoteDocumentUrl: (id: string) => `/v1/quotes/${id}/document`,
};
