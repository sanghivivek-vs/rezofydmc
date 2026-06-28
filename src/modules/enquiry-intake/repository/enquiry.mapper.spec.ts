import { toDomain, toRow, type EnquiryRow } from './enquiry.mapper';
import type { Enquiry } from '../domain/enquiry';
import { money } from '@common/money/money';

const enquiry: Enquiry = {
  id: 'enq_1',
  orgId: 'org-A',
  enquiryExternalId: 'EXT-1',
  agencyId: 'AG-1',
  source: 'integration',
  destinations: ['Switzerland', 'Italy'],
  dateRange: { start: '2026-07-01', end: '2026-07-08', flexible: true },
  durationDays: 7,
  pax: { adults: 2, children: [{ age: 8 }], infants: 1 },
  rooming: { single: 0, double: 1, triple: 0 },
  hotelCategory: '4-star',
  namedHotels: ['Belvedere'],
  mealPreference: 'Indian',
  transportPreference: { mode: 'private', coachSize: 20 },
  budget: money(500000, 'EUR'),
  mustSeeInclusions: ['Jungfraujoch'],
  specialRequirements: 'Jain meals',
  quoteDeadline: '2026-06-15T00:00:00.000Z',
  status: 'Quoted',
  assignedToUserId: 'staff-1',
  createdAt: '2026-06-28T10:00:00.000Z',
  updatedAt: '2026-06-28T11:00:00.000Z',
};

describe('enquiry mapper', () => {
  it('round-trips domain -> row -> domain', () => {
    expect(toDomain(toRow(enquiry))).toEqual(enquiry);
  });

  it('splits Money into amount/currency columns', () => {
    const row = toRow(enquiry);
    expect(row.budgetAmountMinor).toBe(500000);
    expect(row.budgetCurrency).toBe('EUR');
  });

  it('maps null columns back to undefined optionals', () => {
    const minimalRow: EnquiryRow = {
      id: 'enq_2',
      orgId: 'org-A',
      enquiryExternalId: null,
      agencyId: 'AG-2',
      source: 'manual',
      destinations: ['Spain'],
      dateRange: null,
      durationDays: null,
      pax: { adults: 1, children: [], infants: 0 },
      rooming: null,
      hotelCategory: null,
      namedHotels: null,
      mealPreference: null,
      transportPreference: null,
      budgetAmountMinor: null,
      budgetCurrency: null,
      mustSeeInclusions: null,
      specialRequirements: null,
      quoteDeadline: '2026-06-20T00:00:00.000Z',
      status: 'New',
      assignedToUserId: null,
      createdAt: '2026-06-28T10:00:00.000Z',
      updatedAt: '2026-06-28T10:00:00.000Z',
    };
    const domain = toDomain(minimalRow);
    expect(domain.budget).toBeUndefined();
    expect(domain.enquiryExternalId).toBeUndefined();
    expect(domain.assignedToUserId).toBeUndefined();
  });

  it('normalises Date columns to ISO strings', () => {
    const row = toRow(enquiry);
    row.createdAt = new Date('2026-06-28T10:00:00.000Z');
    expect(toDomain(row).createdAt).toBe('2026-06-28T10:00:00.000Z');
  });
});
