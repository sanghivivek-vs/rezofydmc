/**
 * Maps an inbound `enquiry.created` / `enquiry.updated` webhook payload (the
 * `data` object — see docs/integration/inbound/enquiry.created.schema.json) into
 * a validated {@link CreateEnquiryInput}.
 *
 * This is the trust boundary: external data is validated here before it reaches
 * the service. Money arrives as { amount_minor, currency } and is mapped to the
 * internal Money type (Build guide §0, §6).
 */

import { money, type Money } from '@common/money/money';
import { ValidationError } from '@common/errors/errors';
import type { CreateEnquiryInput, EnquiryPax } from '../domain/enquiry';
import type { TransportMode } from '../domain/enums';

/** Loosely-typed inbound shape (post-JSON-parse, pre-validation). */
export interface InboundEnquiryData {
  enquiry_external_id?: unknown;
  agency_id?: unknown;
  destinations?: unknown;
  date_range?: unknown;
  duration_days?: unknown;
  pax?: unknown;
  rooming?: unknown;
  hotel_category?: unknown;
  named_hotels?: unknown;
  meal_preference?: unknown;
  transport_preference?: unknown;
  budget?: unknown;
  must_see_inclusions?: unknown;
  special_requirements?: unknown;
  quote_deadline?: unknown;
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(`Field "${field}" must be an object`, { field });
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`Field "${field}" is required and must be a non-empty string`, {
      field,
    });
  }
  return value;
}

function requireStringArray(value: unknown, field: string, minItems = 0): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new ValidationError(`Field "${field}" must be an array of strings`, { field });
  }
  if (value.length < minItems) {
    throw new ValidationError(`Field "${field}" must have at least ${minItems} item(s)`, {
      field,
    });
  }
  return value as string[];
}

function optionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  return requireStringArray(value, field);
}

function requireNonNegativeInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ValidationError(`Field "${field}" must be a non-negative integer`, { field });
  }
  return value;
}

function mapPax(value: unknown): EnquiryPax {
  const pax = asRecord(value, 'pax');
  const adults = requireNonNegativeInt(pax.adults, 'pax.adults');
  const infants = pax.infants === undefined ? 0 : requireNonNegativeInt(pax.infants, 'pax.infants');
  const childrenRaw = pax.children ?? [];
  if (!Array.isArray(childrenRaw)) {
    throw new ValidationError('Field "pax.children" must be an array', { field: 'pax.children' });
  }
  const children = childrenRaw.map((c, i) => {
    const child = asRecord(c, `pax.children[${i}]`);
    return { age: requireNonNegativeInt(child.age, `pax.children[${i}].age`) };
  });
  return { adults, children, infants };
}

function mapBudget(value: unknown): Money | undefined {
  if (value === undefined) return undefined;
  const b = asRecord(value, 'budget');
  const amount = requireNonNegativeInt(b.amount_minor, 'budget.amount_minor');
  const currency = requireString(b.currency, 'budget.currency');
  return money(amount, currency);
}

function mapTransport(value: unknown): CreateEnquiryInput['transportPreference'] {
  if (value === undefined) return undefined;
  const t = asRecord(value, 'transport_preference');
  const mode = t.mode;
  if (mode !== 'SIC' && mode !== 'private') {
    throw new ValidationError('Field "transport_preference.mode" must be "SIC" or "private"', {
      field: 'transport_preference.mode',
    });
  }
  const coachSize =
    t.coach_size === undefined
      ? undefined
      : requireNonNegativeInt(t.coach_size, 'transport_preference.coach_size');
  return { mode: mode as TransportMode, coachSize };
}

export function mapInboundEnquiry(data: InboundEnquiryData): CreateEnquiryInput {
  const quoteDeadline = requireString(data.quote_deadline, 'quote_deadline');
  const input: CreateEnquiryInput = {
    enquiryExternalId: requireString(data.enquiry_external_id, 'enquiry_external_id'),
    agencyId: requireString(data.agency_id, 'agency_id'),
    destinations: requireStringArray(data.destinations, 'destinations', 1),
    pax: mapPax(data.pax),
    quoteDeadline,
    namedHotels: optionalStringArray(data.named_hotels, 'named_hotels'),
    mustSeeInclusions: optionalStringArray(data.must_see_inclusions, 'must_see_inclusions'),
    hotelCategory:
      data.hotel_category === undefined
        ? undefined
        : requireString(data.hotel_category, 'hotel_category'),
    mealPreference:
      data.meal_preference === undefined
        ? undefined
        : requireString(data.meal_preference, 'meal_preference'),
    specialRequirements:
      data.special_requirements === undefined
        ? undefined
        : requireString(data.special_requirements, 'special_requirements'),
    durationDays:
      data.duration_days === undefined
        ? undefined
        : requireNonNegativeInt(data.duration_days, 'duration_days'),
    budget: mapBudget(data.budget),
    transportPreference: mapTransport(data.transport_preference),
    dateRange: mapDateRange(data.date_range),
  };
  return input;
}

function mapDateRange(value: unknown): CreateEnquiryInput['dateRange'] {
  if (value === undefined) return undefined;
  const dr = asRecord(value, 'date_range');
  return {
    start: requireString(dr.start, 'date_range.start'),
    end: requireString(dr.end, 'date_range.end'),
    flexible: dr.flexible === undefined ? false : Boolean(dr.flexible),
  };
}
