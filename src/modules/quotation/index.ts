/**
 * Quotation module — public service interface (Build guide §4, §5).
 */

export * from './domain/quote';
export {
  QuotationService,
  type QuotationServiceDeps,
  selectRate,
} from './service/quotation.service';
export type { QuoteRepository } from './repository/quote.repository';
export { InMemoryQuoteRepository } from './repository/quote.repository';
export { QuotationModule } from './quotation.module';
