/**
 * The feature modules that make up the application, independent of the
 * persistence backend. Both the in-memory composition (AppModule) and the
 * Prisma composition (prisma/composition/app-prisma.module) import this list, so
 * swapping persistence never changes the feature wiring (ADR 0009).
 */

import { SecurityModule } from './security/security.module';
import { IntegrationModule } from '../modules/integration/integration.module';
import { IdentityModule } from '../modules/identity-org/identity.module';
import { EnquiryModule } from '../modules/enquiry-intake/enquiry.module';
import { CatalogModule } from '../modules/catalog/catalog.module';
import { QuotationModule } from '../modules/quotation/quotation.module';
import { ItineraryModule } from '../modules/itinerary/itinerary.module';
import { DocumentsModule } from '../modules/documents/documents.module';
import { GdprModule } from '../modules/gdpr/gdpr.module';

export const FEATURE_MODULES = [
  SecurityModule,
  IntegrationModule,
  IdentityModule,
  EnquiryModule,
  CatalogModule,
  QuotationModule,
  ItineraryModule,
  DocumentsModule,
  GdprModule,
];
