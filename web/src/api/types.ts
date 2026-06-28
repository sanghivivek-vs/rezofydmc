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
