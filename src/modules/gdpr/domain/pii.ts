/**
 * PII classification registry (ADR 0008). Declares which stored fields are
 * personal data, special-category data (GDPR Art. 9 — e.g. dietary preference
 * can reveal religion), or credential material. Drives the DSAR export surface
 * and documents what erasure must cover.
 *
 * Data-subject scope (confirmed): DMC staff users AND traveller PII captured in
 * enquiries/itineraries. The DMC is typically the controller for traveller data;
 * this platform is the processor.
 */

export type PiiCategory = 'personal' | 'special_category' | 'credential';

export interface PiiField {
  readonly entity: string;
  readonly field: string;
  readonly category: PiiCategory;
  readonly note?: string;
}

export const PII_REGISTRY: readonly PiiField[] = [
  { entity: 'User', field: 'email', category: 'personal' },
  { entity: 'User', field: 'name', category: 'personal' },
  { entity: 'User', field: 'passwordHash', category: 'credential' },
  {
    entity: 'Enquiry',
    field: 'pax.children[].age',
    category: 'personal',
    note: 'ages of minors',
  },
  {
    entity: 'Enquiry',
    field: 'mealPreference',
    category: 'special_category',
    note: 'dietary preference may reveal religion (Art. 9)',
  },
  { entity: 'Enquiry', field: 'namedHotels', category: 'personal' },
  {
    entity: 'Enquiry',
    field: 'specialRequirements',
    category: 'special_category',
    note: 'free text may contain health/identifying data',
  },
  { entity: 'Segment', field: 'notes', category: 'personal', note: 'free text' },
];
