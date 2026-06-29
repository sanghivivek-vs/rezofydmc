export interface Money {
  amountMinor: number;
  currency: string;
}

export type Role = 'Owner' | 'Sales' | 'Ops' | 'Accounts' | 'ReadOnly';

export interface PublicUser {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: Role;
  status: string;
}

export interface EnquiryPax {
  adults: number;
  children: { age: number }[];
  infants: number;
}

export interface Enquiry {
  id: string;
  orgId: string;
  agencyId: string;
  source: string;
  destinations: string[];
  pax: EnquiryPax;
  mealPreference?: string;
  specialRequirements?: string;
  status: string;
  quoteDeadline: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  currency: string;
  type?: string;
}

export interface Component {
  id: string;
  type: string;
  supplierId: string;
  name: string;
  unitBasis: string;
}

export interface SellView {
  currency: string;
  includedSubtotal: Money;
  taxes: { label: string; percent: number; amount: Money }[];
  total: Money;
  perPax: Money;
  optionalItems: { lineId: string; description: string; sell: Money }[];
}

export interface MarginView {
  currency: string;
  totalCost: Money;
  totalSell: Money;
  totalMargin: Money;
  marginPercent: number;
}

export interface Quote {
  id: string;
  enquiryId: string;
  version: number;
  status: string;
  currency: string;
  sell: SellView;
  margin?: MarginView; // present only for Owners (server-side gate)
  createdAt: string;
}

export interface LoginResult {
  token: string;
  user: PublicUser;
}

export type BookingItemStatus = 'Pending' | 'Confirmed' | 'Cancelled';

export interface BookingItem {
  id: string;
  componentId?: string;
  description: string;
  supplierId?: string;
  supplierName?: string;
  status: BookingItemStatus;
  confirmationRef?: string;
}

export interface Booking {
  id: string;
  enquiryId: string;
  quoteId: string;
  status: 'Confirming' | 'Confirmed' | 'Cancelled';
  items: BookingItem[];
  createdAt: string;
}

export interface SupplierPO {
  supplierId: string;
  supplierName: string;
  bookingId: string;
  items: { itemId: string; description: string; status: BookingItemStatus }[];
}

export interface PipelineReport {
  byStatus: Record<string, number>;
  total: number;
  won: number;
  lost: number;
}

export interface Segment {
  id: string;
  startTime?: string;
  endTime?: string;
  type: string;
  description: string;
  notes?: string;
  bookingStatus: string;
  supplier?: string;
  componentId?: string;
}

export interface ItineraryDay {
  dayNumber: number;
  date: string;
  headline: string;
  segments: Segment[];
}

export interface Itinerary {
  id: string;
  enquiryId: string;
  version: number;
  title?: string;
  days: ItineraryDay[];
}

export interface Notification {
  id: string;
  orgId: string;
  type: string;
  subject: { type: string; id: string };
  message: string;
  recipientUserId?: string;
  read: boolean;
  createdAt: string;
}

export type MessageChannel = 'email' | 'sms' | 'whatsapp';
export type ProviderName = 'logging' | 'twilio' | 'gupshup' | 'heydoot';

export interface ChannelConfig {
  channel: MessageChannel;
  enabled: boolean;
  provider: ProviderName;
  from?: string;
}

export interface DeliveryResult {
  channel: MessageChannel;
  provider: ProviderName;
  to: string;
  status: 'sent' | 'skipped' | 'failed';
  detail?: string;
}

export type NotificationAudience = 'team' | 'actor' | 'customer';

export interface RoutingRule {
  event: string;
  audience: NotificationAudience;
  channels: MessageChannel[];
}
