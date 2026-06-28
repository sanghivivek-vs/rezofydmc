/**
 * Prisma-backed persistence (ADR 0009) — the DB-environment counterpart of
 * src/app/persistence/in-memory-persistence.module. Binds the SAME repository
 * tokens to the Prisma implementations and shares one PrismaService connection.
 *
 * Compiled only via tsconfig.prisma.json (after `prisma generate`); not part of
 * the default build graph.
 */

import { Global, Module } from '@nestjs/common';
import {
  ENQUIRY_REPOSITORY,
  IDEMPOTENCY_STORE,
} from '../../src/modules/enquiry-intake/api/tokens';
import { ORG_REPOSITORY, USER_REPOSITORY } from '../../src/modules/identity-org/api/tokens';
import {
  COMPONENT_REPOSITORY,
  RATE_REPOSITORY,
  SUPPLIER_REPOSITORY,
} from '../../src/modules/catalog/api/tokens';
import { QUOTE_REPOSITORY } from '../../src/modules/quotation/api/tokens';
import { ITINERARY_REPOSITORY } from '../../src/modules/itinerary/api/tokens';
import { CONSENT_REPOSITORY } from '../../src/modules/gdpr/api/tokens';
import { BOOKING_REPOSITORY } from '../../src/modules/operations/api/tokens';
import {
  PrismaService,
  PrismaEnquiryRepository,
  PrismaIdempotencyStore,
  PrismaOrgRepository,
  PrismaUserRepository,
  PrismaSupplierRepository,
  PrismaComponentRepository,
  PrismaRateRepository,
  PrismaQuoteRepository,
  PrismaItineraryRepository,
  PrismaConsentRepository,
  PrismaBookingRepository,
} from '../repository/prisma-infra';

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
    PrismaService,
    { provide: ENQUIRY_REPOSITORY, useClass: PrismaEnquiryRepository },
    {
      provide: IDEMPOTENCY_STORE,
      inject: [PrismaService],
      useFactory: (p: PrismaService) => new PrismaIdempotencyStore(p),
    },
    { provide: ORG_REPOSITORY, useClass: PrismaOrgRepository },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: SUPPLIER_REPOSITORY, useClass: PrismaSupplierRepository },
    { provide: COMPONENT_REPOSITORY, useClass: PrismaComponentRepository },
    { provide: RATE_REPOSITORY, useClass: PrismaRateRepository },
    { provide: QUOTE_REPOSITORY, useClass: PrismaQuoteRepository },
    { provide: ITINERARY_REPOSITORY, useClass: PrismaItineraryRepository },
    { provide: CONSENT_REPOSITORY, useClass: PrismaConsentRepository },
    { provide: BOOKING_REPOSITORY, useClass: PrismaBookingRepository },
  ],
  exports: [...REPOSITORY_TOKENS, PrismaService],
})
export class PrismaPersistenceModule {}
