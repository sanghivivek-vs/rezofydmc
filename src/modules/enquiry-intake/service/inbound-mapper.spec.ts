import { mapInboundEnquiry } from './inbound-mapper';
import { ValidationError } from '@common/errors/errors';
import { money } from '@common/money/money';

const validData = {
  enquiry_external_id: 'EXT-1',
  agency_id: 'AG-1',
  destinations: ['Switzerland'],
  date_range: { start: '2026-07-01', end: '2026-07-08', flexible: true },
  duration_days: 7,
  pax: { adults: 2, children: [{ age: 8 }], infants: 1 },
  hotel_category: '4-star',
  named_hotels: ['Hotel Belvedere'],
  meal_preference: 'Indian',
  transport_preference: { mode: 'private', coach_size: 20 },
  budget: { amount_minor: 500000, currency: 'eur' },
  must_see_inclusions: ['Jungfraujoch'],
  special_requirements: 'Jain meals on day 3',
  quote_deadline: '2026-06-15T00:00:00Z',
};

describe('mapInboundEnquiry', () => {
  it('maps a full valid payload into domain input', () => {
    const input = mapInboundEnquiry(validData);
    expect(input.enquiryExternalId).toBe('EXT-1');
    expect(input.agencyId).toBe('AG-1');
    expect(input.destinations).toEqual(['Switzerland']);
    expect(input.pax).toEqual({ adults: 2, children: [{ age: 8 }], infants: 1 });
    expect(input.budget).toEqual(money(500000, 'EUR')); // currency uppercased
    expect(input.transportPreference).toEqual({ mode: 'private', coachSize: 20 });
    expect(input.dateRange).toEqual({ start: '2026-07-01', end: '2026-07-08', flexible: true });
  });

  it('defaults infants and children when omitted', () => {
    const input = mapInboundEnquiry({
      ...validData,
      pax: { adults: 4 },
    });
    expect(input.pax).toEqual({ adults: 4, children: [], infants: 0 });
  });

  it('rejects a payload missing required fields', () => {
    expect(() => mapInboundEnquiry({ ...validData, agency_id: undefined })).toThrow(
      ValidationError,
    );
    expect(() => mapInboundEnquiry({ ...validData, destinations: [] })).toThrow(/at least 1/);
    expect(() => mapInboundEnquiry({ ...validData, quote_deadline: undefined })).toThrow(
      ValidationError,
    );
  });

  it('rejects malformed pax and budget', () => {
    expect(() => mapInboundEnquiry({ ...validData, pax: { adults: -1 } })).toThrow(ValidationError);
    expect(() =>
      mapInboundEnquiry({ ...validData, budget: { amount_minor: 1.5, currency: 'EUR' } }),
    ).toThrow(ValidationError);
  });

  it('rejects an invalid transport mode', () => {
    expect(() =>
      mapInboundEnquiry({ ...validData, transport_preference: { mode: 'train' } }),
    ).toThrow(/SIC.*private/);
  });
});
