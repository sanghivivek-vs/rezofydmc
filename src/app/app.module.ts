import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IdentityModule } from '../modules/identity-org/identity.module';
import { EnquiryModule } from '../modules/enquiry-intake/enquiry.module';
import { CatalogModule } from '../modules/catalog/catalog.module';
import { QuotationModule } from '../modules/quotation/quotation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    IdentityModule,
    EnquiryModule,
    CatalogModule,
    QuotationModule,
  ],
})
export class AppModule {}
