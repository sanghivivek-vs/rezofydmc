/**
 * Row <-> domain mapping for Enquiry persistence (Build guide §9 layering).
 *
 * Kept DB-agnostic and pure so it is unit-tested without a database. The Prisma
 * repository (see prisma/repository/) uses these functions; any SQL/ORM backend
 * could too. Money is stored as integer minor units + currency in two columns
 * (Build guide §0).
 */

import { money, type Money } from '@common/money/money';
import type { Enquiry } from '../domain/enquiry';
import type { EnquiryStatus, EnquirySource } from '../domain/enums';

/** Persisted row shape (scalar columns + JSON for nested structures). */
export interface EnquiryRow {
  id: string;
  orgId: string;
  enquiryExternalId: string | null;
  agencyId: string;
  source: string;
  destinations: string[];
  dateRange: unknown | null;
  durationDays: number | null;
  pax: unknown;
  rooming: unknown | null;
  hotelCategory: string | null;
  namedHotels: string[] | null;
  mealPreference: string | null;
  transportPreference: unknown | null;
  budgetAmountMinor: number | null;
  budgetCurrency: string | null;
  mustSeeInclusions: string[] | null;
  specialRequirements: string | null;
  quoteDeadline: Date | string;
  status: string;
  assignedToUserId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

function iso(value: Date | string): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function budgetOf(row: EnquiryRow): Money | undefined {
  if (row.budgetAmountMinor === null || row.budgetCurrency === null) return undefined;
  return money(row.budgetAmountMinor, row.budgetCurrency);
}

export function toDomain(row: EnquiryRow): Enquiry {
  return {
    id: row.id,
    orgId: row.orgId,
    enquiryExternalId: row.enquiryExternalId ?? undefined,
    agencyId: row.agencyId,
    source: row.source as EnquirySource,
    destinations: row.destinations,
    dateRange: (row.dateRange as Enquiry['dateRange']) ?? undefined,
    durationDays: row.durationDays ?? undefined,
    pax: row.pax as Enquiry['pax'],
    rooming: (row.rooming as Enquiry['rooming']) ?? undefined,
    hotelCategory: row.hotelCategory ?? undefined,
    namedHotels: row.namedHotels ?? undefined,
    mealPreference: row.mealPreference ?? undefined,
    transportPreference: (row.transportPreference as Enquiry['transportPreference']) ?? undefined,
    budget: budgetOf(row),
    mustSeeInclusions: row.mustSeeInclusions ?? undefined,
    specialRequirements: row.specialRequirements ?? undefined,
    quoteDeadline: iso(row.quoteDeadline),
    status: row.status as EnquiryStatus,
    assignedToUserId: row.assignedToUserId ?? undefined,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function toRow(e: Enquiry): EnquiryRow {
  return {
    id: e.id,
    orgId: e.orgId,
    enquiryExternalId: e.enquiryExternalId ?? null,
    agencyId: e.agencyId,
    source: e.source,
    destinations: e.destinations,
    dateRange: e.dateRange ?? null,
    durationDays: e.durationDays ?? null,
    pax: e.pax,
    rooming: e.rooming ?? null,
    hotelCategory: e.hotelCategory ?? null,
    namedHotels: e.namedHotels ?? null,
    mealPreference: e.mealPreference ?? null,
    transportPreference: e.transportPreference ?? null,
    budgetAmountMinor: e.budget?.amountMinor ?? null,
    budgetCurrency: e.budget?.currency ?? null,
    mustSeeInclusions: e.mustSeeInclusions ?? null,
    specialRequirements: e.specialRequirements ?? null,
    quoteDeadline: e.quoteDeadline,
    status: e.status,
    assignedToUserId: e.assignedToUserId ?? null,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}
