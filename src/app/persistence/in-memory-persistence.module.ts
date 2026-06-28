/**
 * In-memory persistence (default — sandbox, tests, local dev).
 *
 * A single @Global module that binds every domain repository + the idempotency
 * and consent stores to their in-memory implementations. Feature modules inject
 * these tokens but no longer bind them, so persistence can be swapped wholesale
 * for the Prisma-backed module (prisma/composition/) in a DB environment via the
 * `PERSISTENCE` env flag — with no change to feature modules (ADR 0009).
 */

import { Global, Module } from '@nestjs/common';
import { ENQUIRY_REPOSITORY, IDEMPOTENCY_STORE } from '@modules/enquiry-intake/api/tokens';
import { InMemoryEnquiryRepository } from '@modules/enquiry-intake/repository/in-memory-enquiry.repository';
import { InMemoryIdempotencyStore } from '@modules/enquiry-intake/repository/idempotency-store';
import { ORG_REPOSITORY, USER_REPOSITORY } from '@modules/identity-org/api/tokens';
import { InMemoryOrgRepository } from '@modules/identity-org/repository/org.repository';
import { InMemoryUserRepository } from '@modules/identity-org/repository/user.repository';
import {
  COMPONENT_REPOSITORY,
  RATE_REPOSITORY,
  SUPPLIER_REPOSITORY,
} from '@modules/catalog/api/tokens';
import {
  InMemoryComponentRepository,
  InMemoryRateRepository,
  InMemorySupplierRepository,
} from '@modules/catalog/repository/catalog.repository';
import { QUOTE_REPOSITORY } from '@modules/quotation/api/tokens';
import { InMemoryQuoteRepository } from '@modules/quotation/repository/quote.repository';
import { ITINERARY_REPOSITORY } from '@modules/itinerary/api/tokens';
import { InMemoryItineraryRepository } from '@modules/itinerary/repository/itinerary.repository';
import { CONSENT_REPOSITORY } from '@modules/gdpr/api/tokens';
import { InMemoryConsentRepository } from '@modules/gdpr/repository/consent.repository';
import { BOOKING_REPOSITORY } from '@modules/operations/api/tokens';
import { InMemoryBookingRepository } from '@modules/operations/repository/booking.repository';

const REPOSITORY_TOKENS = [
  ENQUIRY_REPOSITORY,
  IDEMPOTENCY_STORE,
  ORG_REPOSITORY,
  USER_REPOSITORY,
  SUPPLIER_REPOSITORY,
  COMPONENT_REPOSITORY,
  RATE_REPOSITORY,
  QUOTE_REPOSITORY,
  ITINERARY_REPOSITORY,
  CONSENT_REPOSITORY,
  BOOKING_REPOSITORY,
];

@Global()
@Module({
  providers: [
    { provide: ENQUIRY_REPOSITORY, useClass: InMemoryEnquiryRepository },
    { provide: IDEMPOTENCY_STORE, useClass: InMemoryIdempotencyStore },
    { provide: ORG_REPOSITORY, useClass: InMemoryOrgRepository },
    { provide: USER_REPOSITORY, useClass: InMemoryUserRepository },
    { provide: SUPPLIER_REPOSITORY, useClass: InMemorySupplierRepository },
    { provide: COMPONENT_REPOSITORY, useClass: InMemoryComponentRepository },
    { provide: RATE_REPOSITORY, useClass: InMemoryRateRepository },
    { provide: QUOTE_REPOSITORY, useClass: InMemoryQuoteRepository },
    { provide: ITINERARY_REPOSITORY, useClass: InMemoryItineraryRepository },
    { provide: CONSENT_REPOSITORY, useClass: InMemoryConsentRepository },
    { provide: BOOKING_REPOSITORY, useClass: InMemoryBookingRepository },
  ],
  exports: REPOSITORY_TOKENS,
})
export class InMemoryPersistenceModule {}
