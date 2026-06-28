/**
 * Consent / lawful-basis record (ADR 0008, GDPR Art. 6/7). Captures the basis on
 * which a data subject's personal data is processed, who recorded it, and when.
 */

import type { TenantScoped, UserId } from '@common/tenancy/tenant-context';

export type DataSubjectType = 'user' | 'traveller';

/** GDPR Art. 6(1) lawful bases. */
export type LawfulBasis =
  | 'consent'
  | 'contract'
  | 'legal_obligation'
  | 'vital_interests'
  | 'public_task'
  | 'legitimate_interests';

export interface ConsentRecord extends TenantScoped {
  readonly id: string;
  readonly subjectType: DataSubjectType;
  /** Reference to the subject (userId, or enquiryId for traveller data). */
  readonly subjectRef: string;
  readonly purpose: string;
  readonly lawfulBasis: LawfulBasis;
  readonly granted: boolean;
  readonly recordedBy: UserId;
  readonly recordedAt: string;
}

export interface RecordConsentInput {
  readonly subjectType: DataSubjectType;
  readonly subjectRef: string;
  readonly purpose: string;
  readonly lawfulBasis: LawfulBasis;
  readonly granted: boolean;
}
