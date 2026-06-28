/**
 * Enquiry Intake module — public service interface (Build guide §4).
 *
 * Other modules consume enquiries through this surface only, never the repository
 * or store directly.
 */

export * from './domain/enums';
export * from './domain/enquiry';
export { canTransition, isTerminal, assertTransition } from './domain/status';
export { EnquiryService, type EnquiryServiceDeps } from './service/enquiry.service';
export { mapInboundEnquiry, type InboundEnquiryData } from './service/inbound-mapper';
export type { EnquiryRepository } from './repository/enquiry.repository';
export { InMemoryEnquiryRepository } from './repository/in-memory-enquiry.repository';
export type { IdempotencyStore, IdempotencyRecord } from './repository/idempotency-store';
export { InMemoryIdempotencyStore } from './repository/idempotency-store';
export { EnquiryModule } from './enquiry.module';
