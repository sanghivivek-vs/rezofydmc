import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IdentityModule } from '../modules/identity-org/identity.module';
import { EnquiryModule } from '../modules/enquiry-intake/enquiry.module';
import { CatalogModule } from '../modules/catalog/catalog.module';
import { QuotationModule } from '../modules/quotation/quotation.module';
import { ItineraryModule } from '../modules/itinerary/itinerary.module';
import { IntegrationModule } from '../modules/integration/integration.module';
import { DocumentsModule } from '../modules/documents/documents.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SecurityModule,
    IntegrationModule,
    IdentityModule,
    EnquiryModule,
    CatalogModule,
    QuotationModule,
    ItineraryModule,
    DocumentsModule,
  ],
})
export class AppModule {}
