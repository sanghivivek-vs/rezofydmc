/**
 * Documents NestJS module (Build guide §4). Renders the client quote document and
 * the owner-only costing sheet, composing Quotation, Enquiry, Identity/Org, and
 * Itinerary via their service interfaces.
 */

import { Module } from '@nestjs/common';
import { QuotationService } from '@modules/quotation';
import { EnquiryService } from '@modules/enquiry-intake';
import { OrgService } from '@modules/identity-org';
import { ItineraryService } from '@modules/itinerary';
import { OperationsService } from '@modules/operations';
import { IdentityModule } from '../identity-org/identity.module';
import { EnquiryModule } from '../enquiry-intake/enquiry.module';
import { QuotationModule } from '../quotation/quotation.module';
import { ItineraryModule } from '../itinerary/itinerary.module';
import { OperationsModule } from '../operations/operations.module';
import { DocumentController } from './api/document.controller';
import { VoucherController } from './api/voucher.controller';
import { DOCUMENT_RENDERER } from './api/tokens';
import { HtmlDocumentRenderer, type DocumentRenderer } from './service/document-renderer';
import { DocumentService } from './service/document.service';

@Module({
  imports: [IdentityModule, EnquiryModule, QuotationModule, ItineraryModule, OperationsModule],
  controllers: [DocumentController, VoucherController],
  providers: [
    { provide: DOCUMENT_RENDERER, useClass: HtmlDocumentRenderer },
    {
      provide: DocumentService,
      inject: [
        DOCUMENT_RENDERER,
        QuotationService,
        EnquiryService,
        OrgService,
        ItineraryService,
        OperationsService,
      ],
      useFactory: (
        renderer: DocumentRenderer,
        quotation: QuotationService,
        enquiries: EnquiryService,
        orgs: OrgService,
        itineraries: ItineraryService,
        operations: OperationsService,
      ) => new DocumentService({ renderer, quotation, enquiries, orgs, itineraries, operations }),
    },
  ],
  exports: [DocumentService],
})
export class DocumentsModule {}
