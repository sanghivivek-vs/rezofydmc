import type {
  Booking,
  ChannelConfig,
  Component,
  DeliveryResult,
  Enquiry,
  Itinerary,
  LoginResult,
  MessageChannel,
  Notification,
  PipelineReport,
  PublicUser,
  Quote,
  Role,
  Supplier,
  SupplierPO,
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

  // User administration
  listUsers: () => request<PublicUser[]>('GET', '/v1/users'),
  createUser: (input: { email: string; name: string; role: Role; password: string }) =>
    request<PublicUser>('POST', '/v1/users', input),
  updateUser: (id: string, input: { name?: string; role?: Role; status?: string }) =>
    request<PublicUser>('PATCH', `/v1/users/${id}`, input),
  resetUserPassword: (id: string, newPassword: string) =>
    request<{ reset: boolean }>('POST', `/v1/users/${id}/reset-password`, { newPassword }),
  changeMyPassword: (currentPassword: string, newPassword: string) =>
    request<{ changed: boolean }>('POST', '/v1/users/me/password', {
      currentPassword,
      newPassword,
    }),

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
  createComponent: (input: { type: string; supplierId: string; name: string; unitBasis: string }) =>
    request<Component>('POST', '/v1/components', input),
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

  // Operations
  acceptQuote: (id: string) => request<Booking>('POST', `/v1/quotes/${id}/accept`),
  rejectQuote: (id: string) => request<{ rejected: boolean }>('POST', `/v1/quotes/${id}/reject`),
  listBookings: () => request<Booking[]>('GET', '/v1/bookings'),
  getBooking: (id: string) => request<Booking>('GET', `/v1/bookings/${id}`),
  confirmBookingItem: (bookingId: string, itemId: string, confirmationRef: string) =>
    request<Booking>('POST', `/v1/bookings/${bookingId}/items/${itemId}/confirm`, {
      confirmationRef,
    }),
  supplierPOs: (bookingId: string) =>
    request<SupplierPO[]>('GET', `/v1/bookings/${bookingId}/supplier-pos`),
  pipeline: () => request<PipelineReport>('GET', '/v1/reports/pipeline'),

  // Itinerary
  listItineraries: (enquiryId: string) =>
    request<Itinerary[]>('GET', `/v1/itineraries?enquiryId=${encodeURIComponent(enquiryId)}`),
  createItinerary: (input: { enquiryId: string; title?: string }) =>
    request<Itinerary>('POST', '/v1/itineraries', input),
  addDay: (itineraryId: string, input: { dayNumber: number; date: string; headline: string }) =>
    request<Itinerary>('POST', `/v1/itineraries/${itineraryId}/days`, input),
  addSegment: (
    itineraryId: string,
    dayNumber: number,
    input: {
      type: string;
      description: string;
      startTime?: string;
      endTime?: string;
      bookingStatus?: string;
      supplier?: string;
    },
  ) =>
    request<Itinerary>('POST', `/v1/itineraries/${itineraryId}/days/${dayNumber}/segments`, input),
  updateSegmentStatus: (itineraryId: string, segmentId: string, bookingStatus: string) =>
    request<Itinerary>('PATCH', `/v1/itineraries/${itineraryId}/segments/${segmentId}/status`, {
      bookingStatus,
    }),

  // Notifications (derived from the audit stream)
  listNotifications: () => request<Notification[]>('GET', '/v1/notifications'),
  markNotificationRead: (id: string) =>
    request<Notification>('POST', `/v1/notifications/${id}/read`),

  // Messaging channel configuration
  getChannels: () => request<ChannelConfig[]>('GET', '/v1/notifications/channels'),
  updateChannels: (channels: ChannelConfig[]) =>
    request<ChannelConfig[]>('PUT', '/v1/notifications/channels', { channels }),
  testChannel: (channel: MessageChannel, to: string) =>
    request<DeliveryResult>('POST', '/v1/notifications/channels/test', { channel, to }),
};
